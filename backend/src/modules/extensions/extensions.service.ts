import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExtensionRequestDto, ApproveExtensionDto, CreateLateBeneficiaryDto } from './dto/extension.dto';
import { Prisma } from '@prisma/client';
import { AuditAction, ExtensionStatus, ExtensionType, BillStatus, InstallmentStatus, PaymentStatus } from '../common/enums';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class ExtensionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authoritative eligibility checker for existing beneficiary extensions.
   * Requirement 7: Verified against actual financial settlement of original development.
   */
  async canCreateExtension(beneficiaryId: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: beneficiaryId },
      include: {
        developmentBills: {
          include: {
            installments: true,
          },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${beneficiaryId} not found`);
    }

    // Filter to original development bills (exclude extension bills)
    const originalBills = beneficiary.developmentBills.filter(
      (b) => b.bill_type === 'ORIGINAL_DEVELOPMENT' || (b.allotment_id && !b.extension_id),
    );

    let totalOriginalCost = new Decimal(0);
    let totalOriginalPaid = new Decimal(0);

    for (const bill of originalBills) {
      totalOriginalCost = totalOriginalCost.plus(new Decimal(bill.total_amount || 0));
      totalOriginalPaid = totalOriginalPaid.plus(new Decimal(bill.amount_paid || 0));
    }

    const outstanding = DecimalUtil.roundMoney(DecimalUtil.sub(totalOriginalCost, totalOriginalPaid));

    if (outstanding.greaterThan(0)) {
      return {
        eligible: false,
        reason: 'ORIGINAL_INSTALLMENTS_INCOMPLETE',
        totalOriginalCost: totalOriginalCost.toFixed(2),
        paidAmount: totalOriginalPaid.toFixed(2),
        outstandingAmount: outstanding.toFixed(2),
      };
    }

    return {
      eligible: true,
      reason: 'ELIGIBLE',
      totalOriginalCost: totalOriginalCost.toFixed(2),
      paidAmount: totalOriginalPaid.toFixed(2),
      outstandingAmount: '0.00',
    };
  }

  async create(dto: CreateExtensionRequestDto, userId?: string, ipAddress?: string) {
    // 1. Enforce eligibility for existing beneficiary
    if (!dto.isLateBeneficiary) {
      const eligibility = await this.canCreateExtension(dto.beneficiaryId);
      if (!eligibility.eligible) {
        throw new BadRequestException(
          `Cannot create extension: ${eligibility.reason}. Outstanding original development obligation is ₹${eligibility.outstandingAmount}`,
        );
      }
    }

    let originalAllotmentId: string | null = dto.originalAllotmentId || null;
    if (!originalAllotmentId && !dto.isLateBeneficiary) {
      // Find beneficiary's primary active allotment if not explicitly provided
      const allotment = await this.prisma.waterAllotment.findFirst({
        where: { beneficiary_id: dto.beneficiaryId },
        orderBy: { created_at: 'asc' },
      });
      if (allotment) {
        originalAllotmentId = allotment.allotment_id;
      }
    }

    const extType = dto.extensionType || (
      dto.requestedAdditionalArea && dto.requestedAdditionalLitres
        ? ExtensionType.LAND_AND_WATER
        : dto.requestedAdditionalArea
        ? ExtensionType.ADDITIONAL_LAND
        : ExtensionType.ADDITIONAL_WATER
    );

    const extension = await this.prisma.extension.create({
      data: {
        beneficiary_id: dto.beneficiaryId,
        original_allotment_id: originalAllotmentId,
        extension_type: extType,
        is_late_beneficiary: dto.isLateBeneficiary || false,
        requested_additional_area: new Decimal(dto.requestedAdditionalArea || 0),
        requested_additional_litres: new Decimal(dto.requestedAdditionalLitres || 0),
        survey_number: dto.surveyNumber || null,
        subdivision_number: dto.subdivisionNumber || null,
        district_id: dto.districtId || null,
        block_id: dto.blockId || null,
        panchayat_id: dto.panchayatId || null,
        village_id: dto.villageId || null,
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
      reason: 'Created extension request',
      ipAddress,
    });

    return extension;
  }

  /**
   * Requirement 5: Create a late beneficiary connection after project completion.
   */
  async createLateBeneficiary(dto: CreateLateBeneficiaryDto, userId?: string, ipAddress?: string) {
    const project = await this.prisma.project.findUnique({
      where: { project_id: dto.projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project ${dto.projectId} not found`);
    }

    // Create late beneficiary record
    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        name: dto.name,
        phone_number: dto.phoneNumber,
        district_id: dto.districtId,
        block_id: dto.blockId || null,
        panchayat_id: dto.panchayatId || null,
        village_id: dto.villageId || null,
        is_late_beneficiary: true,
        connection_type: 'LATE_BENEFICIARY',
      },
    });

    // Create extension record for late beneficiary
    const extension = await this.prisma.extension.create({
      data: {
        beneficiary_id: beneficiary.beneficiary_id,
        extension_type: ExtensionType.LATE_BENEFICIARY,
        is_late_beneficiary: true,
        requested_additional_area: new Decimal(dto.landArea),
        requested_additional_litres: new Decimal(dto.requestedLitres),
        survey_number: dto.surveyNumber || null,
        subdivision_number: dto.subdivisionNumber || null,
        district_id: dto.districtId,
        block_id: dto.blockId || null,
        panchayat_id: dto.panchayatId || null,
        village_id: dto.villageId || null,
        status: ExtensionStatus.REQUESTED,
        remarks: dto.remarks || 'Late beneficiary connection request',
      },
      include: {
        beneficiary: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Extension',
      entityId: extension.extension_id,
      newValues: { beneficiary, extension },
      reason: 'Created late beneficiary connection request',
      ipAddress,
    });

    return { beneficiary, extension };
  }

  /**
   * Requirement 6 & 12: Approve extension request, snapshot rates, create development bill and installments.
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
      include: {
        beneficiary: true,
        originalAllotment: { include: { application: true } },
      },
    });

    if (!extension) {
      throw new NotFoundException(`Extension ${id} not found`);
    }
    if (extension.status === ExtensionStatus.APPROVED || extension.status === ExtensionStatus.ACTIVE) {
      throw new BadRequestException('This extension request has already been approved.');
    }

    // Resolve project ID
    let projectId = extension.originalAllotment?.application?.project_id;
    if (!projectId) {
      // Find active project or latest project
      const firstProject = await this.prisma.project.findFirst({ orderBy: { created_at: 'desc' } });
      projectId = firstProject?.project_id;
    }

    if (!projectId) {
      throw new BadRequestException('Unable to resolve project for extension rate calculation.');
    }

    // Fetch active EXTENSION development rate configuration
    const activeRate = await this.prisma.rateConfiguration.findFirst({
      where: { project_id: projectId, is_active: true },
      orderBy: { effective_from: 'desc' },
    });

    if (!activeRate) {
      throw new BadRequestException('No active rate configuration available for extension calculation.');
    }

    const approvedArea = dto.approvedAdditionalArea !== undefined
      ? new Decimal(dto.approvedAdditionalArea)
      : new Decimal(extension.requested_additional_area);

    let approvedLitres = dto.approvedAdditionalLitres !== undefined
      ? new Decimal(dto.approvedAdditionalLitres)
      : new Decimal(extension.requested_additional_litres);

    if (approvedLitres.isZero() && approvedArea.greaterThan(0)) {
      approvedLitres = DecimalUtil.mul(approvedArea, activeRate.litres_per_acre);
    }

    const devCostPerLitre = new Decimal(activeRate.development_cost_per_litre);
    const extensionCost = DecimalUtil.roundMoney(DecimalUtil.mul(approvedLitres, devCostPerLitre));

    const isLate = extension.is_late_beneficiary;
    const installmentCount = isLate ? 5 : 1;

    // Transaction to update extension and create DevelopmentBill + Installments
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create DevelopmentBill for Extension
      const devBill = await tx.developmentBill.create({
        data: {
          extension_id: extension.extension_id,
          allotment_id: extension.original_allotment_id || null,
          beneficiary_id: extension.beneficiary_id,
          bill_type: 'EXTENSION_DEVELOPMENT',
          approved_litres_snapshot: approvedLitres,
          development_cost_per_litre_snapshot: devCostPerLitre,
          total_amount: extensionCost,
          amount_paid: new Decimal(0),
          pending_amount: extensionCost,
          status: BillStatus.PENDING,
        },
      });

      // 2. Create Installments
      if (isLate) {
        // Requirement 5 & 6: Late beneficiary gets 5 installments (2.5%, 20%, 25%, 25%, 27.5%)
        const pcts = [2.5, 20.0, 25.0, 25.0, 27.5];
        let runningSum = new Decimal(0);

        for (let i = 0; i < 5; i++) {
          const isLast = i === 4;
          const pctDecimal = new Decimal(pcts[i]);
          let instAmount: Decimal;

          if (isLast) {
            instAmount = DecimalUtil.sub(extensionCost, runningSum);
          } else {
            instAmount = DecimalUtil.roundMoney(extensionCost.times(pctDecimal).dividedBy(100));
            runningSum = runningSum.plus(instAmount);
          }

          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (i + 1) * 30);

          await tx.installment.create({
            data: {
              bill_id: devBill.bill_id,
              installment_number: i + 1,
              percentage: pctDecimal,
              amount_due: instAmount,
              due_date: dueDate,
              amount_paid: new Decimal(0),
              pending_amount: instAmount,
              status: InstallmentStatus.PENDING,
            },
          });
        }
      } else {
        // Requirement 2 & 6: Existing beneficiary extension gets EXACTLY 1 installment (1/1 = 100%)
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);

        await tx.installment.create({
          data: {
            bill_id: devBill.bill_id,
            installment_number: 1,
            percentage: new Decimal(100.0),
            amount_due: extensionCost,
            due_date: dueDate,
            amount_paid: new Decimal(0),
            pending_amount: extensionCost,
            status: InstallmentStatus.PENDING,
          },
        });
      }

      // 3. Update Extension record
      const updatedExt = await tx.extension.update({
        where: { extension_id: id },
        data: {
          approved_additional_area: approvedArea,
          approved_additional_litres: approvedLitres,
          rate_id: activeRate.rate_id,
          additional_development_cost_per_litre: devCostPerLitre,
          extension_cost: extensionCost,
          installment_count: installmentCount,
          paid_amount: new Decimal(0),
          pending_amount: extensionCost,
          status: ExtensionStatus.APPROVED,
          approved_by: approverEmail,
          approved_at: new Date(),
          remarks: dto.remarks || extension.remarks,
        },
        include: {
          beneficiary: true,
          originalAllotment: true,
          rate: true,
          developmentBills: { include: { installments: true } },
        },
      });

      return updatedExt;
    });

    await this.auditService.log({
      userId,
      action: AuditAction.EXTENSION_APPROVED,
      entityType: 'Extension',
      entityId: id,
      oldValues: extension,
      newValues: result,
      reason: dto.remarks || 'Approved extension request with dedicated rate snapshot and bill',
      ipAddress,
    });

    return result;
  }

  /**
   * Requirement 2, 3, 5: Activate extension only after 100% full financial settlement.
   */
  async activateExtension(id: string, activatedBy: string, userId?: string, ipAddress?: string) {
    const extension = await this.prisma.extension.findUnique({
      where: { extension_id: id },
      include: {
        developmentBills: { include: { installments: true } },
        payments: { where: { status: PaymentStatus.COMPLETED, is_reversal: false } },
      },
    });

    if (!extension) {
      throw new NotFoundException(`Extension ${id} not found`);
    }

    if (extension.status === ExtensionStatus.ACTIVE) {
      return extension; // Already active
    }

    // Verify 100% payment settlement
    const totalCost = new Decimal(extension.extension_cost || 0);
    const paidAmount = new Decimal(extension.paid_amount || 0);

    let allInstallmentsPaid = true;
    for (const bill of extension.developmentBills) {
      for (const inst of bill.installments) {
        if (inst.status !== InstallmentStatus.PAID) {
          allInstallmentsPaid = false;
        }
      }
    }

    if (!allInstallmentsPaid || paidAmount.lessThan(totalCost) || totalCost.isZero()) {
      throw new BadRequestException(
        `Extension cannot be activated until 100% fully paid. Paid: ₹${paidAmount.toFixed(2)}, Cost: ₹${totalCost.toFixed(2)}`,
      );
    }

    const updated = await this.prisma.extension.update({
      where: { extension_id: id },
      data: {
        status: ExtensionStatus.ACTIVE,
        activated_at: new Date(),
        activated_by: activatedBy,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Extension',
      entityId: id,
      oldValues: extension,
      newValues: updated,
      reason: 'Activated extension following full financial settlement',
      ipAddress,
    });

    return updated;
  }

  async reject(id: string, reason: string, approverEmail: string, userId?: string, ipAddress?: string) {
    const extension = await this.prisma.extension.findUnique({ where: { extension_id: id } });
    if (!extension) {
      throw new NotFoundException(`Extension ${id} not found`);
    }

    const updated = await this.prisma.extension.update({
      where: { extension_id: id },
      data: {
        status: ExtensionStatus.REJECTED,
        approved_by: approverEmail,
        approved_at: new Date(),
        remarks: reason || 'Extension rejected',
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.REJECT,
      entityType: 'Extension',
      entityId: id,
      oldValues: extension,
      newValues: updated,
      reason,
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
          developmentBills: { include: { installments: true } },
          payments: true,
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
        developmentBills: { include: { installments: true } },
        payments: true,
      },
    });

    if (!extension) {
      throw new NotFoundException('Extension record not found');
    }

    return extension;
  }
}
