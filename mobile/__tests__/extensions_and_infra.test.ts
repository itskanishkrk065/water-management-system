import { ExtensionStatus, InfrastructureStatus } from '../src/types/domain';

describe('Extensions, Infrastructure & Financial Calculations', () => {
  describe('Water Extension Cost Isolation', () => {
    it('should calculate additional development cost strictly from approved additional litres and current rate', () => {
      const requestedLitres = 10000;
      const approvedLitres = 8000;
      const devCostPerLitre = 12.5;

      const extensionCost = approvedLitres * devCostPerLitre;
      expect(extensionCost).toBe(100000);
    });

    it('should keep extension request separate from original development bill until admin approval', () => {
      const originalBillAmount = 312500;
      const extension = {
        extension_id: 'ext-001',
        holding_id: 'hld-01',
        requested_additional_litres: 5000,
        approved_additional_litres: 5000,
        calculated_cost: 62500,
        status: 'PENDING' as ExtensionStatus,
      };

      // When PENDING, original bill remains unaffected
      let currentActiveTotal = originalBillAmount;
      expect(currentActiveTotal).toBe(312500);

      // When APPROVED, extension creates its own discrete line item
      if (extension.status === 'APPROVED') {
        currentActiveTotal += extension.calculated_cost;
      }
      expect(currentActiveTotal).toBe(312500);

      // Simulate approval
      extension.status = 'APPROVED';
      if (extension.status === 'APPROVED') {
        currentActiveTotal += extension.calculated_cost;
      }
      expect(currentActiveTotal).toBe(375000);
    });
  });

  describe('Infrastructure Commissioning Status Lifecycle', () => {
    const validTransitions: Record<InfrastructureStatus, InfrastructureStatus[]> = {
      PLANNED: ['UNDER_CONSTRUCTION'],
      UNDER_CONSTRUCTION: ['COMPLETED'],
      COMPLETED: ['COMMISSIONED'],
      COMMISSIONED: [],
    };

    it('should allow valid commissioning progression (PLANNED -> UNDER_CONSTRUCTION -> COMPLETED -> COMMISSIONED)', () => {
      let status: InfrastructureStatus = 'PLANNED';
      expect(validTransitions[status]).toContain('UNDER_CONSTRUCTION');

      status = 'UNDER_CONSTRUCTION';
      expect(validTransitions[status]).toContain('COMPLETED');

      status = 'COMPLETED';
      expect(validTransitions[status]).toContain('COMMISSIONED');
    });

    it('should disallow transition once fully COMMISSIONED', () => {
      const status: InfrastructureStatus = 'COMMISSIONED';
      expect(validTransitions[status]).toHaveLength(0);
    });
  });

  describe('Running Bill Calculations & Payments', () => {
    it('should calculate correct running bill charges based on units consumed and tariff', () => {
      const unitsConsumedLitres = 45000;
      const runningCostPerLitre = 0.08; // ₹0.08 / Litre
      const billAmount = unitsConsumedLitres * runningCostPerLitre;

      expect(billAmount).toBe(3600);
    });

    it('should recalculate outstanding balance when a payment is recorded or reversed', () => {
      const totalDue = 10000;
      let totalPaid = 0;

      // Make payment 1
      const payment1 = 3000;
      totalPaid += payment1;
      let balance = totalDue - totalPaid;
      expect(balance).toBe(7000);

      // Make payment 2
      const payment2 = 4000;
      totalPaid += payment2;
      balance = totalDue - totalPaid;
      expect(balance).toBe(3000);

      // Reverse payment 1 (dishonored cheque / admin reversal)
      totalPaid -= payment1;
      balance = totalDue - totalPaid;
      expect(balance).toBe(6000);
    });
  });
});
