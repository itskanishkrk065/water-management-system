import { Test, TestingModule } from '@nestjs/testing';
import { WaterService } from './water.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';

describe('WaterService Lifecycle and Regression Suite', () => {
  let service: WaterService;
  let prisma: any;

  const mockPrismaService = {
    beneficiary: {
      findUnique: jest.fn(),
    },
    waterApplication: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    landHolding: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    rateConfiguration: {
      findFirst: jest.fn(),
    },
    installmentTemplate: {
      findFirst: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue({}),
    recordAudit: jest.fn().mockResolvedValue({}),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<WaterService>(WaterService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('Water Application Lifecycle and History Invariants', () => {
    it('should reject application creation if active land holding does not exist or is inactive', async () => {
      mockPrismaService.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        landHoldings: [], // No active land holdings
      });

      await expect(
        service.createApplication(
          {
            beneficiaryId: 'ben-1',
            landId: 'land-1',
            applicationType: 'NEW_CONNECTION' as any,
            requestedLitres: 1000,
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow new application if previous applications on holding were CANCELLED or REJECTED', async () => {
      mockPrismaService.beneficiary.findUnique.mockResolvedValue({
        beneficiary_id: 'ben-1',
        project_id: 'proj-1',
        landHoldings: [
          {
            land_id: 'land-1',
            status: 'ACTIVE',
            total_area_acres: 5.0,
            parcels: [{ parcel_id: 'p-1', area_acres: 5.0 }],
          },
        ],
      });

      // Rate configuration
      mockPrismaService.rateConfiguration.findFirst.mockResolvedValue({
        rate_id: 'rate-1',
        rate_per_litre: 2.5,
        water_per_acre_litres: 1000,
        is_active: true,
      });

      // No active (SUBMITTED/UNDER_REVIEW/APPROVED) application
      mockPrismaService.waterApplication.findFirst.mockResolvedValue(null);
      mockPrismaService.waterApplication.create.mockResolvedValue({
        application_id: 'app-2',
        land_id: 'land-1',
        status: 'SUBMITTED',
        application_number: 'APP-2026-0002',
      });

      const result = await service.createApplication(
        {
          beneficiaryId: 'ben-1',
          landId: 'land-1',
          applicationType: 'NEW_CONNECTION' as any,
          requiredLitres: 1200,
        } as any,
        'user-1',
      );

      expect(result).toBeDefined();
    });

    it('should transition an application to CANCELLED without deleting the record', async () => {
      mockPrismaService.waterApplication.findUnique.mockResolvedValue({
        application_id: 'app-1',
        status: 'SUBMITTED',
        land_id: 'land-1',
      });
      mockPrismaService.waterApplication.update.mockResolvedValue({
        application_id: 'app-1',
        status: 'CANCELLED',
      });

      const result = await service.cancelApplication('app-1', 'User withdrew request', 'user-1');

      expect(result.status).toBe('CANCELLED');
      expect(mockPrismaService.waterApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { application_id: 'app-1' },
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });
  });
});
