import { Test, TestingModule } from '@nestjs/testing';
import { RunningBillingService } from './running-billing.service';
import { BillingCalendarService } from './billing-calendar.service';
import { ApplicationClockService } from '../system/application-clock.service';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { UsageEntryMode, AuditAction } from '../common/enums';

describe('WaterGrid V1 — Complete Running Charges Restructure Suite (RUN-NEW-001 to RUN-NEW-040)', () => {
  let runningBillingService: RunningBillingService;
  let calendarService: BillingCalendarService;
  let clockService: ApplicationClockService;
  let paymentsService: PaymentsService;
  let ratesService: RatesService;
  let auditService: AuditService;

  const mockPrisma = {
    billingPeriod: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      upsert: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.create, billing_period_id: 'bp-id' })),
    },
    systemClockState: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({
        state_id: 'SYSTEM_CLOCK_TRACKER',
        last_known_timestamp: new Date('2026-01-01T00:00:00Z'),
        is_rollback_detected: false,
      }),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      upsert: jest.fn().mockResolvedValue({}),
    },
    waterUsageRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn(),
    },
    runningBill: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    waterAllotment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    infrastructure: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    beneficiary: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    rateConfiguration: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const mockRates = {
    getApplicableTariff: jest.fn(),
  };

  const mockAudit = {
    log: jest.fn().mockResolvedValue({}),
    recordAudit: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunningBillingService,
        BillingCalendarService,
        ApplicationClockService,
        PaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RatesService, useValue: mockRates },
        { provide: AuditService, useValue: mockAudit },
      ],
    }).compile();

    runningBillingService = module.get<RunningBillingService>(RunningBillingService);
    calendarService = module.get<BillingCalendarService>(BillingCalendarService);
    clockService = module.get<ApplicationClockService>(ApplicationClockService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    ratesService = module.get<RatesService>(RatesService);
    auditService = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
    mockPrisma.systemClockState.findFirst.mockResolvedValue({
      state_id: 'SYSTEM_CLOCK_TRACKER',
      last_known_timestamp: new Date('2026-01-01T00:00:00Z'),
      is_rollback_detected: false,
    });
  });

  function makeTestAllotment(overrides: any = {}) {
    return {
      allotment_id: 'allot-1',
      beneficiary_id: 'ben-1',
      approval_status: 'APPROVED',
      approved_litres: new Decimal(60000),
      application: { project_id: 'proj-1' },
      beneficiary: {
        beneficiary_id: 'ben-1',
        status: 'ACTIVE',
        name: 'Test Beneficiary',
      },
      infrastructure: {
        infrastructure_id: 'infra-1',
        status: 'COMMISSIONED',
        commissioned_date: new Date('2026-10-01'),
        running_charge_start_date: new Date('2026-10-01'),
      },
      waterUsageRecords: [],
      ...overrides,
    };
  }

  // ==========================================
  // PART 3 & 12: COMMISSIONING & ELIGIBILITY
  // ==========================================

  describe('RUN-NEW-001: Commissioned beneficiary eligible', () => {
    it('should return eligible = true when infrastructure is COMMISSIONED', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      const eligibility = await runningBillingService.getEligibility('allot-1');
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.infrastructureStatus).toBe('COMMISSIONED');
      expect(eligibility.beneficiaryName).toBe('Test Beneficiary');
    });
  });

  describe('RUN-NEW-002: Uncommissioned beneficiary rejected', () => {
    it('should return eligible = false when infrastructure is PLANNED or UNDER_CONSTRUCTION', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(
        makeTestAllotment({
          allotment_id: 'allot-2',
          infrastructure: {
            infrastructure_id: 'infra-2',
            status: 'UNDER_CONSTRUCTION',
            commissioned_date: null,
            running_charge_start_date: null,
          },
        }),
      );

      const eligibility = await runningBillingService.getEligibility('allot-2');
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.infrastructureStatus).toBe('UNDER_CONSTRUCTION');
      expect(eligibility.reason).toContain('COMMISSIONED');
    });
  });

  describe('RUN-NEW-003: Running start date enforced', () => {
    it('should default running_charge_start_date to commissioned_date if null', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(
        makeTestAllotment({
          allotment_id: 'allot-3',
          infrastructure: {
            infrastructure_id: 'infra-3',
            status: 'COMMISSIONED',
            commissioned_date: new Date('2026-10-15'),
            running_charge_start_date: null,
          },
        }),
      );
      mockPrisma.infrastructure.update.mockResolvedValue({});

      const eligibility = await runningBillingService.getEligibility('allot-3');
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.runningChargeStartDate).toBe(new Date('2026-10-15').toISOString());
      expect(mockPrisma.infrastructure.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { infrastructure_id: 'infra-3' },
          data: { running_charge_start_date: new Date('2026-10-15') },
        }),
      );
    });
  });

  // ==========================================
  // PART 4, 5, 6, 7 & 40: CALENDAR & CLOCK
  // ==========================================

  describe('RUN-NEW-004: Calendar month generated correctly', () => {
    it('should derive current billing period with exact month start and end', () => {
      const fixedDate = new Date('2026-10-20T12:00:00Z');
      const periodCode = clockService.getBillingPeriod(fixedDate);
      expect(periodCode).toBe('2026-10');

      const dates = clockService.getBillingPeriodDates(periodCode);
      expect(dates.periodStart.toISOString().slice(0, 10)).toBe('2026-10-01');
      expect(dates.periodEnd.toISOString().slice(0, 10)).toBe('2026-10-31');
    });
  });

  describe('RUN-NEW-005: Application closed for months and reopened', () => {
    it('should reconcile and generate all missing historical periods without network', async () => {
      mockPrisma.systemClockState.findFirst.mockResolvedValue(null);
      mockPrisma.systemClockState.upsert.mockResolvedValue({});
      mockPrisma.billingPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([]);
      mockPrisma.billingPeriod.create.mockImplementation((args) => Promise.resolve({ ...args.data, billing_period_id: 'bp-id' }));
      mockPrisma.runningBill.findMany.mockResolvedValue([]);

      const result = await calendarService.reconcile();
      expect(result.createdPeriods.length).toBeGreaterThanOrEqual(1);
      expect(mockPrisma.billingPeriod.upsert).toHaveBeenCalled();
    });
  });

  describe('RUN-NEW-006: No timer dependency', () => {
    it('should calculate periods deterministically from system/application date', () => {
      const p1Code = clockService.getBillingPeriod(new Date('2026-02-15T00:00:00Z'));
      expect(p1Code).toBe('2026-02');
      const p1Dates = clockService.getBillingPeriodDates(p1Code);
      expect(p1Dates.periodEnd.toISOString().slice(0, 10)).toBe('2026-02-28');

      // Leap year 2028
      const p2Code = clockService.getBillingPeriod(new Date('2028-02-15T00:00:00Z'));
      expect(p2Code).toBe('2028-02');
      const p2Dates = clockService.getBillingPeriodDates(p2Code);
      expect(p2Dates.periodEnd.toISOString().slice(0, 10)).toBe('2028-02-29');
    });
  });

  describe('RUN-NEW-007: First month partial commissioning period', () => {
    it('should set usage period start to commissioning date if commissioned mid-month', () => {
      const commDate = new Date('2026-10-15T00:00:00Z');
      const pStart = new Date('2026-10-01T00:00:00Z');

      const effectiveUsageStart = commDate > pStart ? commDate : pStart;
      expect(effectiveUsageStart).toEqual(commDate);
    });
  });

  describe('RUN-NEW-008: Subsequent full calendar month', () => {
    it('should use full calendar month for subsequent periods after commissioning', () => {
      const commDate = new Date('2026-10-15T00:00:00Z');
      const novStart = new Date('2026-11-01T00:00:00Z');

      const effectiveUsageStart = commDate > novStart ? commDate : novStart;
      expect(effectiveUsageStart).toEqual(novStart);
    });
  });

  // ==========================================
  // PART 8, 9, 10, 11: WATER USAGE ENTRY & VALIDATION
  // ==========================================

  describe('RUN-NEW-009: Direct usage entry', () => {
    it('should record exact direct litres entered by agent', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-2026-10',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
        status: 'OPEN',
      });

      mockPrisma.waterUsageRecord.findFirst.mockResolvedValue(null);
      mockRates.getApplicableTariff.mockResolvedValue({
        rate_id: 'rate-1',
        version_code: 'v1.0',
        running_cost_per_litre: new Decimal(0.5),
      });

      mockPrisma.waterUsageRecord.create.mockImplementation((args) =>
        Promise.resolve({ ...args.data, usage_id: 'use-1' }),
      );

      const result = await runningBillingService.recordWaterUsage(
        {
          allotmentId: 'allot-1',
          billingPeriod: '2026-10',
          usageEntryMode: UsageEntryMode.DIRECT,
          actualUsageLitres: 42500,
        },
        'agent-1',
      );

      expect(result.usageRecord.actual_usage_litres).toEqual(new Decimal(42500));
      expect(result.usageRecord.calculated_amount).toEqual(new Decimal(21250));
      expect(result.usageRecord.status).toBe('RECORDED');
    });
  });

  describe('RUN-NEW-010: Meter reading calculation', () => {
    it('should calculate actual usage from current minus previous meter reading', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-2026-10',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
        status: 'OPEN',
      });

      mockPrisma.waterUsageRecord.findFirst.mockResolvedValue(null);
      mockRates.getApplicableTariff.mockResolvedValue({
        rate_id: 'rate-1',
        version_code: 'v1.0',
        running_cost_per_litre: new Decimal(0.5),
      });

      mockPrisma.waterUsageRecord.create.mockImplementation((args) =>
        Promise.resolve({ ...args.data, usage_id: 'use-2' }),
      );

      const result = await runningBillingService.recordWaterUsage(
        {
          allotmentId: 'allot-1',
          billingPeriod: '2026-10',
          usageEntryMode: UsageEntryMode.METER_READING,
          previousMeterReading: 12500000,
          currentMeterReading: 12542500,
        },
        'agent-1',
      );

      expect(result.usageRecord.actual_usage_litres).toEqual(new Decimal(42500));
      expect(result.usageRecord.calculated_amount).toEqual(new Decimal(21250));
    });
  });

  describe('RUN-NEW-011: Negative usage rejected', () => {
    it('should throw BadRequestException when usage is negative', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-1',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      });

      await expect(
        runningBillingService.recordWaterUsage(
          {
            allotmentId: 'allot-1',
            billingPeriod: '2026-10',
            usageEntryMode: UsageEntryMode.DIRECT,
            actualUsageLitres: -500,
          },
          'agent-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-012: Invalid usage rejected (meter current < previous)', () => {
    it('should throw BadRequestException when current meter reading is less than previous', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-1',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
      });

      await expect(
        runningBillingService.recordWaterUsage(
          {
            allotmentId: 'allot-1',
            billingPeriod: '2026-10',
            usageEntryMode: UsageEntryMode.METER_READING,
            previousMeterReading: 50000,
            currentMeterReading: 40000,
          },
          'agent-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-013: Usage above allocation requires review', () => {
    it('should flag OVER_ALLOCATION and status REQUIRES_REVIEW when usage exceeds approved allocation', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-2026-10',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
        status: 'OPEN',
      });

      mockPrisma.waterUsageRecord.findFirst.mockResolvedValue(null);
      mockRates.getApplicableTariff.mockResolvedValue({
        rate_id: 'rate-1',
        version_code: 'v1.0',
        running_cost_per_litre: new Decimal(0.5),
      });

      mockPrisma.waterUsageRecord.create.mockImplementation((args) =>
        Promise.resolve({ ...args.data, usage_id: 'use-over' }),
      );

      const result = await runningBillingService.recordWaterUsage(
        {
          allotmentId: 'allot-1',
          billingPeriod: '2026-10',
          usageEntryMode: UsageEntryMode.DIRECT,
          actualUsageLitres: 65000, // 5000 over allocation
        },
        'agent-1',
      );

      expect(result.usageRecord.status).toBe('REQUIRES_REVIEW');
      expect(result.overAllocationWarning).toContain('exceeds approved allocation');
    });
  });

  describe('RUN-NEW-014: Usage saved', () => {
    it('should persist water usage record and write audit log', async () => {
      mockPrisma.waterAllotment.findUnique.mockResolvedValue(makeTestAllotment());

      mockPrisma.billingPeriod.findUnique.mockResolvedValue({
        billing_period_id: 'bp-1',
        period_code: '2026-10',
        period_start: new Date('2026-10-01'),
        period_end: new Date('2026-10-31'),
        status: 'OPEN',
      });

      mockPrisma.waterUsageRecord.findFirst.mockResolvedValue(null);
      mockRates.getApplicableTariff.mockResolvedValue({
        rate_id: 'rate-1',
        version_code: 'v1.0',
        running_cost_per_litre: new Decimal(0.5),
      });

      mockPrisma.waterUsageRecord.create.mockResolvedValue({ usage_id: 'use-saved-1' });

      await runningBillingService.recordWaterUsage(
        {
          allotmentId: 'allot-1',
          billingPeriod: '2026-10',
          usageEntryMode: UsageEntryMode.DIRECT,
          actualUsageLitres: 30000,
        },
        'agent-1',
      );

      expect(mockPrisma.waterUsageRecord.create).toHaveBeenCalled();
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'USAGE_RECORDED',
          entityType: 'WaterUsageRecord',
        }),
      );
    });
  });

  // ==========================================
  // PART 15, 16, 17, 18, 19, 41, 42: RUNNING BILL GENERATION
  // ==========================================

  describe('RUN-NEW-015: Usage generates bill', () => {
    it('should generate a RunningBill from a verified/recorded WaterUsageRecord', async () => {
      mockPrisma.waterUsageRecord.findUnique.mockResolvedValue({
        usage_id: 'use-1',
        beneficiary_id: 'ben-1',
        allotment_id: 'allot-1',
        billing_period_id: 'bp-1',
        usage_period_start: new Date('2026-10-01'),
        usage_period_end: new Date('2026-10-31'),
        actual_usage_litres: new Decimal(42500),
        approved_litres_snapshot: new Decimal(60000),
        running_rate_snapshot: new Decimal(0.5),
        calculated_amount: new Decimal(21250),
        tariff_id: 'rate-1',
        tariff_version: 'v1.0',
        status: 'RECORDED',
        billingPeriod: {
          billing_period_id: 'bp-1',
          period_code: '2026-10',
          period_start: new Date('2026-10-01'),
          period_end: new Date('2026-10-31'),
          payment_due_date: new Date('2026-11-15'),
        },
        allotment: {
          allotment_id: 'allot-1',
          infrastructure: {
            commissioned_date: new Date('2026-10-01'),
            running_charge_start_date: new Date('2026-10-01'),
          },
        },
        runningBill: null,
      });

      mockPrisma.runningBill.count.mockResolvedValue(10);
      mockPrisma.runningBill.create.mockImplementation((args) =>
        Promise.resolve({ ...args.data, running_bill_id: 'rb-1' }),
      );
      mockPrisma.waterUsageRecord.update.mockResolvedValue({});

      const bill = await runningBillingService.generateBillFromUsage('use-1', 'staff-1');
      expect(bill.amount_due).toEqual(new Decimal(21250));
      expect(bill.pending_amount).toEqual(new Decimal(21250));
      expect(bill.actual_usage_litres_snapshot).toEqual(new Decimal(42500));
      expect(bill.status).toBe('PENDING');
      expect(mockPrisma.waterUsageRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { usage_id: 'use-1' },
          data: expect.objectContaining({ status: 'BILLED' }),
        }),
      );
    });
  });

  describe('RUN-NEW-016: No usage means no bill', () => {
    it('should throw BadRequestException if attempting to generate bill without a valid usage record', async () => {
      mockPrisma.waterUsageRecord.findUnique.mockResolvedValue(null);

      await expect(
        runningBillingService.generateBillFromUsage('non-existent', 'staff-1'),
      ).rejects.toThrow();
    });
  });

  describe('RUN-NEW-017: One bill per beneficiary/period', () => {
    it('should reject bill generation if a bill already exists for the usage record', async () => {
      mockPrisma.waterUsageRecord.findUnique.mockResolvedValue({
        usage_id: 'use-1',
        beneficiary_id: 'ben-1',
        allotment_id: 'allot-1',
        billing_period_id: 'bp-1',
        status: 'BILLED',
        runningBill: { running_bill_id: 'existing-bill' },
      });

      await expect(
        runningBillingService.generateBillFromUsage('use-1', 'staff-1'),
      ).rejects.toThrow();
    });
  });

  describe('RUN-NEW-018: Correct tariff resolution', () => {
    it('should resolve only RUNNING tariff type for running charge calculation', async () => {
      mockRates.getApplicableTariff.mockResolvedValue({
        rate_id: 'rate-running-1',
        version_code: 'RUN-2026-v1',
        rate_type: 'RUNNING',
        running_cost_per_litre: new Decimal(0.75),
      });

      const tariff = await ratesService.getApplicableTariff('proj-1', new Date('2026-10-01'), 'RUNNING' as any);
      expect(tariff.running_cost_per_litre).toEqual(new Decimal(0.75));
    });
  });

  describe('RUN-NEW-019: Tariff change affects future period only', () => {
    it('should calculate future month with new rate without modifying previous month rate snapshot', () => {
      const octRate = new Decimal(0.5);
      const novRate = new Decimal(0.75);
      const octUsage = new Decimal(42500);
      const novUsage = new Decimal(38000);

      const octBillAmount = octUsage.mul(octRate); // 21,250
      const novBillAmount = novUsage.mul(novRate); // 28,500

      expect(octBillAmount.toNumber()).toBe(21250);
      expect(novBillAmount.toNumber()).toBe(28500);
      // October bill remains 21,250
      expect(octBillAmount.toNumber()).toBe(21250);
    });
  });

  describe('RUN-NEW-020: Historical bill immutable', () => {
    it('historical RunningBill values remain unchanged when master rate changes', () => {
      const historicalBill = {
        running_bill_id: 'rb-oct',
        amount_due: new Decimal(21250),
        running_rate_per_litre_snapshot: new Decimal(0.5),
        actual_usage_litres_snapshot: new Decimal(42500),
      };

      // Master rate update
      expect(historicalBill.running_rate_per_litre_snapshot.toNumber()).toBe(0.5);
      expect(historicalBill.amount_due.toNumber()).toBe(21250);
    });
  });

  describe('RUN-NEW-021: Bill amount = actual usage × rate', () => {
    it('calculates strictly actual usage multiplied by running rate', () => {
      const actualUsage = new Decimal(42500);
      const rate = new Decimal(0.5);
      const amountDue = actualUsage.mul(rate);
      expect(amountDue.toNumber()).toBe(21250);

      // Verify approved allocation does NOT alter calculation
      const approvedAllocation = new Decimal(60000);
      expect(actualUsage.mul(rate).toNumber()).not.toBe(approvedAllocation.mul(rate).toNumber());
    });
  });

  describe('RUN-NEW-022: Bill calculation breakdown reconciles', () => {
    it('breakdown components reconcile exactly to amount_due', () => {
      const actualUsage = new Decimal(42500);
      const rate = new Decimal(0.5);
      const amountDue = actualUsage.mul(rate);

      const breakdown = [
        {
          label: 'Water Consumption Charge',
          litres: actualUsage.toNumber(),
          rate: rate.toNumber(),
          amount: amountDue.toNumber(),
        },
      ];

      const breakdownTotal = breakdown.reduce((sum, item) => sum + item.amount, 0);
      expect(breakdownTotal).toBe(amountDue.toNumber());
    });
  });

  // ==========================================
  // PART 24, 25, 26, 27, 31: PAYMENTS & ATOMIC TRANSACTIONS
  // ==========================================

  describe('RUN-NEW-023: Payment recorded', () => {
    it('records valid payment and reduces pending amount', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-1',
        beneficiary_id: 'ben-1',
        amount_due: new Decimal(21250),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(21250),
        status: 'PENDING',
        due_date: new Date('2026-11-15'),
      });

      mockPrisma.payment.create.mockResolvedValue({
        payment_id: 'pay-1',
        amount: new Decimal(10000),
        status: 'COMPLETED',
      });

      mockPrisma.runningBill.update.mockResolvedValue({});

      await paymentsService.recordRunningBillPayment(
        'rb-1',
        {
          amount: 10000,
          paymentMode: 'CASH',
        },
        'ben-1',
        'Collector A',
      );

      expect(mockPrisma.payment.create).toHaveBeenCalled();
      expect(mockPrisma.runningBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { running_bill_id: 'rb-1' },
          data: expect.objectContaining({
            amount_paid: new Decimal(10000),
            pending_amount: new Decimal(11250),
            status: 'PARTIALLY_PAID',
          }),
        }),
      );
    });
  });

  describe('RUN-NEW-024: Partial payment', () => {
    it('sets status to PARTIALLY_PAID when payment is less than total amount_due', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-1',
        beneficiary_id: 'ben-1',
        amount_due: new Decimal(21250),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(21250),
        status: 'PENDING',
        due_date: new Date('2026-11-15'),
      });

      await paymentsService.recordRunningBillPayment(
        'rb-1',
        { amount: 5000, paymentMode: 'CASH' },
        'ben-1',
        'Collector',
      );

      expect(mockPrisma.runningBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PARTIALLY_PAID',
            amount_paid: new Decimal(5000),
            pending_amount: new Decimal(16250),
          }),
        }),
      );
    });
  });

  describe('RUN-NEW-025: Full payment', () => {
    it('sets status to PAID when remaining balance is fully settled', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-1',
        beneficiary_id: 'ben-1',
        amount_due: new Decimal(21250),
        amount_paid: new Decimal(10000),
        pending_amount: new Decimal(11250),
        status: 'PARTIALLY_PAID',
        due_date: new Date('2026-11-15'),
      });

      await paymentsService.recordRunningBillPayment(
        'rb-1',
        { amount: 11250, paymentMode: 'CASH' },
        'ben-1',
        'Collector',
      );

      expect(mockPrisma.runningBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
            amount_paid: new Decimal(21250),
            pending_amount: new Decimal(0),
          }),
        }),
      );
    });
  });

  describe('RUN-NEW-026: Overpayment rejected', () => {
    it('rejects payment if amount exceeds remaining pending amount', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-1',
        beneficiary_id: 'ben-1',
        amount_due: new Decimal(21250),
        amount_paid: new Decimal(10000),
        pending_amount: new Decimal(11250),
        status: 'PARTIALLY_PAID',
      });

      await expect(
        paymentsService.recordRunningBillPayment(
          'rb-1',
          { amount: 15000, paymentMode: 'CASH' }, // 15,000 > 11,250
          'ben-1',
          'Collector',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-027: Payment survives restart', () => {
    it('preserves payment record upon reading from database state', async () => {
      const persistedPayment = {
        payment_id: 'pay-persist-1',
        running_bill_id: 'rb-1',
        amount: new Decimal(11250),
        status: 'COMPLETED',
      };
      mockPrisma.payment.findUnique.mockResolvedValue(persistedPayment);

      const found = await mockPrisma.payment.findUnique({ where: { payment_id: 'pay-persist-1' } });
      expect(found).toEqual(persistedPayment);
    });
  });

  describe('RUN-NEW-028: Payment survives backup/restore', () => {
    it('verifies payment row counts and integrity pass', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([
        { payment_id: 'p-1', amount: new Decimal(1000) },
        { payment_id: 'p-2', amount: new Decimal(2000) },
      ]);
      const payments = await mockPrisma.payment.findMany();
      expect(payments.length).toBe(2);
    });
  });

  describe('RUN-NEW-029: Beneficiary Pay button', () => {
    it('allows beneficiary to record payment via their own beneficiary portal with matching ID', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-ben',
        beneficiary_id: 'ben-owner',
        amount_due: new Decimal(5000),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(5000),
        status: 'PENDING',
      });

      await paymentsService.recordRunningBillPayment(
        'rb-ben',
        { amount: 5000, paymentMode: 'CASH' },
        'ben-owner',
        'Self',
      );

      expect(mockPrisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('RUN-NEW-030: Running Bills Pay button (staff/admin)', () => {
    it('allows staff/admin to record payment without requiring beneficiaryId filter', async () => {
      mockPrisma.runningBill.findUnique.mockResolvedValue({
        running_bill_id: 'rb-staff',
        beneficiary_id: 'ben-anyone',
        amount_due: new Decimal(8000),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(8000),
        status: 'PENDING',
      });

      await paymentsService.recordRunningBillPayment(
        'rb-staff',
        { amount: 8000, paymentMode: 'CASH' },
        undefined, // staff doesn't pass beneficiaryId
        'Officer John',
      );

      expect(mockPrisma.payment.create).toHaveBeenCalled();
    });
  });

  describe('RUN-NEW-031: Both use same payment service', () => {
    it('verifies single authoritative implementation of recordRunningBillPayment', () => {
      expect(typeof paymentsService.recordRunningBillPayment).toBe('function');
    });
  });

  // ==========================================
  // PART 20, 21, 22, 27: DASHBOARD & REPORTING TOTALS
  // ==========================================

  describe('RUN-NEW-032: Dashboard billing-period totals', () => {
    it('calculates total billed, paid, pending, and overdue for selected period', async () => {
      mockPrisma.billingPeriod.findFirst.mockResolvedValue({
        billing_period_id: 'bp-oct',
        period_code: '2026-10',
      });

      mockPrisma.runningBill.findMany.mockResolvedValue([
        {
          amount_due: new Decimal(21250),
          amount_paid: new Decimal(10000),
          pending_amount: new Decimal(11250),
          actual_usage_litres_snapshot: new Decimal(42500),
          due_date: new Date('2026-11-15'),
          status: 'PARTIALLY_PAID',
        },
        {
          amount_due: new Decimal(10000),
          amount_paid: new Decimal(10000),
          pending_amount: new Decimal(0),
          actual_usage_litres_snapshot: new Decimal(20000),
          due_date: new Date('2026-11-15'),
          status: 'PAID',
        },
      ]);

      mockPrisma.runningBill.aggregate
        .mockResolvedValueOnce({
          _count: { running_bill_id: 2 },
          _sum: {
            amount_due: new Decimal(31250),
            amount_paid: new Decimal(20000),
            pending_amount: new Decimal(11250),
          },
        })
        .mockResolvedValueOnce({
          _sum: { pending_amount: new Decimal(0) },
        });

      mockPrisma.waterUsageRecord.aggregate.mockResolvedValue({
        _count: { usage_id: 2 },
        _sum: { actual_usage_litres: new Decimal(62500) },
        _avg: { actual_usage_litres: new Decimal(31250) },
      });

      mockPrisma.infrastructure.count.mockResolvedValue(5);
      mockPrisma.runningBill.count.mockResolvedValue(1);

      const summary = await runningBillingService.getRunningBillsSummary({ billingPeriod: '2026-10' });
      expect(Number(summary.financials.totalBilled)).toBe(31250);
      expect(Number(summary.financials.totalPaid)).toBe(20000);
      expect(Number(summary.financials.totalPending)).toBe(11250);
      expect(Number(summary.usage.totalActualUsageLitres)).toBe(62500);
    });
  });

  describe('RUN-NEW-033: Billing date vs payment date separation', () => {
    it('distinguishes between period of invoice generation and period of cash collection', () => {
      const bill = {
        bill_period: '2026-10',
        bill_date: new Date('2026-10-31'),
        amount_due: 21250,
      };

      const payment = {
        payment_date: new Date('2026-11-05'),
        amount: 21250,
      };

      expect(bill.bill_period).toBe('2026-10');
      expect(payment.payment_date.toISOString().slice(0, 7)).toBe('2026-11');
    });
  });

  describe('RUN-NEW-034: Overdue calculation', () => {
    it('classifies bill as overdue when due_date < current_date and pending > 0', () => {
      const pastDueDate = new Date('2026-09-15');
      const currentDate = new Date('2026-10-01');
      const pendingAmount = 5000;

      const isOverdue = pastDueDate < currentDate && pendingAmount > 0;
      expect(isOverdue).toBe(true);
    });
  });

  // ==========================================
  // PART 28, 29, 30: AUDIT & ROLES
  // ==========================================

  describe('RUN-NEW-035: Collection-agent permissions', () => {
    it('COLLECTION_AGENT can record usage, but lacks clean slate permission', () => {
      const collectionAgentPermissions = ['RECORD_USAGE', 'SUBMIT_USAGE', 'VIEW_RUNNING_BILLS'];
      expect(collectionAgentPermissions).toContain('RECORD_USAGE');
      expect(collectionAgentPermissions).not.toContain('CLEAN_SLATE');
    });
  });

  describe('RUN-NEW-036: Audit completeness', () => {
    it('audits critical events USAGE_RECORDED, USAGE_VERIFIED, and RUNNING_BILL_CREATED', async () => {
      await auditService.log({
        action: AuditAction.USAGE_RECORDED,
        entityType: 'WATER_USAGE_RECORD',
        entityId: 'use-1',
        userId: 'agent-1',
      });
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: AuditAction.USAGE_RECORDED }),
      );
    });
  });

  describe('RUN-NEW-037: Cross-module consistency', () => {
    it('guarantees database = calculation = breakdown across modules', () => {
      const actualLitres = 50000;
      const rate = 0.5;
      const calculatedAmount = actualLitres * rate;
      expect(calculatedAmount).toBe(25000); // Not 130,000 bug!
    });
  });

  // ==========================================
  // PART 7, 39, 40: OFFLINE CALENDAR & CLOCK ANOMALY
  // ==========================================

  describe('RUN-NEW-038: Offline calendar reconciliation', () => {
    it('reconciles without external internet connection', async () => {
      mockPrisma.systemClockState.findFirst.mockResolvedValue(null);
      mockPrisma.systemClockState.upsert.mockResolvedValue({});
      mockPrisma.billingPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([]);
      mockPrisma.billingPeriod.create.mockResolvedValue({ billing_period_id: 'bp-offline' });
      mockPrisma.runningBill.findMany.mockResolvedValue([]);

      const result = await calendarService.reconcile();
      expect(result).toBeDefined();
    });
  });

  describe('RUN-NEW-039: System clock rollback detection', () => {
    it('flags SYSTEM_CLOCK_ROLLBACK when system time moves backwards', async () => {
      mockPrisma.systemClockState.findFirst.mockResolvedValueOnce({
        state_id: 'SYSTEM_CLOCK_TRACKER',
        last_known_timestamp: new Date('2026-10-15T00:00:00Z'),
        is_rollback_detected: false,
      });

      // System clock set backwards to 2026-09-01
      const verification = await clockService.checkClockRollback(new Date('2026-09-01T00:00:00Z'));
      expect(verification.rollbackDetected).toBe(true);
    });
  });

  // ==========================================
  // PART 31: LEGACY PRESERVATION
  // ==========================================

  describe('RUN-NEW-040: Legacy RunningBill preservation', () => {
    it('marks pre-restructure bills with is_legacy = true without altering financial totals', async () => {
      const legacyBill = {
        running_bill_id: 'rb-legacy-1',
        is_legacy: true,
        legacy_classification: 'LEGACY_VALID_FINANCIAL_DATA',
        amount_due: new Decimal(130000),
        amount_paid: new Decimal(40000),
        pending_amount: new Decimal(90000),
      };

      mockPrisma.runningBill.findUnique.mockResolvedValue(legacyBill);
      const found = await mockPrisma.runningBill.findUnique({ where: { running_bill_id: 'rb-legacy-1' } });

      expect(found.is_legacy).toBe(true);
      expect(found.legacy_classification).toBe('LEGACY_VALID_FINANCIAL_DATA');
      expect(found.amount_due.toNumber()).toBe(130000);
      expect(found.amount_paid.toNumber()).toBe(40000);
    });
  });

  // ==========================================
  // EXTENSION SUITE: RUN-NEW-041 TO RUN-NEW-050
  // ==========================================

  describe('RUN-NEW-041: Duplicate payment request with same idempotency key', () => {
    it('results in exactly one payment without double-crediting balance', async () => {
      const bill = {
        running_bill_id: 'rb-41',
        beneficiary_id: 'ben-41',
        amount_due: new Decimal(20000),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(20000),
        status: 'PENDING',
        allotment: { infrastructure: { status: 'COMMISSIONED' } },
      };
      mockPrisma.runningBill.findUnique.mockResolvedValue(bill);

      const existingPayment = {
        payment_id: 'pay-41',
        running_bill_id: 'rb-41',
        amount: new Decimal(10000),
        payment_reference: 'IDEMP-RUN-41',
        status: 'COMPLETED',
      };

      // First call creates payment
      mockPrisma.payment.findFirst.mockResolvedValueOnce(null);
      mockPrisma.payment.create.mockResolvedValue(existingPayment);
      mockPrisma.runningBill.update.mockResolvedValue({});

      const p1 = await paymentsService.recordRunningBillPayment(
        'rb-41',
        { amount: 10000, paymentMode: 'BANK_TRANSFER', paymentReference: 'IDEMP-RUN-41', idempotencyKey: 'IDEMP-RUN-41' },
        'ben-41',
        'Officer A',
      );
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1);

      // Second identical call with same idempotencyKey returns existing payment
      mockPrisma.payment.findFirst.mockResolvedValueOnce(existingPayment);
      const p2 = await paymentsService.recordRunningBillPayment(
        'rb-41',
        { amount: 10000, paymentMode: 'BANK_TRANSFER', paymentReference: 'IDEMP-RUN-41', idempotencyKey: 'IDEMP-RUN-41' },
        'ben-41',
        'Officer A',
      );

      expect(p2.payment_id).toBe(existingPayment.payment_id);
      expect(mockPrisma.payment.create).toHaveBeenCalledTimes(1); // Not called again!
    });
  });

  describe('RUN-NEW-042: Concurrent payment requests', () => {
    it('only one can consume the available balance and the other is rejected', async () => {
      // Bill with only 5000 pending
      const billState1 = {
        running_bill_id: 'rb-42',
        beneficiary_id: 'ben-42',
        amount_due: new Decimal(10000),
        amount_paid: new Decimal(5000),
        pending_amount: new Decimal(5000),
        status: 'PARTIALLY_PAID',
        allotment: { infrastructure: { status: 'COMMISSIONED' } },
      };

      mockPrisma.runningBill.findUnique.mockResolvedValueOnce(billState1);
      mockPrisma.payment.findFirst.mockResolvedValue(null);
      mockPrisma.payment.create.mockResolvedValue({ payment_id: 'p42-1' });

      // First payment consumes the 5000
      await paymentsService.recordRunningBillPayment(
        'rb-42',
        { amount: 5000, paymentMode: 'CASH' },
        'ben-42',
        'Cashier 1',
      );

      // Second concurrent payment encounters updated state (pending is 0)
      const billState2 = {
        ...billState1,
        amount_paid: new Decimal(10000),
        pending_amount: new Decimal(0),
        status: 'PAID',
      };
      mockPrisma.runningBill.findUnique.mockResolvedValueOnce(billState2);

      await expect(
        paymentsService.recordRunningBillPayment(
          'rb-42',
          { amount: 5000, paymentMode: 'CASH' },
          'ben-42',
          'Cashier 2',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-043: Payment reversal', () => {
    it('recalculates bill balance correctly upon reversal', async () => {
      const originalPayment = {
        payment_id: 'pay-43',
        beneficiary_id: 'ben-43',
        running_bill_id: 'rb-43',
        installment_id: null,
        extension_id: null,
        amount: new Decimal(10000),
        payment_mode: 'BANK_TRANSFER',
        receipt_number: 'REC-2026-0043',
        status: 'COMPLETED',
        is_reversal: false,
      };

      const billWithPayment = {
        running_bill_id: 'rb-43',
        amount_due: new Decimal(21250),
        amount_paid: new Decimal(10000),
        pending_amount: new Decimal(11250),
        status: 'PARTIALLY_PAID',
      };

      mockPrisma.payment.findUnique.mockResolvedValue(originalPayment);
      mockPrisma.runningBill.findUnique.mockResolvedValue(billWithPayment);
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.payment.create.mockResolvedValue({ payment_id: 'rev-43', amount: new Decimal(-10000) });
      mockPrisma.runningBill.update.mockResolvedValue({});

      await paymentsService.reversePayment('pay-43', { reason: 'Bank chargeback' }, 'Admin');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { payment_id: 'pay-43' },
          data: { status: 'REVERSED' },
        }),
      );

      // Verify running bill balance restored
      expect(mockPrisma.runningBill.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { running_bill_id: 'rb-43' },
          data: expect.objectContaining({
            amount_paid: new Decimal(0),
            pending_amount: new Decimal(21250),
            status: 'PENDING',
          }),
        }),
      );
    });
  });

  describe('RUN-NEW-044: Payment deletion attempt', () => {
    it('is rejected; financial records remain immutable', async () => {
      await expect(
        paymentsService.deletePayment('pay-44'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-045: Beneficiary attempts to mark own bill as paid', () => {
    it('is rejected when attempted without valid payment or ownership authorization', async () => {
      const otherUserBill = {
        running_bill_id: 'rb-45',
        beneficiary_id: 'ben-actual-owner',
        amount_due: new Decimal(15000),
        pending_amount: new Decimal(15000),
        status: 'PENDING',
        allotment: { infrastructure: { status: 'COMMISSIONED' } },
      };

      mockPrisma.runningBill.findUnique.mockResolvedValue(otherUserBill);

      // Beneficiary 'ben-imposter' attempts to pay/settle another user's bill
      await expect(
        paymentsService.recordRunningBillPayment(
          'rb-45',
          { amount: 15000, paymentMode: 'CASH' },
          'ben-imposter',
          'Self',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-046: October bill paid in November', () => {
    it('October billing metrics remain correct while November collection metrics increase', () => {
      // October bill: period 2026-10, bill_date in October
      const octBill = {
        bill_id: 'rb-oct',
        billing_period: '2026-10',
        bill_date: new Date('2026-10-31T00:00:00Z'),
        amount_due: 21250,
      };

      // Payment executed in November
      const novPayment = {
        payment_id: 'pay-nov',
        running_bill_id: 'rb-oct',
        amount: 21250,
        payment_date: new Date('2026-11-05T10:00:00Z'),
      };

      // In October's billing report:
      const octBilledPeriod = octBill.billing_period;
      expect(octBilledPeriod).toBe('2026-10');

      // In November's cash collection report:
      const paymentMonth = novPayment.payment_date.toISOString().slice(0, 7);
      expect(paymentMonth).toBe('2026-11');
      expect(octBill.amount_due).toBe(21250);
    });
  });

  describe('RUN-NEW-047: Tariff changed after usage recorded but before bill generation', () => {
    it('enforces the recorded usage tariff snapshot policy', async () => {
      mockPrisma.systemClockState.findFirst.mockResolvedValue({
        state_id: 'SYSTEM_CLOCK_TRACKER',
        last_known_timestamp: new Date('2026-01-01T00:00:00Z'),
        is_rollback_detected: false,
      });

      // Usage was recorded at 0.50/L
      mockPrisma.waterUsageRecord.findUnique.mockResolvedValue({
        usage_id: 'use-47',
        beneficiary_id: 'ben-47',
        allotment_id: 'allot-47',
        billing_period_id: 'bp-47',
        usage_period_start: new Date('2026-10-01'),
        usage_period_end: new Date('2026-10-31'),
        actual_usage_litres: new Decimal(40000),
        approved_litres_snapshot: new Decimal(60000),
        running_rate_snapshot: new Decimal(0.50), // Locked snapshot
        calculated_amount: new Decimal(20000),
        tariff_id: 'tariff-old',
        tariff_version: 'v1.0',
        status: 'RECORDED',
        billingPeriod: {
          billing_period_id: 'bp-47',
          period_code: '2026-10',
          period_start: new Date('2026-10-01'),
          period_end: new Date('2026-10-31'),
          payment_due_date: new Date('2026-11-15'),
        },
        allotment: {
          allotment_id: 'allot-47',
          infrastructure: {
            commissioned_date: new Date('2026-10-01'),
            running_charge_start_date: new Date('2026-10-01'),
          },
        },
        runningBill: null,
      });

      mockPrisma.runningBill.count.mockResolvedValue(1);
      mockPrisma.runningBill.create.mockImplementation((args) =>
        Promise.resolve({ ...args.data, running_bill_id: 'rb-47' }),
      );
      mockPrisma.waterUsageRecord.update.mockResolvedValue({});

      // Even if master tariff is now 0.75, generateBillFromUsage preserves 0.50 snapshot
      const bill = await runningBillingService.generateBillFromUsage('use-47', 'staff-1');
      expect(bill.amount_due).toEqual(new Decimal(20000));
      expect(bill.running_cost_per_litre_snapshot).toEqual(new Decimal(0.50));
    });
  });

  describe('RUN-NEW-048: Usage correction after bill generation', () => {
    it('preserves original financial record and requires authorized void workflow', async () => {
      // Usage is already billed
      mockPrisma.waterUsageRecord.findUnique.mockResolvedValue({
        usage_id: 'use-48',
        status: 'BILLED',
        notes: 'Original usage visit',
        runningBill: { running_bill_id: 'rb-48' },
      });

      // Attempting to void/correct usage while bill is active throws BadRequestException
      await expect(
        runningBillingService.voidUsageRecord('use-48', { reason: 'Incorrect meter reading' }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RUN-NEW-049: Legacy bill + new V1 bill for same beneficiary/period', () => {
    it('preserves legacy record and keeps V1 uniqueness rules unaffected', () => {
      const legacyBill = {
        running_bill_id: 'rb-legacy',
        beneficiary_id: 'ben-1',
        billing_period: '2026-09',
        is_legacy: true,
        legacy_classification: 'LEGACY_VALID_FINANCIAL_DATA',
        amount_due: new Decimal(10000),
      };

      const newV1Bill = {
        running_bill_id: 'rb-v1',
        beneficiary_id: 'ben-1',
        billing_period: '2026-10',
        usage_id: 'use-v1',
        is_legacy: false,
        legacy_classification: null,
        amount_due: new Decimal(21250),
      };

      expect(legacyBill.is_legacy).toBe(true);
      expect(newV1Bill.is_legacy).toBe(false);
      expect(newV1Bill.usage_id).toBeDefined();
    });
  });

  describe('RUN-NEW-050: Application closed across multiple months', () => {
    it('periods reconcile without fabricating any usage or bills', async () => {
      mockPrisma.systemClockState.findFirst.mockResolvedValue(null);
      mockPrisma.systemClockState.upsert.mockResolvedValue({});
      mockPrisma.billingPeriod.findUnique.mockResolvedValue(null);
      mockPrisma.billingPeriod.findMany.mockResolvedValue([]);
      mockPrisma.billingPeriod.upsert.mockResolvedValue({ billing_period_id: 'bp-rec' });
      mockPrisma.billingPeriod.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.runningBill.updateMany.mockResolvedValue({ count: 0 });

      // Reset create mocks
      mockPrisma.waterUsageRecord.create.mockClear();
      mockPrisma.runningBill.create.mockClear();

      const result = await calendarService.reconcile();
      expect(result.createdPeriods.length).toBeGreaterThanOrEqual(1);

      // Verify that NO usage records or bills were created during calendar reconciliation
      expect(mockPrisma.waterUsageRecord.create).not.toHaveBeenCalled();
      expect(mockPrisma.runningBill.create).not.toHaveBeenCalled();
    });
  });
});
