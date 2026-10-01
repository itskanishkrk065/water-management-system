import {
  calculateWaterQuota,
  calculateDevelopmentBill,
  calculateInstallments,
  reconcileHoldingArea,
  checkParcelDuplicateInMemory,
  INSTALLMENT_PERCENTAGES,
} from '../src/services/calculationService';

describe('WaterGrid Mobile Business Calculations & Validation', () => {
  describe('Water Quota Calculation', () => {
    it('should calculate correct water quota from acres and tariff', () => {
      const quota = calculateWaterQuota(5000, 5.0);
      expect(quota).toBe(25000);
    });

    it('should handle decimal acres correctly', () => {
      const quota = calculateWaterQuota(5000, 2.5);
      expect(quota).toBe(12500);
    });
  });

  describe('Development Billing & 5-Stage Installments', () => {
    it('should calculate total bill from approved litres and development cost', () => {
      const bill = calculateDevelopmentBill(25000, 12.5);
      expect(bill).toBe(312500);
    });

    it('should calculate exact 5-stage installments matching 100% total', () => {
      const total = 312500;
      const installments = calculateInstallments(total);

      expect(installments).toHaveLength(5);

      // Verify stages and percentages
      expect(installments[0].percentage).toBe(2.5);
      expect(installments[0].amountDue).toBe(7812.5);

      expect(installments[1].percentage).toBe(20.0);
      expect(installments[1].amountDue).toBe(62500);

      expect(installments[2].percentage).toBe(25.0);
      expect(installments[2].amountDue).toBe(78125);

      expect(installments[3].percentage).toBe(25.0);
      expect(installments[3].amountDue).toBe(78125);

      expect(installments[4].percentage).toBe(27.5);
      expect(installments[4].amountDue).toBe(85937.5);

      // Verify sum of percentages is 100%
      const totalPct = INSTALLMENT_PERCENTAGES.reduce((sum, i) => sum + i.percentage, 0);
      expect(totalPct).toBe(100);

      // Verify sum of amounts equals total bill
      const totalAmounts = installments.reduce((sum, i) => sum + i.amountDue, 0);
      expect(totalAmounts).toBe(total);
    });
  });

  describe('Land Area Decimal Reconciliation', () => {
    it('should return verified when parcel sum matches declared area', () => {
      const res = reconcileHoldingArea(5.0, [2.5, 2.5]);
      expect(res.isMatch).toBe(true);
      expect(res.parcelTotal).toBe(5.0);
      expect(res.statusText).toBe('✓ Area verified');
    });

    it('should detect when parcel total is less than declared area', () => {
      const res = reconcileHoldingArea(5.0, [2.5, 2.0]);
      expect(res.isMatch).toBe(false);
      expect(res.difference).toBe(0.5);
      expect(res.statusText).toBe('Remaining: 0.50 acres');
    });

    it('should detect when parcel total exceeds declared area', () => {
      const res = reconcileHoldingArea(5.0, [3.0, 2.5]);
      expect(res.isMatch).toBe(false);
      expect(res.difference).toBe(-0.5);
      expect(res.statusText).toBe('Exceeds by: 0.50 acres');
    });
  });

  describe('Survey + Subdivision Composite Uniqueness', () => {
    const existingParcels = [
      { survey_number: '101', subdivision_number: '1A' },
      { survey_number: '101', subdivision_number: '1B' },
      { survey_number: '102', subdivision_number: '1' },
    ];

    it('should permit same survey number with distinct subdivision number (101/1A and 101/1C)', () => {
      const isDuplicate = checkParcelDuplicateInMemory(existingParcels, '101', '1C');
      expect(isDuplicate).toBe(false);
    });

    it('should reject exact composite duplicate (101/1A with 101/1A)', () => {
      const isDuplicate = checkParcelDuplicateInMemory(existingParcels, '101', '1A');
      expect(isDuplicate).toBe(true);
    });

    it('should be case-insensitive and whitespace-trimmed', () => {
      const isDuplicate = checkParcelDuplicateInMemory(existingParcels, ' 101 ', ' 1a ');
      expect(isDuplicate).toBe(true);
    });
  });
});
