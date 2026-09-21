import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLandHoldingDto, CreateParcelDto } from './dto/land.dto';
import { DecimalUtil } from '../common/decimal.util';
import { AuditAction, LandStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class LandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a land holding along with its SF/subdivision parcels atomically.
   * Enforces: SUM(parcel areas) == declared_total_area.
   */
  async createHoldingWithParcels(dto: CreateLandHoldingDto, userId?: string, ipAddress?: string) {
    if (!dto.parcels || dto.parcels.length === 0) {
      throw new BadRequestException('At least one SF/subdivision parcel is required for a land holding.');
    }

    // Verify sum of parcels == declared_total_area
    const sumParcels = DecimalUtil.sum(dto.parcels.map((p) => p.area));
    const declared = new Decimal(dto.declaredTotalArea);

    if (!DecimalUtil.equalsWithTolerance(sumParcels, declared)) {
      throw new BadRequestException(
        `Validation Failed: Sum of parcel areas (${sumParcels.toFixed(4)} ${dto.areaUnit || 'ACRES'}) does not match declared total area (${declared.toFixed(4)} ${dto.areaUnit || 'ACRES'}).`,
      );
    }

    // Verify beneficiary exists
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: dto.beneficiaryId },
    });
    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${dto.beneficiaryId} not found`);
    }

    // Atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const holding = await tx.landHolding.create({
        data: {
          beneficiary_id: dto.beneficiaryId,
          project_id: dto.projectId,
          declared_total_area: declared,
          area_unit: dto.areaUnit || 'ACRES',
          status: dto.status || LandStatus.ACTIVE,
        },
      });

      await tx.landParcel.createMany({
        data: dto.parcels.map((p) => ({
          land_id: holding.land_id,
          survey_number: p.surveyNumber.trim(),
          subdivision_number: p.subdivisionNumber.trim(),
          area: new Decimal(p.area),
          area_unit: p.areaUnit || dto.areaUnit || 'ACRES',
        })),
      });

      return tx.landHolding.findUnique({
        where: { land_id: holding.land_id },
        include: {
          parcels: { orderBy: { survey_number: 'asc' } },
          project: true,
        },
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'LandHolding',
      entityId: result.land_id,
      newValues: result,
      reason: 'Registered land holding with verified subdivision parcels',
      ipAddress,
    });

    return result;
  }

  async findByBeneficiary(beneficiaryId: string) {
    return this.prisma.landHolding.findMany({
      where: { beneficiary_id: beneficiaryId },
      orderBy: { created_at: 'desc' },
      include: {
        parcels: { orderBy: { survey_number: 'asc' } },
        project: { select: { project_id: true, project_code: true, project_name: true } },
      },
    });
  }

  /**
   * Computes total active land in acres across all holdings for a beneficiary.
   */
  async getTotalBeneficiaryLand(beneficiaryId: string): Promise<{
    beneficiary_id: string;
    total_land_acres: string;
    active_holdings_count: number;
    total_parcels_count: number;
  }> {
    const holdings = await this.prisma.landHolding.findMany({
      where: {
        beneficiary_id: beneficiaryId,
        status: LandStatus.ACTIVE,
      },
      include: {
        parcels: true,
      },
    });

    let totalAcres = new Decimal(0);
    let totalParcels = 0;

    for (const h of holdings) {
      totalAcres = totalAcres.plus(new Decimal(h.declared_total_area));
      totalParcels += h.parcels.length;
    }

    return {
      beneficiary_id: beneficiaryId,
      total_land_acres: totalAcres.toFixed(4),
      active_holdings_count: holdings.length,
      total_parcels_count: totalParcels,
    };
  }

  async deactivateHolding(landId: string, userId?: string, ipAddress?: string) {
    const existing = await this.prisma.landHolding.findUnique({
      where: { land_id: landId },
    });
    if (!existing) {
      throw new NotFoundException('Land holding not found');
    }

    const updated = await this.prisma.landHolding.update({
      where: { land_id: landId },
      data: { status: LandStatus.INACTIVE },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'LandHolding',
      entityId: landId,
      oldValues: existing,
      newValues: updated,
      reason: 'Deactivated land holding',
      ipAddress,
    });

    return updated;
  }
}
