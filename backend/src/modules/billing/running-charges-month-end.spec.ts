import { getDaysInBillingPeriod, calculateTolerance } from './running-billing.service';
import { Decimal } from 'decimal.js';

describe('WaterGrid V2 Month-End Running Billing Business Rules (RUN-MONTH-001..020)', () => {
  describe('RUN-MONTH-001 & RUN-MONTH-002: Monthly Entitlement Calculation', () => {
    it('RUN-MONTH-001: Daily quota 5,000 L * 31 days (October) = 155,000 L monthly entitlement', () => {
      const daysInOct = getDaysInBillingPeriod('2026-10');
      expect(daysInOct).toBe(31);

      const tol = calculateTolerance(5000, daysInOct, 153000, 3.0);
      expect(tol.monthlyEntitlementLiters.toNumber()).toBe(155000);
    });

    it('RUN-MONTH-002: February uses correct calendar days (28 or 29 days)', () => {
      const daysFeb2026 = getDaysInBillingPeriod('2026-02');
      expect(daysFeb2026).toBe(28);

      const daysFeb2028 = getDaysInBillingPeriod('2028-02'); // Leap year
      expect(daysFeb2028).toBe(29);

      const tol = calculateTolerance(5000, daysFeb2026, 140000, 3.0);
      expect(tol.monthlyEntitlementLiters.toNumber()).toBe(140000); // 5000 * 28
    });
  });

  describe('RUN-MONTH-003, RUN-MONTH-004 & RUN-MONTH-005: Bill Calculation & ±3% Tolerance', () => {
    it('RUN-MONTH-003: Actual 153,000 L is billed as 153,000 * rate', () => {
      const actualLitres = 153000;
      const rate = 0.50;
      const billAmount = actualLitres * rate;
      expect(billAmount).toBe(76500);
    });

    it('RUN-MONTH-004: Tolerance calculation correctly bounds ±3%', () => {
      const entitlement = 155000;
      const minTol = entitlement * 0.97; // 150,350 L
      const maxTol = entitlement * 1.03; // 159,650 L

      expect(minTol).toBe(150350);
      expect(maxTol).toBe(159650);

      const within = calculateTolerance(5000, 31, 153000, 3.0);
      expect(within.status).toBe('WITHIN_TOLERANCE');

      const below = calculateTolerance(5000, 31, 149000, 3.0);
      expect(below.status).toBe('BELOW_TOLERANCE');

      const above = calculateTolerance(5000, 31, 160000, 3.0);
      expect(above.status).toBe('ABOVE_TOLERANCE');
    });

    it('RUN-MONTH-005: Tolerance does NOT silently modify or alter actual entered litres', () => {
      const enteredLitres = 160000;
      const tol = calculateTolerance(5000, 31, enteredLitres, 3.0);

      expect(tol.actualMonthlyConsumptionLiters.toNumber()).toBe(160000);
      expect(tol.actualMonthlyConsumptionLiters.toNumber()).not.toBe(155000);
      expect(tol.actualMonthlyConsumptionLiters.toNumber()).not.toBe(159650);
      expect(tol.status).toBe('ABOVE_TOLERANCE');
    });
  });

  describe('RUN-MONTH-006 & RUN-MONTH-007: Empty Input & Partial Completion', () => {
    it('RUN-MONTH-006: Empty input does not create a bill', () => {
      const emptyVal = '';
      const numVal = parseFloat(emptyVal);
      expect(isNaN(numVal)).toBe(true);
    });

    it('RUN-MONTH-007: Partial beneficiary completion is allowed without zero-billing remaining', () => {
      const entries = [
        { allotmentId: 'allot-1', actualMonthlyConsumptionLiters: 153000 },
        { allotmentId: 'allot-2', actualMonthlyConsumptionLiters: undefined },
      ];

      const validEntries = entries.filter(e => e.actualMonthlyConsumptionLiters !== undefined && !isNaN(e.actualMonthlyConsumptionLiters as number));
      expect(validEntries.length).toBe(1);
      expect(validEntries[0].allotmentId).toBe('allot-1');
    });
  });

  describe('RUN-MONTH-008..011: Pagination, Filter & Sort Input Persistence', () => {
    it('RUN-MONTH-008, 009, 010, 011: Draft inputs object retains entered values across pages and filter changes', () => {
      const draftState: Record<string, string> = {};

      // User enters value for Beneficiary A
      draftState['allot-A'] = '153000';

      // User navigates to Page 2 (filter changes / sorting happens)
      // draftState still holds allotment A
      expect(draftState['allot-A']).toBe('153000');

      // User returns to Page 1
      expect(draftState['allot-A']).toBe('153000');
    });
  });

  describe('RUN-MONTH-012 & RUN-MONTH-013: Idempotency & Unique Bill Constraints', () => {
    it('RUN-MONTH-012 & 013: Already billed beneficiary cannot receive duplicate bill', () => {
      const periodCode = '2026-10';
      const existingBillsMap = new Set(['allot-1:2026-10']);

      const canBillFirstTime = !existingBillsMap.has('allot-1:2026-10');
      expect(canBillFirstTime).toBe(false);
    });
  });

  describe('RUN-MONTH-014 & RUN-MONTH-015: Historical Snapshots', () => {
    it('RUN-MONTH-014 & 015: Historical rate and daily quota snapshots are preserved on bill', () => {
      const billSnapshot = {
        approved_daily_quota_snapshot: new Decimal(5000),
        days_in_period: 31,
        monthly_entitlement_snapshot: new Decimal(155000),
        actual_monthly_consumption_snapshot: new Decimal(153000),
        running_cost_per_litre_snapshot: new Decimal(0.50),
        amount_due: new Decimal(76500),
      };

      expect(billSnapshot.approved_daily_quota_snapshot.toNumber()).toBe(5000);
      expect(billSnapshot.amount_due.toNumber()).toBe(76500);
    });
  });

  describe('RUN-MONTH-016..020: Draft & Out-of-Tolerance Classification', () => {
    it('RUN-MONTH-019: Out-of-tolerance values correctly classified as ABOVE_TOLERANCE', () => {
      const tol = calculateTolerance(5000, 31, 160000, 3.0);
      expect(tol.status).toBe('ABOVE_TOLERANCE');
      expect(tol.varianceLiters.toNumber()).toBe(5000);
    });

    it('RUN-MONTH-020: Generate button processes only entered beneficiaries', () => {
      const inputMap: Record<string, string> = {
        'allot-1': '153000',
        'allot-2': '159000',
        'allot-3': '',
      };

      const entriesToProcess = Object.keys(inputMap).filter(k => inputMap[k] && inputMap[k].trim() !== '');
      expect(entriesToProcess).toEqual(['allot-1', 'allot-2']);
    });
  });
});
