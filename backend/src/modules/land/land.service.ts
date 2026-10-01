import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLandHoldingDto, CreateParcelDto, UpdateLandHoldingDto, CheckParcelAvailabilityDto } from './dto/land.dto';
import { DecimalUtil } from '../common/decimal.util';
import { AuditAction, LandStatus, ApplicationStatus } from '../common/enums';
import { Decimal } from 'decimal.js';

@Injectable()
export class LandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a land holding along with its SF/subdivision parcels atomically.
   * Enforces: SUM(parcel areas) == declared_total_area if parcels are provided.
   */
  async createHoldingWithParcels(dto: CreateLandHoldingDto, userId?: string, ipAddress?: string) {
    const declared = new Decimal(dto.declaredTotalArea);

    if (dto.parcels && dto.parcels.length > 0) {
      // Validate uniqueness within holding payload
      const seenParcels = new Set<string>();
      for (const p of dto.parcels) {
        const key = `${p.surveyNumber.trim().toUpperCase()}#${p.subdivisionNumber.trim().toUpperCase()}`;
        if (seenParcels.has(key)) {
          throw new BadRequestException(
            `Duplicate parcel detected: Survey ${p.surveyNumber.trim()} / Subdivision ${p.subdivisionNumber.trim()} is specified more than once in this land holding.`,
          );
        }
        seenParcels.add(key);
      }

      // Validate uniqueness across existing active land parcels in database
      for (const p of dto.parcels) {
        const sTrim = p.surveyNumber.trim();
        const subTrim = p.subdivisionNumber.trim();
        const existingParcel = await this.prisma.landParcel.findFirst({
          where: {
            survey_number: sTrim,
            subdivision_number: subTrim,
            landHolding: { status: LandStatus.ACTIVE },
          },
          include: {
            landHolding: {
              include: {
                beneficiary: { select: { name: true, phone_number: true } },
              },
            },
          },
        });

        if (existingParcel) {
          const owner = existingParcel.landHolding?.beneficiary?.name || 'another holding';
          throw new BadRequestException(
            `Survey number ${sTrim} with subdivision ${subTrim} is already registered under ${owner} (Holding #${existingParcel.land_id.slice(0, 8)}). Duplicate parcel registration is not permitted.`,
          );
        }
      }

      // Verify sum of parcels == declared_total_area
      const sumParcels = DecimalUtil.sum(dto.parcels.map((p) => p.area));
      if (!DecimalUtil.equalsWithTolerance(sumParcels, declared)) {
        throw new BadRequestException(
          `Validation Failed: Sum of parcel areas (${sumParcels.toFixed(4)} ${dto.areaUnit || 'ACRES'}) does not match declared total area (${declared.toFixed(4)} ${dto.areaUnit || 'ACRES'}).`,
        );
      }
    }

    // Verify beneficiary exists
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: dto.beneficiaryId },
    });
    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${dto.beneficiaryId} not found`);
    }

    // Verify Project Scheme exists and is ACTIVE
    if (!dto.projectId) {
      throw new BadRequestException('Project Scheme is required for registering a land holding.');
    }
    const project = await this.prisma.project.findUnique({
      where: { project_id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project Scheme with ID '${dto.projectId}' not found.`);
    }
    if (project.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Project Scheme '${project.project_name}' (${project.project_code}) is inactive. Only active project schemes can be assigned to new land holdings.`,
      );
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

      if (dto.parcels && dto.parcels.length > 0) {
        await tx.landParcel.createMany({
          data: dto.parcels.map((p) => ({
            land_id: holding.land_id,
            survey_number: p.surveyNumber.trim(),
            subdivision_number: p.subdivisionNumber.trim(),
            area: new Decimal(p.area),
            area_unit: p.areaUnit || dto.areaUnit || 'ACRES',
          })),
        });
      }

      return tx.landHolding.findUnique({
        where: { land_id: holding.land_id },
        include: {
          parcels: { orderBy: { survey_number: 'asc' } },
          project: {
            select: {
              project_id: true,
              project_code: true,
              project_name: true,
              status: true,
              description: true,
            },
          },
        },
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'LandHolding',
      entityId: result.land_id,
      newValues: result,
      reason: `Registered land holding with verified subdivision parcels under scheme '${project.project_name}'`,
      ipAddress,
    });

    return result;
  }

  /**
   * Updates an existing land holding and replaces/updates its parcels atomically.
   */
  async updateHoldingWithParcels(
    landId: string,
    dto: UpdateLandHoldingDto,
    userId?: string,
    ipAddress?: string,
  ) {
    const existing = await this.prisma.landHolding.findUnique({
      where: { land_id: landId },
      include: { parcels: true, project: true },
    });
    if (!existing) {
      throw new NotFoundException(`Land holding ${landId} not found`);
    }

    const declared = dto.declaredTotalArea !== undefined
      ? new Decimal(dto.declaredTotalArea)
      : new Decimal(existing.declared_total_area);

    const projectId = dto.projectId || existing.project_id;
    if (dto.projectId && dto.projectId !== existing.project_id) {
      const project = await this.prisma.project.findUnique({
        where: { project_id: dto.projectId },
      });
      if (!project) {
        throw new NotFoundException(`Project Scheme with ID '${dto.projectId}' not found.`);
      }
      if (project.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Project Scheme '${project.project_name}' (${project.project_code}) is inactive.`,
        );
      }
    }

    // If parcels are supplied in update, validate them
    if (dto.parcels && dto.parcels.length > 0) {
      const seenParcels = new Set<string>();
      for (const p of dto.parcels) {
        const key = `${p.surveyNumber.trim().toUpperCase()}#${p.subdivisionNumber.trim().toUpperCase()}`;
        if (seenParcels.has(key)) {
          throw new BadRequestException(
            `Duplicate parcel detected: Survey ${p.surveyNumber.trim()} / Subdivision ${p.subdivisionNumber.trim()} is specified more than once in this land holding.`,
          );
        }
        seenParcels.add(key);
      }

      // Validate uniqueness across existing active land parcels in database
      for (const p of dto.parcels) {
        const sTrim = p.surveyNumber.trim();
        const subTrim = p.subdivisionNumber.trim();
        const existingParcel = await this.prisma.landParcel.findFirst({
          where: {
            survey_number: sTrim,
            subdivision_number: subTrim,
            land_id: { not: landId },
            landHolding: { status: LandStatus.ACTIVE },
          },
          include: {
            landHolding: {
              include: {
                beneficiary: { select: { name: true, phone_number: true } },
              },
            },
          },
        });

        if (existingParcel) {
          const owner = existingParcel.landHolding?.beneficiary?.name || 'another holding';
          throw new BadRequestException(
            `Survey number ${sTrim} with subdivision ${subTrim} is already registered under ${owner} (Holding #${existingParcel.land_id.slice(0, 8)}). Duplicate parcel registration is not permitted.`,
          );
        }
      }

      const sumParcels = DecimalUtil.sum(dto.parcels.map((p) => p.area));
      if (!DecimalUtil.equalsWithTolerance(sumParcels, declared)) {
        throw new BadRequestException(
          `Validation Failed: Sum of parcel areas (${sumParcels.toFixed(4)} ${dto.areaUnit || existing.area_unit}) does not match declared total area (${declared.toFixed(4)} ${dto.areaUnit || existing.area_unit}).`,
        );
      }
    }

    // Atomic update
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.landHolding.update({
        where: { land_id: landId },
        data: {
          project_id: projectId,
          declared_total_area: declared,
          area_unit: dto.areaUnit || existing.area_unit,
          status: dto.status || existing.status,
        },
      });

      if (dto.parcels !== undefined) {
        await tx.landParcel.deleteMany({
          where: { land_id: landId },
        });

        if (dto.parcels.length > 0) {
          await tx.landParcel.createMany({
            data: dto.parcels.map((p) => ({
              land_id: landId,
              survey_number: p.surveyNumber.trim(),
              subdivision_number: p.subdivisionNumber.trim(),
              area: new Decimal(p.area),
              area_unit: p.areaUnit || dto.areaUnit || existing.area_unit,
            })),
          });
        }
      }

      return tx.landHolding.findUnique({
        where: { land_id: landId },
        include: {
          parcels: { orderBy: { survey_number: 'asc' } },
          project: {
            select: {
              project_id: true,
              project_code: true,
              project_name: true,
              status: true,
              description: true,
            },
          },
        },
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'LandHolding',
      entityId: landId,
      oldValues: existing,
      newValues: result,
      reason: `Updated land holding #${landId.slice(0, 8)} with verified subdivision parcels`,
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
        project: {
          select: {
            project_id: true,
            project_code: true,
            project_name: true,
            status: true,
            description: true,
          },
        },
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
      include: {
        waterApplications: true,
        parcels: true,
      },
    });
    if (!existing) {
      throw new NotFoundException('Land holding not found');
    }

    if (existing.status === LandStatus.INACTIVE) {
      throw new BadRequestException('Land holding is already deactivated / archived.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Mark land holding INACTIVE
      const holdingUpdated = await tx.landHolding.update({
        where: { land_id: landId },
        data: { status: LandStatus.INACTIVE },
      });

      // 2. Transition any pending/in-progress water applications on this holding to CANCELLED
      await tx.waterApplication.updateMany({
        where: {
          land_id: landId,
          status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] },
        },
        data: {
          status: 'CANCELLED' as any,
        },
      });

      return holdingUpdated;
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'LandHolding',
      entityId: landId,
      oldValues: { status: existing.status },
      newValues: { status: LandStatus.INACTIVE },
      reason: `Deactivated land holding #${landId.slice(0, 8)} and archived pending water applications`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Immediate Real-Time Check: Verify Survey Number + Subdivision Number Availability.
   * Checks against active parcels across the system, with optional exclusions for edits.
   */
  async checkParcelAvailability(dto: CheckParcelAvailabilityDto) {
    const sTrim = (dto.surveyNumber || '').trim();
    const subTrim = (dto.subdivisionNumber || '').trim();

    if (!sTrim || !subTrim) {
      return {
        available: false,
        status: 'INVALID',
        message: 'Both Survey Number and Subdivision Number are required.',
      };
    }

    const where: any = {
      survey_number: sTrim,
      subdivision_number: subTrim,
      landHolding: { status: LandStatus.ACTIVE },
    };

    const excludeId = dto.currentParcelId || dto.excludeParcelId;
    if (excludeId) {
      where.parcel_id = { not: excludeId };
    }
    if (dto.excludeLandId) {
      where.land_id = { not: dto.excludeLandId };
    }

    const existingParcel = await this.prisma.landParcel.findFirst({
      where,
      include: {
        landHolding: {
          include: {
            beneficiary: { select: { name: true, phone_number: true } },
          },
        },
      },
    });

    if (existingParcel) {
      const owner = existingParcel.landHolding?.beneficiary?.name || 'another holding';
      return {
        available: false,
        status: 'DUPLICATE',
        message: `Survey ${sTrim} / Subdivision ${subTrim} is already registered under ${owner} (Holding #${existingParcel.land_id.slice(0, 8)}).`,
        existingOwner: owner,
        holdingId: existingParcel.land_id,
      };
    }

    return {
      available: true,
      status: 'AVAILABLE',
      message: `Survey ${sTrim} / Subdivision ${subTrim} is available for registration.`,
    };
  }

  /**
   * Safe Delete Land Holding.
   * A holding may only be permanently deleted if it is genuinely unused (no water applications, no allotments, no billing, no payments, no infrastructure).
   * Otherwise, the administrator must deactivate/archive it to preserve historical records.
   */
  async deleteHolding(landId: string, userId?: string, ipAddress?: string) {
    const holding = await this.prisma.landHolding.findUnique({
      where: { land_id: landId },
      include: {
        waterApplications: true,
        parcels: true,
      },
    });

    if (!holding) {
      throw new NotFoundException(`Land holding ${landId} not found`);
    }

    if (holding.waterApplications && holding.waterApplications.length > 0) {
      throw new BadRequestException(
        `This land holding has linked historical records (${holding.waterApplications.length} water application(s)) and cannot be permanently deleted. Please deactivate or archive the holding instead to preserve historical integrity.`,
      );
    }

    // Delete parcels and holding in a single transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.waterApplication.deleteMany({
        where: { land_id: landId },
      });
      await tx.landParcel.deleteMany({
        where: { land_id: landId },
      });
      await tx.landHolding.delete({
        where: { land_id: landId },
      });
    });

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE_VOID,
      entityType: 'LandHolding',
      entityId: landId,
      oldValues: holding,
      reason: `Permanently deleted unused land holding #${landId.slice(0, 8)}`,
      ipAddress,
    });

    return {
      success: true,
      message: `Land holding #${landId.slice(0, 8)} and its parcel records were permanently deleted.`,
    };
  }
}

