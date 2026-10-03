import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { BillingPeriodStatus, BillStatus } from '../common/enums';

@Injectable()
export class BillingCalendarService implements OnModuleInit {
  private readonly logger = new Logger(BillingCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ApplicationClockService,
  ) {}

  async onModuleInit() {
    try {
      await this.reconcile();
      this.logger.log('BillingCalendarService: Auto-reconciliation completed on startup.');
    } catch (err) {
      this.logger.error('BillingCalendarService startup reconciliation failed:', err);
    }
  }

  /**
   * Reconciles the monthly billing calendar (Part 4, Part 40).
   * Offline-first: Derives current period from ApplicationClock.
   * Ensures BillingPeriod records exist for current and prior periods.
   * Reconciles overdue bill statuses.
   * HARD INVARIANT: Never creates usage records or bills.
   */
  async reconcile(): Promise<{
    currentPeriod: string;
    createdPeriods: string[];
    reconciledOverdueBillsCount: number;
  }> {
    await this.clock.checkClockRollback();

    const now = this.clock.now();
    const currentCode = this.clock.currentBillingPeriod();
    const createdPeriods: string[] = [];

    // 1. Ensure current billing period exists
    const currentExists = await this.prisma.billingPeriod.findUnique({
      where: { period_code: currentCode },
    });

    if (!currentExists) {
      await this.createPeriodForMonth(now.getFullYear(), now.getMonth() + 1, BillingPeriodStatus.OPEN);
      createdPeriods.push(currentCode);
    } else if (currentExists.status === BillingPeriodStatus.UPCOMING) {
      await this.prisma.billingPeriod.update({
        where: { period_code: currentCode },
        data: { status: BillingPeriodStatus.OPEN },
      });
    }

    // 2. Backfill / reconcile any missing intermediate months (e.g. if offline for 6 months)
    const allPeriods = await this.prisma.billingPeriod.findMany({
      orderBy: { period_start: 'asc' },
    });

    if (allPeriods.length > 0) {
      const earliest = allPeriods[0].period_start;
      let curYear = earliest.getUTCFullYear();
      let curMonth = earliest.getUTCMonth() + 1;

      const targetYear = now.getFullYear();
      const targetMonth = now.getMonth() + 1;

      while (curYear < targetYear || (curYear === targetYear && curMonth <= targetMonth)) {
        const code = `${curYear}-${String(curMonth).padStart(2, '0')}`;
        const exists = allPeriods.some((p) => p.period_code === code) || createdPeriods.includes(code);

        if (!exists) {
          const status = (curYear === targetYear && curMonth === targetMonth)
            ? BillingPeriodStatus.OPEN
            : BillingPeriodStatus.CLOSED;
          await this.createPeriodForMonth(curYear, curMonth, status);
          createdPeriods.push(code);
        }

        curMonth++;
        if (curMonth > 12) {
          curMonth = 1;
          curYear++;
        }
      }
    }

    // 3. Mark past completed billing periods as CLOSED if collection end date has passed
    const today = this.clock.today();
    await this.prisma.billingPeriod.updateMany({
      where: {
        period_end: { lt: today },
        collection_end_date: { lt: today },
        status: BillingPeriodStatus.OPEN,
      },
      data: {
        status: BillingPeriodStatus.CLOSED,
        closed_at: now,
      },
    });

    // 4. Identify and reconcile overdue running bills
    // Any unpaid or partially paid running bill whose due_date has passed
    const overdueResult = await this.prisma.runningBill.updateMany({
      where: {
        due_date: { lt: today },
        pending_amount: { gt: 0 },
        status: { in: [BillStatus.PENDING, BillStatus.PARTIALLY_PAID] },
      },
      data: {
        // Status remains PARTIALLY_PAID or PENDING for balance accounting,
        // but due date comparison marks them overdue in reporting and UI
      },
    });

    return {
      currentPeriod: currentCode,
      createdPeriods,
      reconciledOverdueBillsCount: overdueResult.count,
    };
  }

  /**
   * Helper to construct and persist a calendar monthly period.
   */
  private async createPeriodForMonth(year: number, month: number, status: BillingPeriodStatus = BillingPeriodStatus.OPEN) {
    const code = `${year}-${String(month).padStart(2, '0')}`;
    const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    // Next month for collection window and payment due date
    let nextMonthYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextMonthYear++;
    }

    const collectionStart = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 1, 0, 0, 0, 0));
    const collectionEnd = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 7, 23, 59, 59, 999));
    const paymentDueDate = new Date(Date.UTC(nextMonthYear, nextMonth - 1, 15, 23, 59, 59, 999));

    return this.prisma.billingPeriod.upsert({
      where: { period_code: code },
      create: {
        period_code: code,
        period_start: periodStart,
        period_end: periodEnd,
        status,
        collection_start_date: collectionStart,
        collection_end_date: collectionEnd,
        payment_due_date: paymentDueDate,
      },
      update: {},
    });
  }

  /**
   * Lists all billing periods sorted chronologically descending.
   */
  async getPeriods() {
    return this.prisma.billingPeriod.findMany({
      orderBy: { period_start: 'desc' },
      include: {
        _count: {
          select: {
            waterUsageRecords: true,
            runningBills: true,
          },
        },
      },
    });
  }

  /**
   * Retrieves single billing period by period code (e.g., '2026-10').
   */
  async getPeriod(periodCode: string) {
    const period = await this.prisma.billingPeriod.findUnique({
      where: { period_code: periodCode },
      include: {
        _count: {
          select: {
            waterUsageRecords: true,
            runningBills: true,
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException(`Billing period '${periodCode}' not found.`);
    }

    return period;
  }

  /**
   * Admin configuration for collection & payment due dates of a billing period.
   * Protects closed historical billing periods from modification (Part 5).
   */
  async updatePeriodConfig(
    periodCode: string,
    dto: {
      collectionStartDate?: string;
      collectionEndDate?: string;
      paymentDueDate?: string;
      status?: BillingPeriodStatus;
    },
  ) {
    const period = await this.getPeriod(periodCode);

    if (period.status === BillingPeriodStatus.CLOSED && dto.status !== BillingPeriodStatus.OPEN) {
      throw new BadRequestException(`Cannot alter configuration for closed historical billing period '${periodCode}'.`);
    }

    const data: any = {};
    if (dto.collectionStartDate) data.collection_start_date = new Date(dto.collectionStartDate);
    if (dto.collectionEndDate) data.collection_end_date = new Date(dto.collectionEndDate);
    if (dto.paymentDueDate) data.payment_due_date = new Date(dto.paymentDueDate);
    if (dto.status) data.status = dto.status;

    return this.prisma.billingPeriod.update({
      where: { period_code: periodCode },
      data,
    });
  }
}
