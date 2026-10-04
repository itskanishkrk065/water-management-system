import { Test, TestingModule } from '@nestjs/testing';
import { BeneficiariesService } from './beneficiaries/beneficiaries.service';
import { PaymentsService } from './payments/payments.service';
import { PrismaService } from './prisma/prisma.service';
import { AuditService } from './audit/audit.service';
import { Decimal } from 'decimal.js';

describe('Operator Efficiency & Quality-of-Life Pass Tests', () => {
  let beneficiariesService: BeneficiariesService;
  let paymentsService: PaymentsService;
  let prismaService: any;

  const mockPrismaService = {
    beneficiary: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    developmentBill: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    installment: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        PaymentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    beneficiariesService = module.get<BeneficiariesService>(BeneficiariesService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Smart Bulk Payment Allocation Preview', () => {
    it('should correctly allocate ₹8,000 across 5 installments', async () => {
      const mockBill = {
        bill_id: 'bill-1',
        beneficiary_id: 'ben-1',
        total_amount: new Decimal(10000),
        amount_paid: new Decimal(0),
        pending_amount: new Decimal(10000),
        status: 'UNPAID',
        installments: [
          { installment_id: 'ins-1', installment_number: 1, amount_due: new Decimal(250), amount_paid: new Decimal(0), pending_amount: new Decimal(250), status: 'PENDING' },
          { installment_id: 'ins-2', installment_number: 2, amount_due: new Decimal(2000), amount_paid: new Decimal(0), pending_amount: new Decimal(2000), status: 'PENDING' },
          { installment_id: 'ins-3', installment_number: 3, amount_due: new Decimal(2500), amount_paid: new Decimal(0), pending_amount: new Decimal(2500), status: 'PENDING' },
          { installment_id: 'ins-4', installment_number: 4, amount_due: new Decimal(2500), amount_paid: new Decimal(0), pending_amount: new Decimal(2500), status: 'PENDING' },
          { installment_id: 'ins-5', installment_number: 5, amount_due: new Decimal(2750), amount_paid: new Decimal(0), pending_amount: new Decimal(2750), status: 'PENDING' },
        ],
      };

      mockPrismaService.developmentBill.findUnique.mockResolvedValue(mockBill);

      const preview = await paymentsService.previewBulkBillPayment('bill-1', 8000);

      expect(preview.allocations).toHaveLength(5);
      expect(preview.allocations[0].allocatedPayment).toBe(250);
      expect(preview.allocations[0].resultingStatus).toBe('PAID');
      expect(preview.allocations[1].allocatedPayment).toBe(2000);
      expect(preview.allocations[1].resultingStatus).toBe('PAID');
      expect(preview.allocations[2].allocatedPayment).toBe(2500);
      expect(preview.allocations[2].resultingStatus).toBe('PAID');
      expect(preview.allocations[3].allocatedPayment).toBe(2500);
      expect(preview.allocations[3].resultingStatus).toBe('PAID');
      expect(preview.allocations[4].allocatedPayment).toBe(750);
      expect(preview.allocations[4].resultingStatus).toBe('PARTIALLY_PAID');
      expect(preview.allocations[4].newPending).toBe(2000);
      expect(preview.newBillPending).toBe(2000);
      expect(preview.resultingBillStatus).toBe('PARTIALLY_PAID');
    });
  });

  describe('2. Next Action System', () => {
    it('should return COLLECT_PAYMENT when beneficiary has pending bill balance', async () => {
      const mockBeneficiary = {
        beneficiary_id: 'ben-1',
        name: 'Jeevan Jeba Kumar',
        developmentBills: [
          {
            bill_id: 'bill-1',
            pending_amount: new Decimal(2000),
            installments: [{ installment_id: 'ins-1', installment_number: 1 }],
          },
        ],
        runningBills: [],
        waterApplications: [],
        extensions: [],
        infrastructures: [],
      };

      mockPrismaService.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);

      const nextAction = await beneficiariesService.getBeneficiaryNextAction('ben-1');

      expect(nextAction.type).toBe('COLLECT_PAYMENT');
      expect(nextAction.pendingAmount).toBe('2000');
      expect(nextAction.label).toContain('Collect ₹2000.00');
    });

    it('should return CAUGHT_UP when no pending actions exist', async () => {
      const mockBeneficiary = {
        beneficiary_id: 'ben-1',
        name: 'Jeevan Jeba Kumar',
        developmentBills: [],
        runningBills: [],
        waterApplications: [],
        extensions: [],
        infrastructures: [],
      };

      mockPrismaService.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);

      const nextAction = await beneficiariesService.getBeneficiaryNextAction('ben-1');

      expect(nextAction.type).toBe('CAUGHT_UP');
      expect(nextAction.label).toContain("✓ You're all caught up.");
    });
  });

  describe('3. Collection Officer Priority Queue', () => {
    it('should return beneficiaries ordered by pending amount descending', async () => {
      const mockBeneficiaries = [
        {
          beneficiary_id: 'ben-1',
          name: 'Kumar',
          phone_number: '9876543210',
          district: { name: 'Coimbatore' },
          block: { name: 'Block A' },
          village: { name: 'Village Y' },
          developmentBills: [{ bill_id: 'b1', pending_amount: new Decimal(5000), installments: [{ installment_id: 'i1' }] }],
          runningBills: [],
        },
        {
          beneficiary_id: 'ben-2',
          name: 'Jeevan',
          phone_number: '9876543211',
          district: { name: 'Coimbatore' },
          block: { name: 'Block A' },
          village: { name: 'Village Y' },
          developmentBills: [{ bill_id: 'b2', pending_amount: new Decimal(8000), installments: [{ installment_id: 'i2' }] }],
          runningBills: [],
        },
      ];

      mockPrismaService.beneficiary.findMany.mockResolvedValue(mockBeneficiaries);

      const queueResult = await beneficiariesService.getCollectionQueue({});

      expect(queueResult.summary.totalBeneficiaries).toBe(2);
      expect(queueResult.summary.totalPendingAmount).toBe('13000.00');
      expect(queueResult.queue[0].name).toBe('Jeevan');
      expect(queueResult.queue[0].totalPendingAmount).toBe('8000.00');
      expect(queueResult.queue[1].name).toBe('Kumar');
      expect(queueResult.queue[1].totalPendingAmount).toBe('5000.00');
    });
  });

  describe('4. Duplicate Beneficiary Detection', () => {
    it('should detect potential duplicate beneficiary with match factors', async () => {
      const mockCandidates = [
        {
          beneficiary_id: 'ben-10',
          name: 'Ravi Kumar',
          phone_number: '9876543321',
          district: { name: 'Coimbatore' },
          village: { name: 'Kovilur' },
          village_id: 'vil-1',
          landHoldings: [],
        },
      ];

      mockPrismaService.beneficiary.findMany.mockResolvedValue(mockCandidates);

      const dupResult = await beneficiariesService.checkDuplicateBeneficiary({
        name: 'Ravi Kumar',
        phoneNumber: '9876543321',
        villageId: 'vil-1',
      });

      expect(dupResult.hasPotentialDuplicate).toBe(true);
      expect(dupResult.duplicates[0].similarityPercent).toBeGreaterThanOrEqual(90);
      expect(dupResult.duplicates[0].matchedFactors).toContain('Phone number match');
      expect(dupResult.duplicates[0].matchedFactors).toContain('Exact name match');
    });
  });
});
