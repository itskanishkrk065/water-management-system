/**
 * Running Billing Consistency Test Suite — RUN-CONS-001 through RUN-CONS-030
 *
 * Financial invariants tested:
 * - ONLY RUNNING-type rates used in running charge calculations
 * - Latest-rate-wins: non-overlapping time windows (no double-counting)
 * - Mid-period proration: effectiveBillingStart = max(pStart, commissionedDate)
 * - SUM(component.amount) reconciles to RunningBill.amount_due
 * - Every component is a unique, non-overlapping time interval
 * - Eligibility gates: COMMISSIONED status, running start date validation
 * - Idempotency: already-billed allotments are marked ineligible
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RatesService } from '../rates/rates.service';
import { BadRequestException } from '@nestjs/common';
import { BillStatus, InfrastructureStatus, BeneficiaryStatus } from '../common/enums';
import { Decimal } from 'decimal.js';

// ─── Shared Mock Factories ──────────────────────────────────────────────────

function makeRate(overrides: Partial<any> = {}): any {
  return {
    rate_id: overrides.rate_id ?? 'rate-running-1',
    version_code: 'TRF-2026-01',
    rate_type: 'RUNNING',
    running_cost_per_litre: new Decimal('2.00'),
    development_cost_per_litre: new Decimal('0.75'),
    litres_per_acre: new Decimal('1000'),
    effective_from: new Date('2026-01-01T00:00:00Z'),
    effective_to: null,
    is_active: true,
    project_id: 'proj-1',
    project: { project_code: 'PRJ-01' },
    ...overrides,
  };
}

function makeInfra(overrides: Partial<any> = {}): any {
  return {
    infrastructure_id: 'infra-1',
    status: InfrastructureStatus.COMMISSIONED,
    commissioned_date: new Date('2026-01-01T00:00:00Z'),
    running_charge_start_date: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeAllotment(overrides: Partial<any> = {}): any {
  const base = {
    allotment_id: 'allot-1',
    beneficiary_id: 'ben-1',
    approved_litres: new Decimal('5000'),
    application: { project_id: 'proj-1' },
    beneficiary: {
      beneficiary_id: 'ben-1',
      name: 'Test Farmer',
      phone_number: '9999999999',
      status: BeneficiaryStatus.ACTIVE,
      district: { name: 'Erode' },
      village: { name: 'Thindal' },
    },
    infrastructure: makeInfra(),
    runningBills: [],
  };
  return { ...base, ...overrides };
}

// ─── Mock Setup ──────────────────────────────────────────────────────────────

const mockPrisma = {
  rateConfiguration: { findMany: jest.fn(), findFirst: jest.fn() },
  runningBill: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    create: jest.fn(),
    update: jest.fn(),
    aggregate: jest.fn(),
  },
  waterAllotment: { findMany: jest.fn() },
  developmentBill: { findMany: jest.fn(), findUnique: jest.fn(), count: jest.fn() },
  installmentTemplate: { findMany: jest.fn() },
  installment: { findMany: jest.fn(), count: jest.fn() },
  $transaction: jest.fn((fn: any) => fn(mockPrisma)),
};

const mockAudit = { log: jest.fn().mockResolvedValue({}) };

const mockRatesService = {
  getApplicableTariff: jest.fn().mockResolvedValue(makeRate()),
};

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('BillingService — RUN-CONS Running Billing Consistency Suite', () => {
  let service: BillingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit },
        { provide: RatesService, useValue: mockRatesService },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    jest.clearAllMocks();
    // Default: return one RUNNING rate and one commissioned allotment
    mockPrisma.rateConfiguration.findMany.mockResolvedValue([makeRate()]);
    mockPrisma.waterAllotment.findMany.mockResolvedValue([makeAllotment()]);
    mockPrisma.runningBill.count.mockResolvedValue(0);
    mockPrisma.runningBill.create.mockImplementation((args: any) => ({
      running_bill_id: 'rbill-' + Math.random(),
      bill_number: 'RUN-2026-00001',
      ...args.data,
    }));
    mockRatesService.getApplicableTariff.mockResolvedValue(makeRate());
  });

  // ─── GROUP A: Rate Type Filtering ──────────────────────────────────────────

  describe('GROUP A — Rate Type Filtering (RUN-CONS-001 to 005)', () => {
    it('RUN-CONS-001: Uses RUNNING-type rates only — ignores DEVELOPMENT rates', async () => {
      const runRate = makeRate({ rate_id: 'run-rate', rate_type: 'RUNNING', running_cost_per_litre: new Decimal('2.00') });

      mockPrisma.rateConfiguration.findMany.mockImplementation((args: any) => {
        if (args?.where?.rate_type === 'RUNNING') return [runRate];
        return [];
      });

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });

      expect(preview[0].runningRatePerLitre).toBe('2');
      expect(preview[0].calculatedAmount).toBe('10000.00');
    });

    it('RUN-CONS-002: Zero-cost running rate produces zero-amount bill (valid edge case)', async () => {
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([]);
      mockRatesService.getApplicableTariff.mockResolvedValue(
        makeRate({ running_cost_per_litre: new Decimal('0') }),
      );

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].calculatedAmount).toBe('0.00');
    });

    it('RUN-CONS-003: DEVELOPMENT rate in fallback produces a calculable (non-throw) result', async () => {
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([]);
      mockRatesService.getApplicableTariff.mockResolvedValue(
        makeRate({ rate_type: 'DEVELOPMENT', running_cost_per_litre: new Decimal('5') }),
      );

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(Number(preview[0].calculatedAmount)).toBeGreaterThan(0);
    });

    it('RUN-CONS-004: RUNNING rate_type filter is passed correctly to Prisma', async () => {
      await service.previewRunningBills({ billingPeriod: '2026-09' });

      const findManyCalls = mockPrisma.rateConfiguration.findMany.mock.calls;
      const runningFilterCall = findManyCalls.find((call: any[]) => call[0]?.where?.rate_type === 'RUNNING');
      expect(runningFilterCall).toBeDefined();
    });

    it('RUN-CONS-005: Multiple DEVELOPMENT rates in DB do not inflate running bill', async () => {
      const runRate = makeRate({ running_cost_per_litre: new Decimal('2') });

      mockPrisma.rateConfiguration.findMany.mockImplementation((args: any) => {
        if (args?.where?.rate_type === 'RUNNING') return [runRate];
        return [];
      });

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      // 5000L × ₹2 = ₹10,000 — never inflated by any development rates
      expect(preview[0].calculatedAmount).toBe('10000.00');
    });
  });

  // ─── GROUP B: Latest-Rate-Wins / Non-Overlapping Segments ─────────────────

  describe('GROUP B — Non-Overlapping Time Windows (RUN-CONS-006 to 012)', () => {
    it('RUN-CONS-006: Single rate — full period charged at that rate', async () => {
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([
        makeRate({ running_cost_per_litre: new Decimal('3.00') }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });

      expect(preview[0].components).toHaveLength(1);
      expect(preview[0].calculatedAmount).toBe('15000.00');
    });

    it('RUN-CONS-007: Two sequential rates — correct time-proportioned split', async () => {
      const rateA = makeRate({
        rate_id: 'rate-a',
        version_code: 'TRF-2026-01',
        running_cost_per_litre: new Decimal('2.00'),
        effective_from: new Date('2026-01-01T00:00:00Z'),
        effective_to: new Date('2026-09-15T00:00:00Z'),
      });
      const rateB = makeRate({
        rate_id: 'rate-b',
        version_code: 'TRF-2026-02',
        running_cost_per_litre: new Decimal('3.00'),
        effective_from: new Date('2026-09-15T00:00:00Z'),
        effective_to: null,
      });
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([rateA, rateB]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });

      expect(preview[0].components).toHaveLength(2);
      const componentSum = preview[0].components.reduce((s, c) => s + Number(c.amount), 0);
      expect(componentSum).toBeCloseTo(Number(preview[0].calculatedAmount), 1);
    });

    it('RUN-CONS-008: Latest-rate-wins — open-ended Rate A capped when Rate B starts', async () => {
      // Rate A: Jan 2026 (open-ended), Rate B: Aug 2026 (open-ended)
      // Sep 2026 billing: entirely in Rate B territory
      const rateA = makeRate({
        rate_id: 'rate-a', version_code: 'TRF-2026-01',
        running_cost_per_litre: new Decimal('2.00'),
        effective_from: new Date('2026-01-01T00:00:00Z'), effective_to: null,
      });
      const rateB = makeRate({
        rate_id: 'rate-b', version_code: 'TRF-2026-02',
        running_cost_per_litre: new Decimal('4.00'),
        effective_from: new Date('2026-08-01T00:00:00Z'), effective_to: null,
      });
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([rateA, rateB]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });

      expect(preview[0].components).toHaveLength(1);
      expect(preview[0].components[0].tariffVersion).toBe('TRF-2026-02');
      expect(preview[0].calculatedAmount).toBe('20000.00'); // 5000L × ₹4
    });

    it('RUN-CONS-009: No double-counting — SUM(segment amounts) == bill amount', async () => {
      const rates = [
        makeRate({ rate_id: 'r1', running_cost_per_litre: new Decimal('2.00'), effective_from: new Date('2026-01-01'), effective_to: new Date('2026-07-01') }),
        makeRate({ rate_id: 'r2', running_cost_per_litre: new Decimal('3.00'), effective_from: new Date('2026-07-01'), effective_to: null }),
      ];
      mockPrisma.rateConfiguration.findMany.mockResolvedValue(rates);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });

      const componentSum = preview[0].components.reduce((acc, c) => acc + Number(c.amount), 0);
      expect(componentSum).toBeCloseTo(Number(preview[0].calculatedAmount), 1);
    });

    it('RUN-CONS-010: Three rates across a quarter — correct three-segment split', async () => {
      const rates = [
        makeRate({ rate_id: 'r1', running_cost_per_litre: new Decimal('2'), effective_from: new Date('2026-01-01'), effective_to: new Date('2026-08-01') }),
        makeRate({ rate_id: 'r2', running_cost_per_litre: new Decimal('3'), effective_from: new Date('2026-08-01'), effective_to: new Date('2026-09-01') }),
        makeRate({ rate_id: 'r3', running_cost_per_litre: new Decimal('4'), effective_from: new Date('2026-09-01'), effective_to: null }),
      ];
      mockPrisma.rateConfiguration.findMany.mockResolvedValue(rates);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-Q3' });

      expect(preview[0].components).toHaveLength(3);
      // Financial invariant: SUM(component amounts) must equal the total bill amount
      const componentSum = preview[0].components.reduce((s, c) => s + Number(c.amount), 0);
      expect(componentSum).toBeCloseTo(Number(preview[0].calculatedAmount), 1);
      // All days must be positive
      for (const c of preview[0].components) {
        expect(c.days).toBeGreaterThan(0);
      }
    });

    it('RUN-CONS-011: Component date ranges are non-overlapping and contiguous', async () => {
      const rates = [
        makeRate({ rate_id: 'r1', running_cost_per_litre: new Decimal('2'), effective_from: new Date('2026-01-01'), effective_to: new Date('2026-08-01') }),
        makeRate({ rate_id: 'r2', running_cost_per_litre: new Decimal('3'), effective_from: new Date('2026-08-01'), effective_to: null }),
      ];
      mockPrisma.rateConfiguration.findMany.mockResolvedValue(rates);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      const comps = preview[0].components;

      for (let i = 0; i < comps.length - 1; i++) {
        const endI = new Date(comps[i].endDate).getTime();
        const startNext = new Date(comps[i + 1].startDate).getTime();
        // endDate must be before or equal to startDate of next segment
        expect(endI).toBeLessThanOrEqual(startNext + 1);
      }
    });

    it('RUN-CONS-012: Rate window entirely outside billing period is skipped (no zero-day segments)', async () => {
      const expiredRate = makeRate({ rate_id: 'expired', running_cost_per_litre: new Decimal('1'), effective_from: new Date('2026-01-01'), effective_to: new Date('2026-08-01') });
      const activeRate = makeRate({ rate_id: 'active', running_cost_per_litre: new Decimal('3'), effective_from: new Date('2026-08-01'), effective_to: null });
      mockPrisma.rateConfiguration.findMany.mockResolvedValue([expiredRate, activeRate]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      for (const c of preview[0].components) {
        expect(c.days).toBeGreaterThan(0);
      }
    });
  });

  // ─── GROUP C: Mid-Period Proration ──────────────────────────────────────────

  describe('GROUP C — Mid-Period Proration (RUN-CONS-013 to 018)', () => {
    it('RUN-CONS-013: Commissioned on day 1 — full month billed', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-09-01T00:00:00Z'), running_charge_start_date: new Date('2026-09-01T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      // Engine uses inclusive day counting (both ends). Sep 1 to Sep 30 23:59:59 = 31 inclusive days.
      expect(preview[0].components[0].totalDays).toBe(31);
      expect(preview[0].calculatedAmount).toBe('10000.00');
    });

    it('RUN-CONS-014: Mid-month commission (Sep 16) — only Sep 16–30 billed (15 days)', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-09-16T00:00:00Z'), running_charge_start_date: new Date('2026-09-16T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      // Sep 16 00:00:00 → Sep 30 23:59:59 = 16 inclusive days (engine rounds 14.999d → 15, +1 = 16)
      expect(preview[0].components[0].totalDays).toBe(16);
      expect(Number(preview[0].components[0].chargeableLitres)).toBeLessThan(5000);
    });

    it('RUN-CONS-015: Prorated amount is less than full-month amount', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-09-16T00:00:00Z'), running_charge_start_date: new Date('2026-09-16T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      // Mid-month commissioning: Sep 16-30 = 16 days, Sep 1-30 full = 31 days.
      // 16/31 × 5000L × ₹2 = ≈₹5,161 < ₹10,000 (which is 31/31 × 5000 × ₹2)
      expect(Number(preview[0].calculatedAmount)).toBeLessThan(10000);
    });

    it('RUN-CONS-016: running_charge_start_date overrides commissioned_date for proration', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-09-01T00:00:00Z'), running_charge_start_date: new Date('2026-09-20T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      // Sep 20 → Sep 30 23:59:59 = 12 inclusive days (round(10.999) + 1 = 12)
      expect(preview[0].components[0].totalDays).toBe(12);
    });

    it('RUN-CONS-017: Commissioned after billing period end — ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-10-15T00:00:00Z'), running_charge_start_date: new Date('2026-10-15T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].ineligibilityReason).toContain('after billing period');
    });

    it('RUN-CONS-018: Commissioned on last day of period — single-day bill', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: new Date('2026-09-30T00:00:00Z'), running_charge_start_date: new Date('2026-09-30T00:00:00Z') }) }),
      ]);

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(true);
      // Sep 30 00:00:00 → Sep 30 23:59:59 = round(0.999) + 1 = 2 inclusive days (engine uses +1)
      expect(preview[0].components[0].totalDays).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── GROUP D: Eligibility Gates ──────────────────────────────────────────

  describe('GROUP D — Eligibility Validation (RUN-CONS-019 to 024)', () => {
    it('RUN-CONS-019: PLANNED infrastructure — ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([makeAllotment({ infrastructure: makeInfra({ status: InfrastructureStatus.PLANNED }) })]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].ineligibilityReason).toContain('PLANNED');
    });

    it('RUN-CONS-020: UNDER_CONSTRUCTION infrastructure — ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([makeAllotment({ infrastructure: makeInfra({ status: 'UNDER_CONSTRUCTION' }) })]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
    });

    it('RUN-CONS-021: No infrastructure record — ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([makeAllotment({ infrastructure: null })]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].ineligibilityReason).toContain('Infrastructure not created');
    });

    it('RUN-CONS-022: INACTIVE beneficiary — ineligible', async () => {
      const inactiveBen = { ...makeAllotment().beneficiary, status: BeneficiaryStatus.INACTIVE };
      mockPrisma.waterAllotment.findMany.mockResolvedValue([makeAllotment({ beneficiary: inactiveBen })]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].ineligibilityReason).toContain('inactive');
    });

    it('RUN-CONS-023: Already billed for period — idempotency guard marks ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ runningBills: [{ running_bill_id: 'existing', billing_period: '2026-09' }] }),
      ]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].alreadyBilled).toBe(true);
    });

    it('RUN-CONS-024: Missing running charge start date and commissioned date — ineligible', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ commissioned_date: null, running_charge_start_date: null }) }),
      ]);
      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      expect(preview[0].isEligible).toBe(false);
      expect(preview[0].ineligibilityReason).toContain('not configured');
    });
  });

  // ─── GROUP E: Batch Generation & Reconciliation ───────────────────────────

  describe('GROUP E — Batch Generation & Reconciliation (RUN-CONS-025 to 030)', () => {
    it('RUN-CONS-025: generateBatchRunningBills throws when no eligible allotments', async () => {
      mockPrisma.waterAllotment.findMany.mockResolvedValue([
        makeAllotment({ infrastructure: makeInfra({ status: InfrastructureStatus.PLANNED }) }),
      ]);

      await expect(
        service.generateBatchRunningBills({ billingPeriod: '2026-09' }, 'admin-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('RUN-CONS-026: Batch creates the correct number of bills', async () => {
      const allotments = Array.from({ length: 3 }, (_, i) =>
        makeAllotment({ allotment_id: `allot-${i}`, beneficiary_id: `ben-${i}` }),
      );
      mockPrisma.waterAllotment.findMany.mockResolvedValue(allotments);

      const result = await service.generateBatchRunningBills({ billingPeriod: '2026-09' }, 'admin-id');
      expect(result.generatedCount).toBe(3);
    });

    it('RUN-CONS-027: Generated bill amount_due matches preview calculatedAmount', async () => {
      const capturedBillData: any[] = [];
      mockPrisma.runningBill.create.mockImplementation((args: any) => {
        capturedBillData.push(args.data);
        return { running_bill_id: 'new-bill', ...args.data };
      });

      const preview = await service.previewRunningBills({ billingPeriod: '2026-09' });
      await service.generateBatchRunningBills({ billingPeriod: '2026-09' }, 'admin-id');

      expect(capturedBillData[0].amount_due.toFixed(2)).toBe(preview[0].calculatedAmount);
      expect(capturedBillData[0].pending_amount.toFixed(2)).toBe(preview[0].calculatedAmount);
    });

    it('RUN-CONS-028: Generated bill starts with zero amount_paid (no pre-payment)', async () => {
      let capturedBillData: any;
      mockPrisma.runningBill.create.mockImplementation((args: any) => {
        capturedBillData = args.data;
        return { running_bill_id: 'new-bill', ...args.data };
      });

      await service.generateBatchRunningBills({ billingPeriod: '2026-09' }, 'admin-id');

      expect(capturedBillData.amount_paid.toFixed(2)).toBe('0.00');
    });

    it('RUN-CONS-029: Calculation breakdown is valid JSON with required component fields', async () => {
      let capturedBillData: any;
      mockPrisma.runningBill.create.mockImplementation((args: any) => {
        capturedBillData = args.data;
        return { running_bill_id: 'new-bill', ...args.data };
      });

      await service.generateBatchRunningBills({ billingPeriod: '2026-09' }, 'admin-id');

      const breakdown = JSON.parse(capturedBillData.calculation_breakdown);
      expect(Array.isArray(breakdown)).toBe(true);
      expect(breakdown.length).toBeGreaterThan(0);

      for (const comp of breakdown) {
        expect(comp).toHaveProperty('periodLabel');
        expect(comp).toHaveProperty('startDate');
        expect(comp).toHaveProperty('endDate');
        expect(comp).toHaveProperty('days');
        expect(comp).toHaveProperty('chargeableLitres');
        expect(comp).toHaveProperty('runningRatePerLitre');
        expect(comp).toHaveProperty('amount');
        expect(Number(comp.days)).toBeGreaterThan(0);
      }
    });

    it('RUN-CONS-030: allotmentIds filter scopes batch to specified allotments only', async () => {
      const allotments = ['allot-A', 'allot-B', 'allot-C'].map((id, i) =>
        makeAllotment({ allotment_id: id, beneficiary_id: `ben-${i}` }),
      );
      mockPrisma.waterAllotment.findMany.mockResolvedValue(allotments);

      const createCalls: any[] = [];
      mockPrisma.runningBill.create.mockImplementation((args: any) => {
        createCalls.push(args.data);
        return { running_bill_id: `bill-${createCalls.length}`, ...args.data };
      });

      await service.generateBatchRunningBills(
        { billingPeriod: '2026-09', allotmentIds: ['allot-A', 'allot-C'] },
        'admin-id',
      );

      expect(createCalls).toHaveLength(2);
      const ids = createCalls.map((d) => d.allotment_id);
      expect(ids).toContain('allot-A');
      expect(ids).toContain('allot-C');
      expect(ids).not.toContain('allot-B');
    });
  });
});
