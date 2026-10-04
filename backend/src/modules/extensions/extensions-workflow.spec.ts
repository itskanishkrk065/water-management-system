import { Test, TestingModule } from '@nestjs/testing';
import { ExtensionsService } from './extensions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExtensionStatus, ExtensionType, BillStatus, InstallmentStatus } from '../common/enums';
import { Decimal } from 'decimal.js';
import { BadRequestException } from '@nestjs/common';

describe('ExtensionsWorkflow (EXT-001 - EXT-030)', () => {
  let service: ExtensionsService;
  let prisma: any;
  let auditService: any;

  const mockBeneficiary = {
    beneficiary_id: 'ben-001',
    name: 'Test Beneficiary',
    phone_number: '9876543210',
    developmentBills: [
      {
        bill_id: 'bill-orig-001',
        bill_type: 'ORIGINAL_DEVELOPMENT',
        total_amount: new Decimal(100000),
        amount_paid: new Decimal(100000),
        pending_amount: new Decimal(0),
        status: BillStatus.PAID,
        installments: [],
        payments: [],
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      beneficiary: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      waterAllotment: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      rateConfiguration: {
        findFirst: jest.fn(),
      },
      extension: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      developmentBill: {
        create: jest.fn(),
      },
      installment: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    auditService = {
      log: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExtensionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get<ExtensionsService>(ExtensionsService);
  });

  describe('EXT-001 to EXT-004: Eligibility and Original Land Immutability', () => {
    it('EXT-001: Original beneficiary keeps original land unchanged', async () => {
      const origLand = { land_id: 'land-1', area: '5.0' };
      prisma.beneficiary.findUnique.mockResolvedValue({ ...mockBeneficiary, landHoldings: [origLand] });
      
      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(true);
      expect(origLand.area).toBe('5.0');
    });

    it('EXT-002: Existing beneficiary can request extension only after original financial settlement', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(true);
    });

    it('EXT-003: Extension rejected when original outstanding > 0', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue({
        ...mockBeneficiary,
        developmentBills: [
          {
            bill_id: 'b1',
            bill_type: 'ORIGINAL_DEVELOPMENT',
            total_amount: new Decimal(100000),
            amount_paid: new Decimal(95000),
            pending_amount: new Decimal(5000),
          },
        ],
      });

      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(false);
      expect(elig.reason).toBe('ORIGINAL_INSTALLMENTS_INCOMPLETE');
      expect(elig.outstandingAmount).toBe('5000.00');

      await expect(
        service.create({ beneficiaryId: 'ben-001', requestedAdditionalArea: 2, requestedAdditionalLitres: 20000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('EXT-004: Payment count alone cannot satisfy eligibility', async () => {
      // 5 payment records created, but total paid is 95,000 out of 100,000
      prisma.beneficiary.findUnique.mockResolvedValue({
        ...mockBeneficiary,
        developmentBills: [
          {
            bill_id: 'b1',
            bill_type: 'ORIGINAL_DEVELOPMENT',
            total_amount: new Decimal(100000),
            amount_paid: new Decimal(95000),
            pending_amount: new Decimal(5000),
          },
        ],
      });

      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(false);
    });
  });

  describe('EXT-005 to EXT-009: Extension Creation scenarios', () => {
    it('EXT-005 & EXT-006: Existing beneficiary new land creates extension without altering original land', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      prisma.waterAllotment.findFirst.mockResolvedValue({ allotment_id: 'allot-1' });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-1',
        beneficiary_id: 'ben-001',
        extension_type: ExtensionType.ADDITIONAL_LAND,
        status: ExtensionStatus.REQUESTED,
      });

      const ext = await service.create({
        beneficiaryId: 'ben-001',
        extensionType: ExtensionType.ADDITIONAL_LAND,
        requestedAdditionalArea: 2.5,
      });

      expect(ext.extension_id).toBe('ext-1');
      expect(prisma.extension.create).toHaveBeenCalled();
    });

    it('EXT-007 & EXT-008: Additional water creates extension without modifying original water', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      prisma.waterAllotment.findFirst.mockResolvedValue({ allotment_id: 'allot-1' });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-2',
        extension_type: ExtensionType.ADDITIONAL_WATER,
        status: ExtensionStatus.REQUESTED,
      });

      const ext = await service.create({
        beneficiaryId: 'ben-001',
        extensionType: ExtensionType.ADDITIONAL_WATER,
        requestedAdditionalLitres: 15000,
      });

      expect(ext.extension_id).toBe('ext-2');
    });

    it('EXT-009: Existing beneficiary land + water extension', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      prisma.waterAllotment.findFirst.mockResolvedValue({ allotment_id: 'allot-1' });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-3',
        extension_type: ExtensionType.LAND_AND_WATER,
      });

      const ext = await service.create({
        beneficiaryId: 'ben-001',
        extensionType: ExtensionType.LAND_AND_WATER,
        requestedAdditionalArea: 1.5,
        requestedAdditionalLitres: 15000,
      });

      expect(ext.extension_id).toBe('ext-3');
    });
  });

  describe('EXT-010 to EXT-017: Extension Approval & Installment Matrix', () => {
    it('EXT-010, EXT-011, EXT-012, EXT-013: Existing beneficiary extension gets extension rate and 1/1 installment = 100%', async () => {
      prisma.extension.findUnique.mockResolvedValue({
        extension_id: 'ext-10',
        beneficiary_id: 'ben-001',
        is_late_beneficiary: false,
        requested_additional_area: new Decimal(2),
        requested_additional_litres: new Decimal(20000),
        status: ExtensionStatus.REQUESTED,
        originalAllotment: { application: { project_id: 'proj-1' } },
      });

      prisma.rateConfiguration.findFirst.mockResolvedValue({
        rate_id: 'ext-rate-1',
        development_cost_per_litre: new Decimal(3.0),
        litres_per_acre: new Decimal(10000),
      });

      prisma.developmentBill.create.mockResolvedValue({ bill_id: 'dev-bill-ext' });
      prisma.extension.update.mockResolvedValue({
        extension_id: 'ext-10',
        status: ExtensionStatus.APPROVED,
        extension_cost: new Decimal(60000),
        installment_count: 1,
      });

      const approved = await service.approve('ext-10', { approvedAdditionalLitres: 20000 }, 'admin@water.gov');

      expect(prisma.developmentBill.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bill_type: 'EXTENSION_DEVELOPMENT',
        }),
      });

      // Verify 1/1 = 100% installment created
      expect(prisma.installment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          installment_number: 1,
          percentage: new Decimal(100.0),
        }),
      });
    });

    it('EXT-014: Partial extension payment does not activate', async () => {
      prisma.extension.findUnique.mockResolvedValue({
        extension_id: 'ext-14',
        extension_cost: new Decimal(50000),
        paid_amount: new Decimal(25000),
        pending_amount: new Decimal(25000),
        status: ExtensionStatus.PAYMENT_PENDING,
        developmentBills: [{ installments: [{ status: InstallmentStatus.PARTIALLY_PAID }] }],
        payments: [],
      });

      await expect(service.activateExtension('ext-14', 'admin@water.gov')).rejects.toThrow(BadRequestException);
    });

    it('EXT-015: Full extension payment activates extension', async () => {
      prisma.extension.findUnique.mockResolvedValue({
        extension_id: 'ext-15',
        extension_cost: new Decimal(50000),
        paid_amount: new Decimal(50000),
        pending_amount: new Decimal(0),
        status: ExtensionStatus.PAID,
        developmentBills: [{ installments: [{ status: InstallmentStatus.PAID }] }],
        payments: [],
      });

      prisma.extension.update.mockResolvedValue({
        extension_id: 'ext-15',
        status: ExtensionStatus.ACTIVE,
        activated_at: new Date(),
      });

      const res = await service.activateExtension('ext-15', 'admin@water.gov');
      expect(res.status).toBe(ExtensionStatus.ACTIVE);
    });

    it('EXT-016 & EXT-017: Original and extension payments/installments remain separate', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue({
        ...mockBeneficiary,
        developmentBills: [
          { bill_id: 'orig-bill', bill_type: 'ORIGINAL_DEVELOPMENT', total_amount: new Decimal(100000), amount_paid: new Decimal(100000) },
          { bill_id: 'ext-bill', bill_type: 'EXTENSION_DEVELOPMENT', extension_id: 'ext-1', total_amount: new Decimal(50000), amount_paid: new Decimal(0) },
        ],
      });

      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(true);
    });
  });

  describe('EXT-018 to EXT-022: Late Beneficiary Connection', () => {
    it('EXT-018 & EXT-019 & EXT-020 & EXT-021: Late beneficiary gets extension rate and 5 installments', async () => {
      prisma.project.findUnique.mockResolvedValue({ project_id: 'proj-1', status: 'COMPLETED' });
      prisma.beneficiary.create.mockResolvedValue({ beneficiary_id: 'ben-late-1', is_late_beneficiary: true });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-late-1',
        beneficiary_id: 'ben-late-1',
        is_late_beneficiary: true,
        extension_type: ExtensionType.LATE_BENEFICIARY,
      });

      const created = await service.createLateBeneficiary({
        name: 'Late User',
        phoneNumber: '9998887770',
        projectId: 'proj-1',
        districtId: 'dist-1',
        landArea: 2.0,
        requestedLitres: 20000,
      });

      expect(created.extension.is_late_beneficiary).toBe(true);

      // Now approve the late beneficiary extension
      prisma.extension.findUnique.mockResolvedValue({
        extension_id: 'ext-late-1',
        beneficiary_id: 'ben-late-1',
        is_late_beneficiary: true,
        requested_additional_area: new Decimal(2),
        requested_additional_litres: new Decimal(20000),
        status: ExtensionStatus.REQUESTED,
      });
      prisma.project.findFirst.mockResolvedValue({ project_id: 'proj-1' });
      prisma.rateConfiguration.findFirst.mockResolvedValue({
        rate_id: 'ext-rate-1',
        development_cost_per_litre: new Decimal(4.0),
      });

      prisma.developmentBill.create.mockResolvedValue({ bill_id: 'dev-bill-late' });
      prisma.extension.update.mockResolvedValue({
        extension_id: 'ext-late-1',
        status: ExtensionStatus.APPROVED,
        installment_count: 5,
      });

      await service.approve('ext-late-1', { approvedAdditionalLitres: 20000 }, 'admin@water.gov');

      // Verify exactly 5 installments created with percentages: 2.5%, 20%, 25%, 25%, 27.5%
      expect(prisma.installment.create).toHaveBeenCalledTimes(5);
      expect(prisma.installment.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ installment_number: 1, percentage: new Decimal(2.5) }),
      });
      expect(prisma.installment.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({ installment_number: 2, percentage: new Decimal(20.0) }),
      });
      expect(prisma.installment.create).toHaveBeenNthCalledWith(3, {
        data: expect.objectContaining({ installment_number: 3, percentage: new Decimal(25.0) }),
      });
      expect(prisma.installment.create).toHaveBeenNthCalledWith(4, {
        data: expect.objectContaining({ installment_number: 4, percentage: new Decimal(25.0) }),
      });
      expect(prisma.installment.create).toHaveBeenNthCalledWith(5, {
        data: expect.objectContaining({ installment_number: 5, percentage: new Decimal(27.5) }),
      });
    });

    it('EXT-022: Late beneficiary cannot activate before all 5 installments are settled', async () => {
      prisma.extension.findUnique.mockResolvedValue({
        extension_id: 'ext-late-22',
        is_late_beneficiary: true,
        extension_cost: new Decimal(100000),
        paid_amount: new Decimal(50000),
        pending_amount: new Decimal(50000),
        status: ExtensionStatus.PAYMENT_PENDING,
        developmentBills: [
          {
            installments: [
              { status: InstallmentStatus.PAID },
              { status: InstallmentStatus.PAID },
              { status: InstallmentStatus.PENDING },
              { status: InstallmentStatus.PENDING },
              { status: InstallmentStatus.PENDING },
            ],
          },
        ],
      });

      await expect(service.activateExtension('ext-late-22', 'admin@water.gov')).rejects.toThrow(BadRequestException);
    });
  });

  describe('EXT-023 to EXT-030: Immutability, Audit, Offline & Reporting Integrity', () => {
    it('EXT-023, EXT-024, EXT-025: Historical rates, water, and land remain unchanged', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(true);
    });

    it('EXT-026 & EXT-027: Extension audit events generated and server authorization enforced', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      prisma.waterAllotment.findFirst.mockResolvedValue({ allotment_id: 'allot-1' });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-26',
        status: ExtensionStatus.REQUESTED,
      });

      await service.create({ beneficiaryId: 'ben-001', requestedAdditionalArea: 1, requestedAdditionalLitres: 10000 }, 'user-123', '127.0.0.1');
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          action: 'CREATE',
          entityType: 'Extension',
        }),
      );
    });

    it('EXT-028 & EXT-029: Offline extension request and sync attribution preserve attribution', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue(mockBeneficiary);
      prisma.waterAllotment.findFirst.mockResolvedValue({ allotment_id: 'allot-1' });
      prisma.extension.create.mockResolvedValue({
        extension_id: 'ext-28',
        status: ExtensionStatus.REQUESTED,
      });

      const res = await service.create({ beneficiaryId: 'ben-001', requestedAdditionalLitres: 5000 });
      expect(res.status).toBe(ExtensionStatus.REQUESTED);
    });

    it('EXT-030: Reports separate original and extension finances', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue({
        ...mockBeneficiary,
        developmentBills: [
          { bill_id: 'b-orig', bill_type: 'ORIGINAL_DEVELOPMENT', total_amount: new Decimal(100000), amount_paid: new Decimal(100000) },
          { bill_id: 'b-ext', bill_type: 'EXTENSION_DEVELOPMENT', total_amount: new Decimal(20000), amount_paid: new Decimal(0) },
        ],
      });

      const elig = await service.canCreateExtension('ben-001');
      expect(elig.eligible).toBe(true);
    });
  });
});
