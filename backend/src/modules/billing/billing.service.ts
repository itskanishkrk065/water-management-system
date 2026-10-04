import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RatesService } from '../rates/rates.service';
import {
  CreateInstallmentTemplateDto,
  GenerateRunningBillDto,
  PreviewRunningBillsDto,
  GenerateBatchRunningBillsDto,
} from './dto/billing.dto';
import { Prisma } from '@prisma/client';
import { AuditAction, BillStatus, InfrastructureStatus, InstallmentStatus, BeneficiaryStatus } from '../common/enums';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

export interface RunningBillComponent {
  periodLabel: string;
  startDate: string;
  endDate: string;
  days: number;
  totalDays: number;
  chargeableLitres: string;
  runningRatePerLitre: string;
  tariffVersion: string;
  tariffId: string;
  amount: string;
}

export interface RunningBillPreviewItem {
  allotmentId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  phoneNumber: string;
  districtName: string;
  villageName: string;
  infrastructureStatus: string;
  commissionedDate: string | null;
  runningChargeStartDate: string | null;
  approvedLitres: string;
  billingPeriod: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  alreadyBilled: boolean;
  tariffVersion: string;
  runningRatePerLitre: string;
  calculatedAmount: string;
  components: RunningBillComponent[];
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly ratesService: RatesService,
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

  // =========================================================================
  // RUNNING BILLING ENGINE WITH INDIVIDUAL START DATES & EFFECTIVE TARIFFS
  // =========================================================================

