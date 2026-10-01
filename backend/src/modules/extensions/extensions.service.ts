import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExtensionRequestDto, ApproveExtensionDto } from './dto/extension.dto';
import { Prisma } from '@prisma/client';
import { AuditAction, ExtensionStatus } from '../common/enums';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class ExtensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateExtensionRequestDto, userId?: string, ipAddress?: string) {
    const allotment = await this.prisma.waterAllotment.findUnique({
      where: { allotment_id: dto.originalAllotmentId },
    });
    if (!allotment) {
      throw new NotFoundException(`Original allotment ${dto.originalAllotmentId} not found`);
    }

    const extension = await this.prisma.extension.create({
      data: {
        beneficiary_id: dto.beneficiaryId,
        original_allotment_id: dto.originalAllotmentId,
        requested_additional_area: new Decimal(dto.requestedAdditionalArea),
        requested_additional_litres: new Decimal(dto.requestedAdditionalLitres),
        status: ExtensionStatus.REQUESTED,
        remarks: dto.remarks || null,
      },
      include: {
        beneficiary: true,
        originalAllotment: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Extension',
      entityId: extension.extension_id,
      newValues: extension,
      reason: 'Created extension request for additional water/land',
      ipAddress,
    });

    return extension;
  }

  /**
   * CRITICAL REQUIREMENT:
   * Approving an extension creates a new isolated transaction and NEVER mutates the original allotment!
   */
  async approve(
    id: string,
    dto: ApproveExtensionDto,
    approverEmail: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const extension = await this.prisma.extension.findUnique({
      where: { extension_id: id },
      include: { originalAllotment: { include: { application: true } } },
    });

    if (!extension) {
      throw new NotFoundException(`Extension ${id} not found`);
    }
    if (extension.status === ExtensionStatus.APPROVED) {
      throw new BadRequestException('This extension request has already been approved.');
    }

    // Fetch active rate configuration
    const activeRate = await this.prisma.rateConfiguration.findFirst({
      where: { project_id: extension.originalAllotment.application.project_id, is_active: true },
      orderBy: { effective_from: 'desc' },
    });
    if (!activeRate) {
      throw new BadRequestException('No active rate configuration available for extension calculation.');
    }

    const approvedArea = new Decimal(dto.approvedAdditionalArea);
    const approvedLitres = new Decimal(dto.approvedAdditionalLitres);
    const devCostPerLitre = new Decimal(activeRate.development_cost_per_litre);

    // Formula: Extension Cost = Approved Additional Litres * Dev Cost / L
    const extensionCost = DecimalUtil.roundMoney(DecimalUtil.mul(approvedLitres, devCostPerLitre));

    const updated = await this.prisma.extension.update({
      where: { extension_id: id },
      data: {
        approved_additional_area: approvedArea,
        approved_additional_litres: approvedLitres,
        rate_id: activeRate.rate_id,
        additional_development_cost_per_litre: devCostPerLitre,
        extension_cost: extensionCost,
        status: ExtensionStatus.APPROVED,
        approved_by: approverEmail,
        approved_at: new Date(),
        remarks: dto.remarks || extension.remarks,
      },
      include: {
        beneficiary: true,
        originalAllotment: true,
        rate: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.EXTENSION_APPROVED,
      entityType: 'Extension',
      entityId: id,
      oldValues: extension,
      newValues: updated,
      reason: dto.remarks || 'Approved extension request without mutating original allotment',
      ipAddress,
    });

    return updated;
  }

  async findAll(query: { beneficiaryId?: string; status?: ExtensionStatus; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ExtensionWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.extension.findMany({
        where,
        orderBy: { requested_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
          originalAllotment: { select: { allotment_id: true, approved_litres: true } },
          rate: true,
        },
      }),
      this.prisma.extension.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const extension = await this.prisma.extension.findUnique({
      where: { extension_id: id },
      include: {
        beneficiary: true,
        originalAllotment: { include: { rate: true } },
        rate: true,
        payments: true,
      },
    });

    if (!extension) {
      throw new NotFoundException('Extension record not found');
    }

    return extension;
  }
}
