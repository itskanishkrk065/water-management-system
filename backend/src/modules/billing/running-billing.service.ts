import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { BillingCalendarService } from './billing-calendar.service';
import { RatesService } from '../rates/rates.service';
import { AuditService } from '../audit/audit.service';
import { Decimal } from 'decimal.js';
import { DecimalUtil } from '../common/decimal.util';
import {
  AuditAction,
  AuditEntityType,
  BeneficiaryStatus,
  BillStatus,
  InfrastructureStatus,
  UsageEntryMode,
  WaterUsageStatus,
} from '../common/enums';
import {
  RecordWaterUsageDto,
  GenerateBillFromUsageDto,
  RunningChargesFilterDto,
  ReviewOverAllocationDto,
  VoidUsageRecordDto,
} from './dto/running-charges.dto';
import { Prisma } from '@prisma/client';

export interface RunningChargesEligibility {
  eligible: boolean;
  allotmentId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  phoneNumber?: string;
  districtName?: string;
  villageName?: string;
  infrastructureId?: string;
  infrastructureStatus: string;
  commissionedDate: string | null;
  runningChargeStartDate: string | null;
  billingPeriod: string;
  periodStart: string;
  periodEnd: string;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  isFirstPartialPeriod: boolean;
  approvedLitres: string;
  runningRatePerLitre: string;
  tariffVersion: string;
  tariffId?: string;
  alreadyRecorded: boolean;
  alreadyBilled: boolean;
  existingUsageId?: string;
  existingBillId?: string;
  reason?: string;
}

