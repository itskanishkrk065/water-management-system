import { Test, TestingModule } from '@nestjs/testing';
import { BeneficiariesService } from './beneficiaries.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BeneficiaryStatus, LandStatus } from '../common/enums';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

describe('BeneficiariesService - Administrative Management', () => {
  let service: BeneficiariesService;
  let prisma: any;
  let auditService: any;

  const mockPrisma = {
    beneficiary: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    district: { findUnique: jest.fn() },
    block: { findUnique: jest.fn() },
    panchayat: { findUnique: jest.fn() },
    village: { findUnique: jest.fn() },
    auditLog: { findMany: jest.fn() },
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BeneficiariesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<BeneficiariesService>(BeneficiariesService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('getObligationsSummary', () => {
    it('should compute total obligations and flag active bindings', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        name: 'Ravi Kumar',
        status: BeneficiaryStatus.ACTIVE,
        waterApplications: [{ application_id: 'app-1' }],
        waterAllotments: [{ approved_litres: 50000 }],
        developmentBills: [
          {
            pending_amount: new Decimal('25000'),
            installments: [{ installment_id: 'inst-1' }, { installment_id: 'inst-2' }],
          },
        ],
        infrastructures: [{ infrastructure_id: 'infra-1' }],
        extensions: [],
      });

      const result = await service.getObligationsSummary('ben-1');

      expect(result.beneficiaryId).toBe('ben-1');
      expect(result.hasObligations).toBe(true);
      expect(result.activeApplicationsCount).toBe(1);
      expect(result.approvedAllotmentsCount).toBe(1);
      expect(result.approvedWaterLitres).toBe('50000');
      expect(result.totalPendingAmount).toBe('25000');
      expect(result.pendingInstallmentsCount).toBe(2);
      expect(result.activeInfrastructureCount).toBe(1);
      expect(result.warningMessage).toContain('50000 L approved water');
    });
  });

  describe('deactivateBeneficiary', () => {
    it('should deactivate beneficiary and log audit when valid reason is provided', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        name: 'Ravi Kumar',
        status: BeneficiaryStatus.ACTIVE,
        waterApplications: [],
        waterAllotments: [],
        developmentBills: [],
        infrastructures: [],
        extensions: [],
      });

      mockPrisma.beneficiary.update.mockResolvedValue({
        beneficiary_id: 'ben-1',
        name: 'Ravi Kumar',
        status: BeneficiaryStatus.INACTIVE,
      });

      const res = await service.deactivateBeneficiary('ben-1', 'Relocated out of district', 'admin-1', '127.0.0.1');

      expect(res.status).toBe(BeneficiaryStatus.INACTIVE);
      expect(mockPrisma.beneficiary.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { beneficiary_id: 'ben-1' },
          data: { status: BeneficiaryStatus.INACTIVE },
        }),
      );
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-1',
          entityType: 'Beneficiary',
          entityId: 'ben-1',
          reason: 'Relocated out of district',
        }),
      );
    });

    it('should throw BadRequestException if reason is missing', async () => {
      await expect(service.deactivateBeneficiary('ben-1', '   ', 'admin-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reactivateBeneficiary', () => {
    it('should reactivate inactive beneficiary and log audit', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        name: 'Ravi Kumar',
        status: BeneficiaryStatus.INACTIVE,
      });
      mockPrisma.beneficiary.update.mockResolvedValue({
        beneficiary_id: 'ben-1',
        status: BeneficiaryStatus.ACTIVE,
      });

      const res = await service.reactivateBeneficiary('ben-1', 'Returned and reopened farming', 'admin-1');

      expect(res.status).toBe(BeneficiaryStatus.ACTIVE);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: { status: BeneficiaryStatus.ACTIVE },
          reason: 'Returned and reopened farming',
        }),
      );
    });
  });

  describe('archiveBeneficiary', () => {
    it('should archive beneficiary and log archive audit', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        name: 'Ravi Kumar',
        status: BeneficiaryStatus.ACTIVE,
      });
      mockPrisma.beneficiary.update.mockResolvedValue({
        beneficiary_id: 'ben-1',
        status: BeneficiaryStatus.INACTIVE,
      });

      const res = await service.archiveBeneficiary('ben-1', 'Long term historical archiving', 'admin-1');

      expect(res.status).toBe(BeneficiaryStatus.INACTIVE);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          newValues: { status: 'ARCHIVED' },
          reason: 'ARCHIVE: Long term historical archiving',
        }),
      );
    });
  });

  describe('checkDuplicates', () => {
    it('should find potential duplicates matching phone number', async () => {
      mockPrisma.beneficiary.findMany.mockResolvedValue([
        {
          beneficiary_id: 'ben-99',
          name: 'Ravi K',
          phone_number: '9876543210',
          email: 'ravi@example.com',
          district: { name: 'Coimbatore' },
          block: { name: 'Pollachi North' },
          village: { name: 'Angambakkam' },
          landHoldings: [{ declared_total_area: new Decimal('3.50') }],
          status: BeneficiaryStatus.ACTIVE,
        },
      ]);

      const result = await service.checkDuplicates({ phoneNumber: '9876543210' }, 'ben-new');

      expect(result.found).toBe(true);
      expect(result.matches.length).toBe(1);
      expect(result.matches[0].name).toBe('Ravi K');
      expect(result.matches[0].totalLandAcres).toBe('3.5');
    });

    it('should return found=false if no criteria match', async () => {
      mockPrisma.beneficiary.findMany.mockResolvedValue([]);
      const result = await service.checkDuplicates({ phoneNumber: '9999999999' });
      expect(result.found).toBe(false);
      expect(result.matches.length).toBe(0);
    });
  });

  describe('toggleAccountStatus & forcePasswordReset', () => {
    it('should toggle linked user account is_active state', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        user_id: 'usr-1',
        user: { user_id: 'usr-1', is_active: true },
      });
      mockPrisma.user.update.mockResolvedValue({
        user_id: 'usr-1',
        is_active: false,
      });

      const res = await service.toggleAccountStatus('ben-1', false, 'Security lockout', 'admin-1');

      expect(res.success).toBe(true);
      expect(res.isActive).toBe(false);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'UserAccount',
          entityId: 'usr-1',
          newValues: { is_active: false },
        }),
      );
    });

    it('should record force password reset audit event', async () => {
      mockPrisma.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        user_id: 'usr-1',
        user: { user_id: 'usr-1', is_active: true },
      });

      const res = await service.forcePasswordReset('ben-1', 'User forgot credentials', 'admin-1');

      expect(res.success).toBe(true);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'UserAccount',
          entityId: 'usr-1',
          newValues: { passwordResetRequested: true },
        }),
      );
    });
  });
});
