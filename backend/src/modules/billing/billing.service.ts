import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInstallmentTemplateDto, GenerateRunningBillDto } from './dto/billing.dto';
import { AuditAction, BillStatus, InfrastructureStatus, InstallmentStatus, Prisma } from '@prisma/client';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a versioned installment template for a project.
   * Enforces: Inst1 + Inst2 + Inst3 + Inst4 + Inst5 == 100.00%
   */
  async createInstallmentTemplate(
    dto: CreateInstallmentTemplateDto,
    createdBy: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const sum = DecimalUtil.sum([dto.inst1Pct, dto.inst2Pct, dto.inst3Pct, dto.inst4Pct, dto.inst5Pct]);
    if (!DecimalUtil.equalsWithTolerance(sum, 100.0, '0.001')) {
      throw new BadRequestException(
        `Validation Failed: Installment schedule must sum to exactly 100.00%. Current sum is ${sum.toFixed(2)}%`,
      );
    }

    const template = await this.prisma.installmentTemplate.create({
      data: {
        project_id: dto.projectId,
        name: dto.name,
        inst_1_pct: new Decimal(dto.inst1Pct),
        inst_2_pct: new Decimal(dto.inst2Pct),
        inst_3_pct: new Decimal(dto.inst3Pct),
        inst_4_pct: new Decimal(dto.inst4Pct),
        inst_5_pct: new Decimal(dto.inst5Pct),
        is_active: true,
        created_by: createdBy,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.INSTALLMENT_SCHEDULE_CHANGED,
      entityType: 'InstallmentTemplate',
      entityId: template.template_id,
      newValues: template,
      reason: 'Created new installment schedule template',
      ipAddress,
    });

    return template;
  }

  async getInstallmentTemplates(projectId?: string) {
    return this.prisma.installmentTemplate.findMany({
      where: projectId ? { project_id: projectId } : undefined,
      orderBy: { created_at: 'desc' },
      include: { project: true },
    });
  }

  async findAllDevelopmentBills(query: { beneficiaryId?: string; status?: BillStatus; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.DevelopmentBillWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.developmentBill.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
          allotment: { select: { allotment_id: true, approved_litres: true, application_id: true } },
          installments: { orderBy: { installment_number: 'asc' } },
        },
      }),
      this.prisma.developmentBill.count({ where }),
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

  async findOneDevelopmentBill(id: string) {
    const bill = await this.prisma.developmentBill.findUnique({
      where: { bill_id: id },
      include: {
        beneficiary: { include: { district: true, panchayat: true, village: true } },
        allotment: { include: { rate: true, infrastructure: true } },
        installments: {
          orderBy: { installment_number: 'asc' },
          include: { payments: { orderBy: { payment_date: 'desc' } } },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Development bill not found');
    }

    return bill;
  }

  async findAllInstallments(query: { billId?: string; status?: InstallmentStatus; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.InstallmentWhereInput = {};
    if (query.billId) where.bill_id = query.billId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.installment.findMany({
        where,
        orderBy: { due_date: 'asc' },
        skip,
        take: limit,
        include: {
          bill: {
            include: {
              beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
            },
          },
          payments: true,
        },
      }),
      this.prisma.installment.count({ where }),
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

  /**
   * CRITICAL REQUIREMENT:
   * Running charges cannot be generated before infrastructure is COMMISSIONED!
   */
  async generateRunningBill(dto: GenerateRunningBillDto, userId?: string, ipAddress?: string) {
    const allotment = await this.prisma.waterAllotment.findUnique({
      where: { allotment_id: dto.allotmentId },
      include: {
        infrastructure: true,
        application: true,
      },
    });

    if (!allotment) {
      throw new NotFoundException(`Water allotment ${dto.allotmentId} not found`);
    }

    // CHECK COMMISSIONING STATUS
    if (!allotment.infrastructure || allotment.infrastructure.status !== InfrastructureStatus.COMMISSIONED) {
      const currentStatus = allotment.infrastructure ? allotment.infrastructure.status : 'NOT_CREATED';
      throw new BadRequestException(
        `CRITICAL VIOLATION: Running charges cannot be generated before infrastructure is commissioned. Current infrastructure status is '${currentStatus}'.`,
      );
    }

    // Fetch active rate configuration for the project
    const rate = await this.prisma.rateConfiguration.findFirst({
      where: { project_id: allotment.application.project_id, is_active: true },
      orderBy: { effective_from: 'desc' },
    });
    if (!rate) {
      throw new BadRequestException('No active rate configuration available to calculate running charges.');
    }

    // Check if running bill for this period already exists
    const existing = await this.prisma.runningBill.findFirst({
      where: {
        allotment_id: dto.allotmentId,
        billing_period: dto.billingPeriod,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A running bill for allotment ${dto.allotmentId} and period '${dto.billingPeriod}' already exists.`,
      );
    }

    // Formula: Running Cost = Approved Litres * Running Cost / L
    const approvedLitresSnapshot = new Decimal(allotment.approved_litres);
    const runningCostPerLitreSnapshot = new Decimal(rate.running_cost_per_litre);
    const totalAmount = DecimalUtil.roundMoney(
      DecimalUtil.mul(approvedLitresSnapshot, runningCostPerLitreSnapshot),
    );

    const bill = await this.prisma.runningBill.create({
      data: {
        allotment_id: allotment.allotment_id,
        beneficiary_id: allotment.beneficiary_id,
        rate_id: rate.rate_id,
        billing_period: dto.billingPeriod,
        approved_litres_snapshot: approvedLitresSnapshot,
        running_cost_per_litre_snapshot: runningCostPerLitreSnapshot,
        amount_due: totalAmount,
        amount_paid: new Decimal(0),
        pending_amount: totalAmount,
        status: BillStatus.PENDING,
      },
      include: {
        allotment: true,
        beneficiary: true,
        rate: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'RunningBill',
      entityId: bill.running_bill_id,
      newValues: bill,
      reason: `Generated running charge bill for period ${dto.billingPeriod}`,
      ipAddress,
    });

    return bill;
  }

  async findAllRunningBills(query: { beneficiaryId?: string; allotmentId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RunningBillWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.allotmentId) where.allotment_id = query.allotmentId;

    const [items, total] = await Promise.all([
      this.prisma.runningBill.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
          allotment: { select: { allotment_id: true, approved_litres: true } },
          rate: true,
          payments: true,
        },
      }),
      this.prisma.runningBill.count({ where }),
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
}