@Injectable()
export class RunningBillingService {
  private readonly logger = new Logger(RunningBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ApplicationClockService,
    private readonly calendar: BillingCalendarService,
    private readonly ratesService: RatesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Authoritative eligibility service (Part 3, Part 12, Part 13).
   * Verifies infrastructure status is COMMISSIONED, sets running_charge_start_date if null,
   * calculates individual partial first-period usage window vs calendar month.
   */
  async getEligibility(allotmentId: string, billingPeriodCode?: string): Promise<RunningChargesEligibility> {
    const periodCode = billingPeriodCode || this.clock.currentBillingPeriod();
    const { periodStart, periodEnd } = this.clock.getBillingPeriodDates(periodCode);

    const allotment = await this.prisma.waterAllotment.findUnique({
      where: { allotment_id: allotmentId },
      include: {
        beneficiary: {
          include: {
            district: { select: { name: true } },
            village: { select: { name: true } },
          },
        },
        infrastructure: true,
        application: { select: { project_id: true } },
        waterUsageRecords: {
          where: { billingPeriod: { period_code: periodCode } },
          include: { runningBill: true },
        },
      },
    });

    if (!allotment) {
      throw new NotFoundException(`Water allotment '${allotmentId}' not found.`);
    }

    const ben = allotment.beneficiary;
    const infra = allotment.infrastructure;
    let isEligible = true;
    let reason: string | undefined;

    // Rule 1: Beneficiary active
    if (ben.status !== BeneficiaryStatus.ACTIVE) {
      isEligible = false;
      reason = 'Beneficiary account is not active.';
    }

    // Rule 2: Infrastructure must be COMMISSIONED
    else if (!infra || infra.status !== InfrastructureStatus.COMMISSIONED) {
      isEligible = false;
      reason = infra
        ? `Infrastructure status is '${infra.status}' (must be COMMISSIONED).`
        : 'Infrastructure has not been planned or created.';
    }

    // Rule 3: Commissioned date and running charge start date
    let runningStartDate = infra?.running_charge_start_date;
    if (infra && infra.status === InfrastructureStatus.COMMISSIONED) {
      if (!infra.commissioned_date) {
        isEligible = false;
        reason = 'Infrastructure is marked COMMISSIONED but has no commissioned_date recorded.';
      } else {
        // Auto-assign running_charge_start_date = commissioned_date if null
        if (!runningStartDate) {
          runningStartDate = infra.commissioned_date;
          await this.prisma.infrastructure.update({
            where: { infrastructure_id: infra.infrastructure_id },
            data: { running_charge_start_date: runningStartDate },
          });
          this.logger.log(`Infrastructure ${infra.infrastructure_id}: initialized running_charge_start_date to commissioned_date ${runningStartDate.toISOString()}`);
        }

        if (new Date(runningStartDate) > periodEnd) {
          isEligible = false;
          reason = `Running charge start date (${new Date(runningStartDate).toISOString().slice(0, 10)}) is after the end of billing period ${periodCode}.`;
        }
      }
    }

    // Partial first-month usage calculation (Part 12)
    let usagePeriodStart = periodStart;
    let isFirstPartialPeriod = false;

    if (runningStartDate) {
      const rStart = new Date(runningStartDate);
      if (rStart > periodStart && rStart <= periodEnd) {
        usagePeriodStart = rStart;
        isFirstPartialPeriod = true;
      }
    }
    const usagePeriodEnd = periodEnd;

    // Check existing usage records and bills
    const existingUsage = allotment.waterUsageRecords[0];
    const alreadyRecorded = Boolean(existingUsage);
    const alreadyBilled = Boolean(existingUsage?.runningBill || existingUsage?.status === WaterUsageStatus.BILLED);

    // Resolve active running tariff for the scheme
    const effectiveCalcDate = periodEnd;
    let runningRate = '0.50';
    let tariffVersion = 'STANDARD';
    let tariffId: string | undefined;

    try {
      const tariff = await this.ratesService.getApplicableTariff(
        allotment.application.project_id,
        effectiveCalcDate,
        'RUNNING' as any,
      );
      if (tariff && tariff.running_cost_per_litre) {
        runningRate = tariff.running_cost_per_litre.toString();
        tariffVersion = tariff.version_code || 'STANDARD';
        tariffId = tariff.rate_id;
      }
    } catch {
      // Fallback to rate snapshot on allotment if master lookup not found
      const rateConfig = await this.prisma.rateConfiguration.findUnique({
        where: { rate_id: allotment.rate_id },
      });
      if (rateConfig && rateConfig.running_cost_per_litre) {
        runningRate = rateConfig.running_cost_per_litre.toString();
        tariffVersion = rateConfig.version_code || 'STANDARD';
        tariffId = rateConfig.rate_id;
      }
    }

    return {
      eligible: isEligible,
      allotmentId: allotment.allotment_id,
      beneficiaryId: allotment.beneficiary_id,
      beneficiaryName: ben.name,
      phoneNumber: ben.phone_number,
      districtName: ben.district?.name,
      villageName: ben.village?.name,
      infrastructureId: infra?.infrastructure_id,
      infrastructureStatus: infra?.status || 'NOT_PLANNED',
      commissionedDate: infra?.commissioned_date ? infra.commissioned_date.toISOString() : null,
      runningChargeStartDate: runningStartDate ? new Date(runningStartDate).toISOString() : null,
      billingPeriod: periodCode,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      usagePeriodStart: usagePeriodStart.toISOString(),
      usagePeriodEnd: usagePeriodEnd.toISOString(),
      isFirstPartialPeriod,
      approvedLitres: new Decimal(allotment.approved_litres).toFixed(2),
      runningRatePerLitre: runningRate,
      tariffVersion,
      tariffId,
      alreadyRecorded,
      alreadyBilled,
      existingUsageId: existingUsage?.usage_id,
      existingBillId: existingUsage?.runningBill?.running_bill_id,
      reason,
    };
  }

  /**
   * Records physical water usage for a beneficiary and billing period (Part 8, 9, 10, 11).
   * Supports DIRECT and METER_READING entry modes.
   * Gated strictly by infrastructure commissioning.
   */
  async recordWaterUsage(
    dto: RecordWaterUsageDto,
    agentUserId?: string,
    ipAddress?: string,
  ) {
    await this.clock.assertClockValid(agentUserId, ipAddress);

    // 1. Verify eligibility
    const eligibility = await this.getEligibility(dto.allotmentId, dto.billingPeriod);
    if (!eligibility.eligible) {
      throw new BadRequestException(`Beneficiary is not eligible for running charges: ${eligibility.reason}`);
    }

    // 2. Validate and calculate actual usage litres
    let actualUsage: Decimal;

    if (dto.usageEntryMode === UsageEntryMode.METER_READING) {
      if (dto.previousMeterReading === undefined || dto.previousMeterReading === null || isNaN(Number(dto.previousMeterReading))) {
        throw new BadRequestException('Previous meter reading is required for METER_READING mode.');
      }
      if (dto.currentMeterReading === undefined || dto.currentMeterReading === null || isNaN(Number(dto.currentMeterReading))) {
        throw new BadRequestException('Current meter reading is required for METER_READING mode.');
      }

      const prev = new Decimal(dto.previousMeterReading);
      const curr = new Decimal(dto.currentMeterReading);

      if (curr.lt(prev)) {
        throw new BadRequestException(
          `Current meter reading (${curr.toString()} L) cannot be less than previous meter reading (${prev.toString()} L).`,
        );
      }
      actualUsage = curr.minus(prev);
    } else {
      // DIRECT mode
      if (dto.actualUsageLitres === undefined || dto.actualUsageLitres === null || isNaN(Number(dto.actualUsageLitres))) {
        throw new BadRequestException('Actual water usage in litres is required for DIRECT entry mode.');
      }
      actualUsage = new Decimal(dto.actualUsageLitres);
    }

    if (actualUsage.lt(0)) {
      throw new BadRequestException('Actual water usage cannot be negative.');
    }

    // 3. Check for over-allocation warning (Part 11)
    const approvedLitres = new Decimal(eligibility.approvedLitres);
    let status = WaterUsageStatus.RECORDED;
    let overAllocationWarning: string | null = null;

    if (actualUsage.gt(approvedLitres)) {
      const excess = actualUsage.minus(approvedLitres);
      status = WaterUsageStatus.REQUIRES_REVIEW;
      overAllocationWarning = `WARNING: Actual usage (${actualUsage.toFixed(2)} L) exceeds approved allocation (${approvedLitres.toFixed(2)} L) by ${excess.toFixed(2)} L. Authorized review required prior to billing.`;
      this.logger.warn(overAllocationWarning);
    }

    // 4. Resolve applicable tariff and calculate amount
    const runningRate = new Decimal(eligibility.runningRatePerLitre);
    const calculatedAmount = DecimalUtil.roundMoney(actualUsage.times(runningRate));

    // Ensure BillingPeriod record exists
    const billingPeriod = await this.prisma.billingPeriod.findUnique({
      where: { period_code: dto.billingPeriod },
    });
    if (!billingPeriod) {
      throw new NotFoundException(`Billing period '${dto.billingPeriod}' not initialized.`);
    }

    const collectionDate = dto.collectionDate ? new Date(dto.collectionDate) : this.clock.now();

    // 5. Unique check: One usage record per beneficiary/allotment + period (Part 14)
    const existing = await this.prisma.waterUsageRecord.findUnique({
      where: {
        allotment_id_billing_period_id: {
          allotment_id: dto.allotmentId,
          billing_period_id: billingPeriod.billing_period_id,
        },
      },
      include: { runningBill: true },
    });

    if (existing && existing.status === WaterUsageStatus.BILLED) {
      throw new BadRequestException(`Usage for period ${dto.billingPeriod} has already been billed (Bill #${existing.runningBill?.bill_number}). Cannot overwrite billed usage.`);
    }

    let record: any;
    if (existing) {
      // Update existing draft/unbilled usage record
      record = await this.prisma.waterUsageRecord.update({
        where: { usage_id: existing.usage_id },
        data: {
          actual_usage_litres: actualUsage,
          usage_entry_mode: dto.usageEntryMode,
          previous_meter_reading: dto.previousMeterReading !== undefined ? new Decimal(dto.previousMeterReading) : null,
          current_meter_reading: dto.currentMeterReading !== undefined ? new Decimal(dto.currentMeterReading) : null,
          collection_date: collectionDate,
          collection_agent_id: agentUserId || null,
          running_rate_snapshot: runningRate,
          tariff_id: eligibility.tariffId || null,
          tariff_version: eligibility.tariffVersion,
          calculated_amount: calculatedAmount,
          status,
          notes: dto.notes ? `${dto.notes} ${overAllocationWarning || ''}`.trim() : overAllocationWarning,
        },
        include: {
          beneficiary: true,
          allotment: true,
          billingPeriod: true,
        },
      });

      await this.auditService.log({
        userId: agentUserId,
        action: AuditAction.USAGE_UPDATED,
        entityType: AuditEntityType.WATER_USAGE_RECORD,
        entityId: record.usage_id,
        newValues: record,
        reason: `Updated water usage to ${actualUsage.toFixed(2)} L for period ${dto.billingPeriod}`,
        ipAddress,
      });
    } else {
      // Create fresh water usage record
      record = await this.prisma.waterUsageRecord.create({
        data: {
          beneficiary_id: eligibility.beneficiaryId,
          allotment_id: dto.allotmentId,
          infrastructure_id: eligibility.infrastructureId || null,
          billing_period_id: billingPeriod.billing_period_id,
          collection_agent_id: agentUserId || null,
          usage_period_start: new Date(eligibility.usagePeriodStart),
          usage_period_end: new Date(eligibility.usagePeriodEnd),
          collection_date: collectionDate,
          actual_usage_litres: actualUsage,
          approved_litres_snapshot: approvedLitres,
          usage_entry_mode: dto.usageEntryMode,
          previous_meter_reading: dto.previousMeterReading !== undefined ? new Decimal(dto.previousMeterReading) : null,
          current_meter_reading: dto.currentMeterReading !== undefined ? new Decimal(dto.currentMeterReading) : null,
          running_rate_snapshot: runningRate,
          tariff_id: eligibility.tariffId || null,
          tariff_version: eligibility.tariffVersion,
          calculated_amount: calculatedAmount,
          status,
          notes: dto.notes ? `${dto.notes} ${overAllocationWarning || ''}`.trim() : overAllocationWarning,
        },
        include: {
          beneficiary: true,
          allotment: true,
          billingPeriod: true,
        },
      });

      await this.auditService.log({
        userId: agentUserId,
        action: AuditAction.USAGE_RECORDED,
        entityType: AuditEntityType.WATER_USAGE_RECORD,
        entityId: record.usage_id,
        newValues: record,
        reason: `Recorded water usage of ${actualUsage.toFixed(2)} L for period ${dto.billingPeriod}`,
        ipAddress,
      });
    }

    // 6. Immediate bill generation if requested and valid
    let generatedBill: any = null;
    if (dto.generateBillImmediately && status !== WaterUsageStatus.REQUIRES_REVIEW) {
      generatedBill = await this.generateBillFromUsage(record.usage_id, agentUserId, ipAddress);
    }

    return {
      usageRecord: record,
      generatedBill,
      overAllocationWarning,
    };
  }

  /**
   * Generates RunningBill from an authoritative WaterUsageRecord (Part 15, 18, 19, 41, 42).
   * HARD RULE: NO USAGE RECORD = NO BILL.
   * Single authoritative running formula: actualUsageLitres × runningRate = amountDue.
   */
  async generateBillFromUsage(
    usageId: string,
    adminUserId?: string,
    ipAddress?: string,
    options?: { dueDate?: string; overrideOverAllocation?: boolean },
  ) {
    await this.clock.assertClockValid(adminUserId, ipAddress);

    const usage = await this.prisma.waterUsageRecord.findUnique({
      where: { usage_id: usageId },
      include: {
        allotment: { include: { application: true } },
        beneficiary: true,
        billingPeriod: true,
        runningBill: true,
      },
    });

    if (!usage) {
      throw new NotFoundException(`Water usage record '${usageId}' not found. Cannot generate bill without usage.`);
    }

    if (usage.runningBill || usage.status === WaterUsageStatus.BILLED) {
      throw new BadRequestException(`Running bill has already been generated for this usage record (${usage.runningBill?.bill_number || usage.usage_id}).`);
    }

    if (usage.status === WaterUsageStatus.VOIDED) {
      throw new BadRequestException('Cannot generate bill from a VOIDED usage record.');
    }

    if (usage.status === WaterUsageStatus.REQUIRES_REVIEW && !options?.overrideOverAllocation) {
      throw new BadRequestException(
        `Usage record ${usage.usage_id} is flagged for OVER_ALLOCATION review. Administrative approval is required prior to bill generation.`,
      );
    }

    // Double-check no active bill exists for this allotment and billing period
    const existingBill = await this.prisma.runningBill.findFirst({
      where: {
        allotment_id: usage.allotment_id,
        billing_period: usage.billingPeriod.period_code,
        status: { notIn: ['CANCELLED', 'VOIDED'] },
      },
    });
    if (existingBill) {
      throw new BadRequestException(
        `An active running bill (${existingBill.bill_number}) already exists for this beneficiary in period ${usage.billingPeriod.period_code}.`,
      );
    }

    const actualUsageLitres = new Decimal(usage.actual_usage_litres);
    const ratePerLitre = new Decimal(usage.running_rate_snapshot);
    const amountDue = DecimalUtil.roundMoney(actualUsageLitres.times(ratePerLitre));

    const dueDate = options?.dueDate
      ? new Date(options.dueDate)
      : usage.billingPeriod.payment_due_date;

    const breakdown = [
      {
        periodLabel: `${usage.usage_period_start.toISOString().slice(0, 10)} → ${usage.usage_period_end.toISOString().slice(0, 10)}`,
        startDate: usage.usage_period_start.toISOString(),
        endDate: usage.usage_period_end.toISOString(),
        actualUsageLitres: actualUsageLitres.toFixed(2),
        runningRatePerLitre: ratePerLitre.toString(),
        tariffVersion: usage.tariff_version || 'STANDARD',
        tariffId: usage.tariff_id,
        amount: amountDue.toFixed(2),
      },
    ];

    const currentCount = await this.prisma.runningBill.count();
    const year = usage.usage_period_start.getFullYear();
    const billNumber = `RUN-${year}-${String(currentCount + 1).padStart(5, '0')}`;

    // Transactionally create RunningBill and mark WaterUsageRecord BILLED
    const bill = await this.prisma.$transaction(async (tx) => {
      const created = await tx.runningBill.create({
        data: {
          bill_number: billNumber,
          allotment_id: usage.allotment_id,
          beneficiary_id: usage.beneficiary_id,
          rate_id: usage.tariff_id || usage.allotment.rate_id,
          billing_period: usage.billingPeriod.period_code,
          billing_period_id: usage.billing_period_id,
          usage_id: usage.usage_id,
          billing_period_start: usage.usage_period_start,
          billing_period_end: usage.usage_period_end,
          running_charge_start_date_snapshot: usage.usage_period_start,
          commissioned_date_snapshot: usage.usage_period_start,
          tariff_version: usage.tariff_version || 'STANDARD',
          calculation_breakdown: JSON.stringify(breakdown),
          approved_litres_snapshot: usage.approved_litres_snapshot,
          actual_usage_litres_snapshot: actualUsageLitres,
          running_cost_per_litre_snapshot: ratePerLitre,
          amount_due: amountDue,
          amount_paid: new Decimal(0),
          pending_amount: amountDue,
          due_date: dueDate,
          status: BillStatus.PENDING,
          is_legacy: false,
          legacy_classification: null,
        },
      });

      await tx.waterUsageRecord.update({
        where: { usage_id: usage.usage_id },
        data: {
          status: WaterUsageStatus.BILLED,
          verified_at: this.clock.now(),
          verified_by: adminUserId || null,
        },
      });

      return created;
    });

    await this.auditService.log({
      userId: adminUserId,
      action: AuditAction.RUNNING_BILL_CREATED,
      entityType: AuditEntityType.RUNNING_BILL,
      entityId: bill.running_bill_id,
      newValues: bill,
      reason: `Generated Running Bill ${bill.bill_number} for ₹${amountDue.toFixed(2)} from verified usage ${actualUsageLitres.toFixed(2)} L`,
      ipAddress,
    });

    return bill;
  }

  /**
   * Redesigned Running Charges Summary Dashboard metrics (Part 20, 21).
   * Reconciles financial position, collection operations, and actual usage metrics for the selected period.
   */
  async getRunningBillsSummary(query: { billingPeriod?: string; districtId?: string }) {
    const periodCode = query.billingPeriod || this.clock.currentBillingPeriod();
    const today = this.clock.today();

    const whereBills: Prisma.RunningBillWhereInput = {
      billing_period: periodCode,
    };
    const whereUsage: Prisma.WaterUsageRecordWhereInput = {
      billingPeriod: { period_code: periodCode },
    };

    if (query.districtId) {
      whereBills.beneficiary = { district_id: query.districtId };
      whereUsage.beneficiary = { district_id: query.districtId };
    }

    const [
      billStats,
      overdueStats,
      usageStats,
      eligibleInfraCount,
      uniqueUsageCount,
      billsPendingCount,
      billsPaidCount,
    ] = await Promise.all([
      // Financial position for this period
      this.prisma.runningBill.aggregate({
        where: whereBills,
        _count: { running_bill_id: true },
        _sum: {
          amount_due: true,
          amount_paid: true,
          pending_amount: true,
        },
      }),
      // Overdue stats
      this.prisma.runningBill.aggregate({
        where: {
          ...whereBills,
          due_date: { lt: today },
          pending_amount: { gt: 0 },
        },
        _sum: { pending_amount: true },
      }),
      // Usage metrics
      this.prisma.waterUsageRecord.aggregate({
        where: whereUsage,
        _count: { usage_id: true },
        _sum: { actual_usage_litres: true },
        _avg: { actual_usage_litres: true },
      }),
      // Eligible infrastructure count
      this.prisma.infrastructure.count({
        where: {
          status: InfrastructureStatus.COMMISSIONED,
          ...(query.districtId ? { beneficiary: { district_id: query.districtId } } : {}),
        },
      }),
      // Beneficiaries collected
      this.prisma.waterUsageRecord.findMany({
        where: whereUsage,
        select: { beneficiary_id: true },
        distinct: ['beneficiary_id'],
      }),
      // Bills pending payment
      this.prisma.runningBill.count({
        where: {
          ...whereBills,
          status: { in: [BillStatus.PENDING, BillStatus.PARTIALLY_PAID] },
        },
      }),
      // Bills fully paid
      this.prisma.runningBill.count({
        where: {
          ...whereBills,
          status: BillStatus.PAID,
        },
      }),
    ]);

    const totalBilled = billStats._sum.amount_due ? new Decimal(billStats._sum.amount_due) : new Decimal(0);
    const totalPaid = billStats._sum.amount_paid ? new Decimal(billStats._sum.amount_paid) : new Decimal(0);
    const totalPending = billStats._sum.pending_amount ? new Decimal(billStats._sum.pending_amount) : new Decimal(0);
    const totalOverdue = overdueStats._sum.pending_amount ? new Decimal(overdueStats._sum.pending_amount) : new Decimal(0);

    const totalActualUsage = usageStats._sum.actual_usage_litres
      ? new Decimal(usageStats._sum.actual_usage_litres)
      : new Decimal(0);
    const avgUsage = usageStats._avg.actual_usage_litres
      ? new Decimal(usageStats._avg.actual_usage_litres)
      : new Decimal(0);

    const usageRecorded = usageStats._count.usage_id || 0;
    const awaitingCollection = Math.max(0, eligibleInfraCount - usageRecorded);

    return {
      billingPeriod: periodCode,
      // Financial Position
      financials: {
        totalBills: billStats._count.running_bill_id || 0,
        totalBilled: totalBilled.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        totalPending: totalPending.toFixed(2),
        totalOverdue: totalOverdue.toFixed(2),
      },
      // Collection Operations
      operations: {
        eligibleBeneficiaries: eligibleInfraCount,
        usageRecorded,
        awaitingCollection,
        billsGenerated: billStats._count.running_bill_id || 0,
        billsPendingPayment: billsPendingCount,
        billsFullyPaid: billsPaidCount,
      },
      // Usage Analytics
      usage: {
        totalActualUsageLitres: totalActualUsage.toFixed(2),
        averageUsageLitres: avgUsage.toFixed(2),
        beneficiariesCollected: uniqueUsageCount.length,
      },
    };
  }

  /**
   * Retrieves list of WaterUsageRecords with pagination, search, and filtering.
   */
  async getUsageRecords(query: RunningChargesFilterDto) {
    const page = Math.max(1, query.page ? parseInt(query.page, 10) : 1);
    const limit = Math.max(1, Math.min(100, query.limit ? parseInt(query.limit, 10) : 20));
    const skip = (page - 1) * limit;

    const where: Prisma.WaterUsageRecordWhereInput = {};
    if (query.billingPeriod) where.billingPeriod = { period_code: query.billingPeriod };
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.allotmentId) where.allotment_id = query.allotmentId;
    if (query.districtId) where.beneficiary = { district_id: query.districtId };
    if (query.status) where.status = query.status;

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { beneficiary: { name: { contains: search } } },
        { beneficiary: { phone_number: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.waterUsageRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { collection_date: 'desc' },
        include: {
          beneficiary: {
            select: {
              beneficiary_id: true,
              name: true,
              phone_number: true,
              district: { select: { name: true } },
              village: { select: { name: true } },
            },
          },
          allotment: {
            select: {
              allotment_id: true,
              approved_litres: true,
              infrastructure: {
                select: {
                  status: true,
                  commissioned_date: true,
                  running_charge_start_date: true,
                },
              },
            },
          },
          billingPeriod: true,
          collectionAgent: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
            },
          },
          runningBill: {
            select: {
              running_bill_id: true,
              bill_number: true,
              amount_due: true,
              amount_paid: true,
              pending_amount: true,
              status: true,
              due_date: true,
            },
          },
        },
      }),
      this.prisma.waterUsageRecord.count({ where }),
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
   * Retrieves single usage record by ID.
   */
  async findOneUsageRecord(usageId: string) {
    const record = await this.prisma.waterUsageRecord.findUnique({
      where: { usage_id: usageId },
      include: {
        beneficiary: {
          include: { district: true, block: true, panchayat: true, village: true },
        },
        allotment: {
          include: {
            infrastructure: true,
            application: { include: { project: true } },
          },
        },
        billingPeriod: true,
        collectionAgent: true,
        runningBill: {
          include: { payments: { orderBy: { payment_date: 'desc' } } },
        },
      },
    });

    if (!record) {
      throw new NotFoundException(`Usage record '${usageId}' not found.`);
    }

    return record;
  }

  /**
   * Administrative review for OVER_ALLOCATION usage records.
   */
  async reviewOverAllocationUsage(
    usageId: string,
    dto: ReviewOverAllocationDto,
    adminUserId: string,
    ipAddress?: string,
  ) {
    const usage = await this.findOneUsageRecord(usageId);

    if (usage.status !== WaterUsageStatus.REQUIRES_REVIEW && usage.status !== WaterUsageStatus.OVER_ALLOCATION) {
      throw new BadRequestException(`Usage record is in status '${usage.status}'. Review only applies to OVER_ALLOCATION/REQUIRES_REVIEW records.`);
    }

    const newStatus = dto.approved ? WaterUsageStatus.VERIFIED : WaterUsageStatus.VOIDED;
    const updated = await this.prisma.waterUsageRecord.update({
      where: { usage_id: usageId },
      data: {
        status: newStatus,
        verified_at: this.clock.now(),
        verified_by: adminUserId,
        notes: dto.notes ? `${usage.notes || ''} [Review: ${dto.notes}]`.trim() : usage.notes,
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: dto.approved ? AuditAction.USAGE_VERIFIED : AuditAction.USAGE_VOIDED,
      entityType: AuditEntityType.WATER_USAGE_RECORD,
      entityId: usageId,
      oldValues: { status: usage.status },
      newValues: { status: newStatus },
      reason: `Over-allocation usage review: ${dto.approved ? 'Approved' : 'Rejected'} by admin`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Voids an unbilled water usage record with mandatory reason.
   */
  async voidUsageRecord(
    usageId: string,
    dto: VoidUsageRecordDto,
    adminUserId: string,
    ipAddress?: string,
  ) {
    const usage = await this.findOneUsageRecord(usageId);

    if (usage.status === WaterUsageStatus.BILLED) {
      throw new BadRequestException('Cannot void a usage record that has already generated a bill. The bill must be voided first.');
    }

    const updated = await this.prisma.waterUsageRecord.update({
      where: { usage_id: usageId },
      data: {
        status: WaterUsageStatus.VOIDED,
        notes: `${usage.notes || ''} [VOIDED: ${dto.reason}]`.trim(),
      },
    });

    await this.auditService.log({
      userId: adminUserId,
      action: AuditAction.USAGE_VOIDED,
      entityType: AuditEntityType.WATER_USAGE_RECORD,
      entityId: usageId,
      oldValues: { status: usage.status },
      newValues: { status: WaterUsageStatus.VOIDED },
      reason: `Usage record voided: ${dto.reason}`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Finds running bills with server-side pagination, search and filtering.
   */
  async findAllRunningBills(query: RunningChargesFilterDto) {
    const page = Math.max(1, query.page ? parseInt(query.page, 10) : 1);
    const limit = Math.max(1, Math.min(100, query.limit ? parseInt(query.limit, 10) : 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RunningBillWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.allotmentId) where.allotment_id = query.allotmentId;
    if (query.status) where.status = query.status as any;
    if (query.billingPeriod) where.billing_period = query.billingPeriod;
    if (query.districtId) where.beneficiary = { district_id: query.districtId };

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { bill_number: { contains: search } },
        { beneficiary: { name: { contains: search } } },
        { beneficiary: { phone_number: { contains: search } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.runningBill.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: {
            select: {
              beneficiary_id: true,
              name: true,
              phone_number: true,
              district: { select: { name: true } },
              village: { select: { name: true } },
            },
          },
          allotment: {
            select: {
              allotment_id: true,
              approved_litres: true,
              infrastructure: {
                select: {
                  status: true,
                  commissioned_date: true,
                  running_charge_start_date: true,
                },
              },
            },
          },
          waterUsageRecord: {
            select: {
              usage_id: true,
              actual_usage_litres: true,
              usage_entry_mode: true,
              collection_date: true,
              collectionAgent: { select: { full_name: true } },
            },
          },
          rate: {
            select: {
              version_code: true,
              running_cost_per_litre: true,
            },
          },
          payments: {
            orderBy: { payment_date: 'desc' },
            select: {
              payment_id: true,
              amount: true,
              receipt_number: true,
              payment_mode: true,
              payment_date: true,
              status: true,
            },
          },
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

  /**
   * Retrieves single running bill details with calculation breakdown, payments, and usage record.
   */
  async findOneRunningBill(id: string) {
    const bill = await this.prisma.runningBill.findUnique({
      where: { running_bill_id: id },
      include: {
        beneficiary: {
          include: { district: true, block: true, panchayat: true, village: true },
        },
        allotment: {
          include: {
            infrastructure: true,
            application: { include: { project: true } },
          },
        },
        waterUsageRecord: {
          include: { collectionAgent: true },
        },
        rate: true,
        payments: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException(`Running bill '${id}' not found.`);
    }

    return bill;
  }
}