  /**
   * Helper to resolve standard billing period date boundaries
   */
  private resolvePeriodDates(period: string, start?: string, end?: string): { pStart: Date; pEnd: Date } {
    if (start && end) {
      return { pStart: new Date(start), pEnd: new Date(end) };
    }

    // Parse format YYYY-MM e.g. 2026-10
    const ymMatch = period.match(/^(\d{4})-(\d{2})$/);
    if (ymMatch) {
      const year = parseInt(ymMatch[1], 10);
      const month = parseInt(ymMatch[2], 10) - 1; // 0-indexed
      const pStart = new Date(Date.UTC(year, month, 1, 0, 0, 0));
      const pEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59));
      return { pStart, pEnd };
    }

    // Parse format YYYY-Q1..Q4 e.g. 2026-Q1
    const qMatch = period.match(/^(\d{4})-Q([1-4])$/i);
    if (qMatch) {
      const year = parseInt(qMatch[1], 10);
      const q = parseInt(qMatch[2], 10);
      const startMonth = (q - 1) * 3;
      const pStart = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
      const pEnd = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
      return { pStart, pEnd };
    }

    // Default: current month
    const now = new Date();
    const pStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
    const pEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59));
    return { pStart, pEnd };
  }

  /**
   * Generates sequential human-readable Running Bill number
   */
  private generateRunningBillNumber(year: number, sequence: number): string {
    return `RUN-${year}-${String(sequence).padStart(5, '0')}`;
  }

  /**
   * Computes calculation breakdown for a billing period, splitting across tariff changes if needed.
   *
   * Key invariants enforced:
   * 1. Only RUNNING-type rate configurations are used (DEVELOPMENT/TAR rates excluded).
   * 2. Non-overlapping windows: each rate is valid only until the next rate's effective_from
   *    (latest-rate-wins semantics). This prevents double-counting when multiple open-ended
   *    rate rows exist for the same project.
   * 3. effectiveBillingStart respects individual per-beneficiary commissioning dates — if an
   *    infrastructure was commissioned mid-period, billing starts from that date, not pStart.
   */
  private async calculateRunningChargeComponents(
    approvedLitres: Decimal,
    projectId: string,
    pStart: Date,
    pEnd: Date,
    effectiveBillingStart?: Date,
  ): Promise<{
    totalAmount: Decimal;
    primaryTariff: any;
    components: RunningBillComponent[];
  }> {
    // Clamp the billing start to the individual running charge start date.
    // This correctly prorates the first billing period for mid-period commissionings.
    const billingStart = effectiveBillingStart && effectiveBillingStart > pStart
      ? effectiveBillingStart
      : pStart;

    if (billingStart > pEnd) {
      this.logger.warn(`calculateRunningChargeComponents: effectiveBillingStart (${billingStart.toISOString()}) is after pEnd (${pEnd.toISOString()}). Returning zero amount.`);
      return { totalAmount: new Decimal(0), primaryTariff: null, components: [] };
    }

    // CRITICAL: Only query RUNNING-type rate configurations.
    // DEVELOPMENT (TAR-*) rates must never be included in running charge calculations.
    const allRates = await this.prisma.rateConfiguration.findMany({
      where: {
        project_id: projectId,
        rate_type: 'RUNNING',
        effective_from: { lte: pEnd },
        OR: [{ effective_to: null }, { effective_to: { gt: billingStart } }],
      },
      orderBy: { effective_from: 'asc' },
    });

    // Fallback: if no RUNNING-typed rates exist, try any rate with a nonzero running cost
    // (handles legacy data before rate_type was properly set).
    const effectiveRates = allRates.length > 0 ? allRates : await this.prisma.rateConfiguration.findMany({
      where: {
        project_id: projectId,
        running_cost_per_litre: { gt: 0 },
        effective_from: { lte: pEnd },
        OR: [{ effective_to: null }, { effective_to: { gt: billingStart } }],
      },
      orderBy: { effective_from: 'asc' },
    });

    if (effectiveRates.length === 0) {
      const fallbackRate = await this.ratesService.getApplicableTariff('RUNNING', billingStart, projectId);
      const totalAmount = DecimalUtil.roundMoney(
        approvedLitres.times(fallbackRate.running_cost_per_litre),
      );
      const totalDays = Math.max(1, Math.round((pEnd.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      return {
        totalAmount,
        primaryTariff: fallbackRate,
        components: [
          {
            periodLabel: `${billingStart.toISOString().slice(0, 10)} → ${pEnd.toISOString().slice(0, 10)}`,
            startDate: billingStart.toISOString(),
            endDate: pEnd.toISOString(),
            days: totalDays,
            totalDays,
            chargeableLitres: approvedLitres.toFixed(2),
            runningRatePerLitre: fallbackRate.running_cost_per_litre.toString(),
            tariffVersion: fallbackRate.version_code || 'STANDARD',
            tariffId: fallbackRate.rate_id,
            amount: totalAmount.toFixed(2),
          },
        ],
      };
    }

    /**
     * Authoritative Running Charge Quantity Model: Time-Prorated Allocation
     *
     * Non-overlapping window construction (latest-rate-wins):
     * Given rates sorted by effective_from ASC, each rate is valid only until the
     * NEXT rate starts. This prevents double-counting when multiple open-ended
     * rate rows exist for the same project and period.
     *
     * Example:
     *   Rate A: effective_from=Jan, effective_to=null
     *   Rate B: effective_from=Aug, effective_to=null
     *   → Rate A window: Jan → Aug-1 (capped by Rate B start)
     *   → Rate B window: Aug → open
     *   No overlap. No double-counting.
     */

    // Single-rate fast path — prorated by effective billing days if beneficiary started mid-period.
    if (effectiveRates.length === 1) {
      const rate = effectiveRates[0];
      const fullPeriodDays = Math.max(1, Math.round((pEnd.getTime() - pStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const effectiveDays = Math.max(1, Math.round((pEnd.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalDays = effectiveDays;

      // Prorate if billingStart > pStart (mid-period commissioning)
      const ratio = new Decimal(effectiveDays).dividedBy(fullPeriodDays);
      const chargeableLitres = billingStart > pStart
        ? approvedLitres.times(ratio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        : approvedLitres;

      const totalAmount = DecimalUtil.roundMoney(
        chargeableLitres.times(rate.running_cost_per_litre),
      );

      return {
        totalAmount,
        primaryTariff: rate,
        components: [
          {
            periodLabel: `${billingStart.toISOString().slice(0, 10)} → ${pEnd.toISOString().slice(0, 10)}`,
            startDate: billingStart.toISOString(),
            endDate: pEnd.toISOString(),
            days: totalDays,
            totalDays,
            chargeableLitres: chargeableLitres.toFixed(2),
            runningRatePerLitre: rate.running_cost_per_litre.toString(),
            tariffVersion: rate.version_code || 'STANDARD',
            tariffId: rate.rate_id,
            amount: totalAmount.toFixed(2),
          },
        ],
      };
    }

    // MULTI-TARIFF SPLIT: build non-overlapping time windows across the billing period.
    // totalDays is computed over [billingStart, pEnd] (respects individual start date).
    const totalDays = Math.max(1, Math.round((pEnd.getTime() - billingStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const components: RunningBillComponent[] = [];
    let cumulativeAmount = new Decimal(0);

    for (let i = 0; i < effectiveRates.length; i++) {
      const rate = effectiveRates[i];
      const nextRate = effectiveRates[i + 1];
      const rateEffFrom = new Date(rate.effective_from);

      // LATEST-RATE-WINS: this rate's effective end is the earlier of:
      //   a) Its own effective_to
      //   b) The next rate's effective_from (when next rate supersedes this one)
      // This is the key fix preventing double-counting of overlapping rates.
      let rateWindowEnd: Date | null = rate.effective_to ? new Date(rate.effective_to) : null;
      if (nextRate) {
        const nextStart = new Date(nextRate.effective_from);
        rateWindowEnd = rateWindowEnd ? (nextStart < rateWindowEnd ? nextStart : rateWindowEnd) : nextStart;
      }

      // Intersect the rate's non-overlapping window with [billingStart, pEnd]
      const segStart = rateEffFrom > billingStart ? rateEffFrom : billingStart;
      const segEndRaw = rateWindowEnd && rateWindowEnd <= pEnd ? rateWindowEnd : pEnd;
      // segEnd is inclusive: if rateWindowEnd is exclusive (next rate starts exactly here),
      // subtract 1 millisecond to keep segments non-overlapping.
      const segEnd = (rateWindowEnd && rateWindowEnd.getTime() === segEndRaw.getTime() && nextRate)
        ? new Date(segEndRaw.getTime() - 1)
        : segEndRaw;

      if (segStart > pEnd || segEnd < billingStart) continue; // Window is entirely outside billing period

      const segDays = Math.max(1, Math.round((segEnd.getTime() - segStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const segRatio = new Decimal(segDays).dividedBy(totalDays);
      const segLitres = approvedLitres.times(segRatio).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const segAmount = segLitres.times(rate.running_cost_per_litre).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      cumulativeAmount = cumulativeAmount.plus(segAmount);

      components.push({
        periodLabel: `${segStart.toISOString().slice(0, 10)} → ${segEnd.toISOString().slice(0, 10)}`,
        startDate: segStart.toISOString(),
        endDate: segEnd.toISOString(),
        days: segDays,
        totalDays,
        chargeableLitres: segLitres.toFixed(2),
        runningRatePerLitre: rate.running_cost_per_litre.toString(),
        tariffVersion: rate.version_code || `RATE-${i + 1}`,
        tariffId: rate.rate_id,
        amount: segAmount.toFixed(2),
      });
    }

    const primaryTariff = effectiveRates[effectiveRates.length - 1];
    return {
      totalAmount: DecimalUtil.roundMoney(cumulativeAmount),
      primaryTariff,
      components,
    };
  }

  /**
   * Previews running bills generation for a given billing period.
   * Displays individual running start dates, eligibility, and multi-tier calculation breakdowns.
   */
  async previewRunningBills(dto: PreviewRunningBillsDto): Promise<RunningBillPreviewItem[]> {
    const { pStart, pEnd } = this.resolvePeriodDates(dto.billingPeriod, dto.billingPeriodStart, dto.billingPeriodEnd);

    const whereAllotment: Prisma.WaterAllotmentWhereInput = {};
    if (dto.beneficiaryId) whereAllotment.beneficiary_id = dto.beneficiaryId;
    if (dto.districtId) {
      whereAllotment.beneficiary = { district_id: dto.districtId };
    }

    const allotments = await this.prisma.waterAllotment.findMany({
      where: whereAllotment,
      include: {
        beneficiary: { include: { district: true, village: true } },
        application: { include: { project: true } },
        infrastructure: true,
        runningBills: {
          where: { billing_period: dto.billingPeriod },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const previewList: RunningBillPreviewItem[] = [];

    for (const allot of allotments) {
      const infra = allot.infrastructure;
      const ben = allot.beneficiary;
      const approvedLitres = new Decimal(allot.approved_litres);
      const projectId = allot.application.project_id;

      let isEligible = true;
      let ineligibilityReason: string | undefined;

      // Rule 1: Beneficiary must be active
      if (ben.status !== BeneficiaryStatus.ACTIVE) {
        isEligible = false;
        ineligibilityReason = 'Beneficiary is inactive';
      }

      // Rule 2: Infrastructure must exist and be COMMISSIONED
      else if (!infra || infra.status !== InfrastructureStatus.COMMISSIONED) {
        isEligible = false;
        ineligibilityReason = infra
          ? `Infrastructure status is '${infra.status}' (must be COMMISSIONED)`
          : 'Infrastructure not created';
      }

      // Rule 3: Individual running charge start date check
      else {
        const runningStartDate = infra.running_charge_start_date || infra.commissioned_date;
        if (!runningStartDate) {
          isEligible = false;
          ineligibilityReason = 'Running charge start date is not configured';
        } else if (new Date(runningStartDate) > pEnd) {
          isEligible = false;
          ineligibilityReason = `Running charges start on ${new Date(runningStartDate).toISOString().slice(0, 10)} (after billing period)`;
        }
      }

      const alreadyBilled = allot.runningBills.length > 0;
      if (alreadyBilled && isEligible) {
        isEligible = false;
        ineligibilityReason = `Already billed for period '${dto.billingPeriod}'`;
      }

      // Determine the effective billing start date for this individual beneficiary.
      // If their infrastructure was commissioned mid-period, they are only charged from
      // the running_charge_start_date, NOT from the start of the billing period.
      const runningStartDate = infra?.running_charge_start_date || infra?.commissioned_date;
      const effectiveBillingStart = runningStartDate ? new Date(runningStartDate) : pStart;

      // Calculate calculation breakdown (individual start date passed for mid-period proration)
      const { totalAmount, primaryTariff, components } = await this.calculateRunningChargeComponents(
        approvedLitres,
        projectId,
        pStart,
        pEnd,
        effectiveBillingStart,
      );

      previewList.push({
        allotmentId: allot.allotment_id,
        beneficiaryId: allot.beneficiary_id,
        beneficiaryName: ben.name,
        phoneNumber: ben.phone_number,
        districtName: ben.district?.name || '—',
        villageName: ben.village?.name || '—',
        infrastructureStatus: infra ? infra.status : 'NOT_PLANNED',
        commissionedDate: infra?.commissioned_date ? infra.commissioned_date.toISOString() : null,
        runningChargeStartDate: infra?.running_charge_start_date ? infra.running_charge_start_date.toISOString() : (infra?.commissioned_date ? infra.commissioned_date.toISOString() : null),
        approvedLitres: approvedLitres.toFixed(2),
        billingPeriod: dto.billingPeriod,
        billingPeriodStart: pStart.toISOString(),
        billingPeriodEnd: pEnd.toISOString(),
        isEligible,
        ineligibilityReason,
        alreadyBilled,
        tariffVersion: primaryTariff?.version_code || 'STANDARD',
        runningRatePerLitre: primaryTariff?.running_cost_per_litre?.toString() || '0',
        calculatedAmount: totalAmount.toFixed(2),
        components,
      });
    }

    return previewList;
  }

  /**
   * Transactionally generates a batch of running bills based on verified eligibility.
   * Snapshots tariffs and calculation inputs immutably.
   */
  async generateBatchRunningBills(
    dto: GenerateBatchRunningBillsDto,
    adminUserId: string,
    ipAddress?: string,
  ) {
    const { pStart, pEnd } = this.resolvePeriodDates(dto.billingPeriod, dto.billingPeriodStart, dto.billingPeriodEnd);
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : new Date(pEnd.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days default grace

    const preview = await this.previewRunningBills({
      billingPeriod: dto.billingPeriod,
      billingPeriodStart: pStart.toISOString(),
      billingPeriodEnd: pEnd.toISOString(),
      districtId: dto.districtId,
    });

    const eligibleItems = preview.filter((p) => {
      if (!p.isEligible) return false;
      if (dto.allotmentIds && dto.allotmentIds.length > 0) {
        return dto.allotmentIds.includes(p.allotmentId);
      }
      return true;
    });

    if (eligibleItems.length === 0) {
      throw new BadRequestException('No eligible beneficiaries found to generate running bills for this period.');
    }

    const year = pStart.getFullYear();

    const createdBills = await this.prisma.$transaction(async (tx) => {
      const results: any[] = [];

      for (const item of eligibleItems) {
        let created: any = null;
        let attempts = 0;

        while (!created && attempts < 10) {
          attempts++;
          const prefix = `RUN-${year}-`;
          const lastBill = typeof tx.runningBill?.findFirst === 'function' ? await tx.runningBill.findFirst({
            where: { bill_number: { startsWith: prefix } },
            orderBy: { bill_number: 'desc' },
            select: { bill_number: true },
          }) : null;

          let maxSeq = 0;
          if (lastBill && lastBill.bill_number) {
            const match = lastBill.bill_number.match(/RUN-\d{4}-(\d+)/);
            if (match) {
              maxSeq = parseInt(match[1], 10);
            }
          }

          const count = await tx.runningBill.count({
            where: { bill_number: { startsWith: prefix } },
          });

          const nextSeq = Math.max(maxSeq, count) + (attempts - 1) + 1;
          const candidateNumber = this.generateRunningBillNumber(year, nextSeq);

          try {
            created = await tx.runningBill.create({
              data: {
                bill_number: candidateNumber,
                allotment_id: item.allotmentId,
                beneficiary_id: item.beneficiaryId,
                rate_id: item.components[0]?.tariffId,
                billing_period: item.billingPeriod,
                billing_period_start: new Date(item.billingPeriodStart),
                billing_period_end: new Date(item.billingPeriodEnd),
                running_charge_start_date_snapshot: item.runningChargeStartDate ? new Date(item.runningChargeStartDate) : null,
                commissioned_date_snapshot: item.commissionedDate ? new Date(item.commissionedDate) : null,
                tariff_version: item.tariffVersion,
                calculation_breakdown: JSON.stringify(item.components),
                approved_litres_snapshot: new Decimal(item.approvedLitres),
                running_cost_per_litre_snapshot: new Decimal(item.runningRatePerLitre),
                amount_due: new Decimal(item.calculatedAmount),
                amount_paid: new Decimal(0),
                pending_amount: new Decimal(item.calculatedAmount),
                due_date: dueDate,
                status: BillStatus.PENDING,
              },
            });
          } catch (err: any) {
            if (err.code === 'P2002' && (err.meta?.target?.includes('bill_number') || String(err.message).includes('bill_number'))) {
              continue;
            }
            throw err;
          }
        }

        if (created) {
          results.push(created);
        }
      }

      return results;
    });

    await this.auditService.log({
      userId: adminUserId,
      action: AuditAction.CREATE,
      entityType: 'RunningBillBatch',
      entityId: `BATCH-${Date.now()}`,
      newValues: { count: createdBills.length, period: dto.billingPeriod, billIds: createdBills.map((b) => b.running_bill_id) },
      reason: `Batch generated ${createdBills.length} running charge bills for period ${dto.billingPeriod}`,
      ipAddress,
    });

    return {
      generatedCount: createdBills.length,
      billingPeriod: dto.billingPeriod,
      bills: createdBills,
    };
  }

  /**
   * Generates a single running bill for an individual allotment.
   */
  async generateRunningBill(dto: GenerateRunningBillDto, userId?: string, ipAddress?: string) {
    const res = await this.generateBatchRunningBills(
      {
        billingPeriod: dto.billingPeriod,
        billingPeriodStart: dto.billingPeriodStart,
        billingPeriodEnd: dto.billingPeriodEnd,
        dueDate: dto.dueDate,
        allotmentIds: [dto.allotmentId],
      },
      userId || 'admin',
      ipAddress,
    );

    return res.bills[0];
  }

  /**
   * Retrieves high-level running bills dashboard/summary metrics
   */
  async getRunningBillsSummary(query?: { billingPeriod?: string; districtId?: string }) {
    const where: Prisma.RunningBillWhereInput = {};
    if (query?.billingPeriod) where.billing_period = query.billingPeriod;
    if (query?.districtId) where.beneficiary = { district_id: query.districtId };

    const [totalStats, currentPeriodStats, overdueStats, uniqueBens] = await Promise.all([
      this.prisma.runningBill.aggregate({
        where,
        _count: { running_bill_id: true },
        _sum: {
          amount_due: true,
          amount_paid: true,
          pending_amount: true,
        },
      }),
      query?.billingPeriod
        ? this.prisma.runningBill.aggregate({
            where: { billing_period: query.billingPeriod },
            _sum: { amount_due: true },
          })
        : Promise.resolve({ _sum: { amount_due: null } }),
      this.prisma.runningBill.aggregate({
        where: {
          ...where,
          due_date: { lt: new Date() },
          pending_amount: { gt: 0 },
        },
        _sum: { pending_amount: true },
      }),
      this.prisma.runningBill.findMany({
        where,
        select: { beneficiary_id: true },
        distinct: ['beneficiary_id'],
      }),
    ]);

    return {
      totalBills: totalStats._count.running_bill_id || 0,
      totalAmount: totalStats._sum.amount_due?.toString() || '0.00',
      totalPaid: totalStats._sum.amount_paid?.toString() || '0.00',
      totalPending: totalStats._sum.pending_amount?.toString() || '0.00',
      currentPeriodCharges: currentPeriodStats._sum.amount_due?.toString() || totalStats._sum.amount_due?.toString() || '0.00',
      overdueAmount: overdueStats._sum.pending_amount?.toString() || '0.00',
      activeBeneficiariesCount: uniqueBens.length,
    };
  }

  /**
   * Finds running bills with server-side pagination, search and filtering.
   */
  async findAllRunningBills(query: {
    beneficiaryId?: string;
    allotmentId?: string;
    status?: BillStatus;
    billingPeriod?: string;
    districtId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.RunningBillWhereInput = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.allotmentId) where.allotment_id = query.allotmentId;
    if (query.status) where.status = query.status;
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
              panchayat: { select: { name: true } },
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
          rate: {
            select: {
              version_code: true,
              effective_from: true,
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
   * Retrieves single running bill details with calculation breakdown and payment history.
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
        rate: true,
        payments: {
          orderBy: { payment_date: 'desc' },
        },
      },
    });

    if (!bill) {
      throw new NotFoundException('Running bill not found');
    }

    return bill;
  }
}
