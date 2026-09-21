import { DecimalUtil } from './decimal.util';
import { Decimal } from 'decimal.js';

describe('Business Calculation Unit Tests (Section 34)', () => {
  describe('1. Total Land Calculation', () => {
    it('should accurately compute total land across multiple holdings and parcels', () => {
      const parcelsHolding1 = [1.5, 1.0, 0.5]; // 3.0 acres
      const parcelsHolding2 = [1.25, 0.75]; // 2.0 acres
      const parcelsHolding3 = [1.5]; // 1.5 acres

      const sum1 = DecimalUtil.sum(parcelsHolding1);
      const sum2 = DecimalUtil.sum(parcelsHolding2);
      const sum3 = DecimalUtil.sum(parcelsHolding3);

      expect(sum1.toNumber()).toBe(3.0);
      expect(sum2.toNumber()).toBe(2.0);
      expect(sum3.toNumber()).toBe(1.5);

      const totalBeneficiaryLand = DecimalUtil.sum([sum1, sum2, sum3]);
      expect(totalBeneficiaryLand.toNumber()).toBe(6.5);
    });

    it('should enforce declared total area matches parcel sum within tolerance', () => {
      const declared = 3.0;
      const parcels = [1.5, 1.0, 0.5];
      const parcelSum = DecimalUtil.sum(parcels);

      expect(DecimalUtil.equalsWithTolerance(parcelSum, declared)).toBe(true);

      const mismatchDeclared = 3.5;
      expect(DecimalUtil.equalsWithTolerance(parcelSum, mismatchDeclared)).toBe(false);
    });
  });

  describe('2. Allotted Litres Calculation', () => {
    it('should calculate allotted litres from total land and litres/acre snapshot', () => {
      // Example from spec: Total land = 5 acres, Litres/acre = 10,000 => 50,000 L
      const totalLand = new Decimal(5.0);
      const litresPerAcre = new Decimal(10000);

      const calculatedAllotment = DecimalUtil.mul(totalLand, litresPerAcre);
      expect(calculatedAllotment.toNumber()).toBe(50000);

      // Distinct from required litres
      const requiredLitres = new Decimal(60000);
      expect(requiredLitres.toNumber()).not.toBe(calculatedAllotment.toNumber());
    });
  });

  describe('3. Development Cost Calculation', () => {
    it('should calculate development cost from approved litres and snapshot rate', () => {
      // Example from spec: Approved = 45,000 L, Dev Cost/L = ₹2.00 => ₹90,000
      const approvedLitres = new Decimal(45000);
      const devCostPerLitre = new Decimal(2.0);

      const devCost = DecimalUtil.roundMoney(DecimalUtil.mul(approvedLitres, devCostPerLitre));
      expect(devCost.toNumber()).toBe(90000.0);
    });
  });

  describe('4. Five Installments Calculation', () => {
    it('should accurately split total cost into 5 installments summing to exactly 100% and total amount', () => {
      const totalDevCost = new Decimal(90000.0);
      const percentages = [
        new Decimal(2.5),
        new Decimal(20.0),
        new Decimal(25.0),
        new Decimal(25.0),
        new Decimal(27.5),
      ];

      // Verify percentages sum to 100%
      const sumPct = DecimalUtil.sum(percentages);
      expect(sumPct.toNumber()).toBe(100.0);

      let allocated = new Decimal(0);
      const installmentAmounts: Decimal[] = [];

      for (let i = 0; i < 5; i++) {
        if (i === 4) {
          installmentAmounts.push(DecimalUtil.sub(totalDevCost, allocated));
        } else {
          const amt = DecimalUtil.roundMoney(DecimalUtil.mul(totalDevCost, percentages[i]).dividedBy(100));
          allocated = DecimalUtil.add(allocated, amt);
          installmentAmounts.push(amt);
        }
      }

      expect(installmentAmounts[0].toNumber()).toBe(2250.0); // 2.5% of 90,000
      expect(installmentAmounts[1].toNumber()).toBe(18000.0); // 20%
      expect(installmentAmounts[2].toNumber()).toBe(22500.0); // 25%
      expect(installmentAmounts[3].toNumber()).toBe(22500.0); // 25%
      expect(installmentAmounts[4].toNumber()).toBe(24750.0); // 27.5%

      const sumInstallments = DecimalUtil.sum(installmentAmounts);
      expect(sumInstallments.toNumber()).toBe(totalDevCost.toNumber());
    });
  });

  describe('5. Pending Payment Calculation & Status', () => {
    it('should correctly calculate pending amounts after partial and full payments', () => {
      const amountDue = new Decimal(2250.0);
      let amountPaid = new Decimal(0.0);

      // Partial payment 1000
      const payment1 = new Decimal(1000.0);
      amountPaid = DecimalUtil.add(amountPaid, payment1);
      let pending = DecimalUtil.sub(amountDue, amountPaid);

      expect(pending.toNumber()).toBe(1250.0);
      expect(pending.isZero()).toBe(false);

      // Remaining payment 1250
      const payment2 = new Decimal(1250.0);
      amountPaid = DecimalUtil.add(amountPaid, payment2);
      pending = DecimalUtil.sub(amountDue, amountPaid);

      expect(pending.toNumber()).toBe(0.0);
      expect(pending.isZero()).toBe(true);
    });
  });

  describe('6. Extension Calculation', () => {
    it('should calculate extension cost independently from original allotment', () => {
      const approvedAdditionalLitres = new Decimal(20000);
      const activeDevRate = new Decimal(2.5); // Rate in subsequent year

      const extensionCost = DecimalUtil.roundMoney(DecimalUtil.mul(approvedAdditionalLitres, activeDevRate));
      expect(extensionCost.toNumber()).toBe(50000.0);
    });
  });
});
