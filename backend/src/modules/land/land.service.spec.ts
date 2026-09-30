import { Test, TestingModule } from '@nestjs/testing';
import { LandService } from './land.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from 'decimal.js';

describe('LandService', () => {
  let service: LandService;
  let prisma: any;
  let audit: any;

  beforeEach(async () => {
    prisma = {
      beneficiary: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      landHolding: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      landParcel: {
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    audit = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LandService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<LandService>(LandService);
  });

  describe('createHoldingWithParcels - Survey/Subdivision Uniqueness & Area Validation', () => {
    it('CASE 1: should accept same survey with different subdivisions (101/1A + 101/1B)', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue({ beneficiary_id: 'ben-1' });
      prisma.project.findUnique.mockResolvedValue({ project_id: 'proj-1', project_name: 'KB Scheme', status: 'ACTIVE' });
      prisma.landHolding.create.mockResolvedValue({ land_id: 'land-1', declared_total_area: new Decimal(5.7) });
      prisma.landHolding.findUnique.mockResolvedValue({
        land_id: 'land-1',
        declared_total_area: new Decimal(5.7),
        parcels: [
          { survey_number: '101', subdivision_number: '1A', area: new Decimal(2.7) },
          { survey_number: '101', subdivision_number: '1B', area: new Decimal(3.0) },
        ],
      });

      const result = await service.createHoldingWithParcels({
        beneficiaryId: 'ben-1',
        projectId: 'proj-1',
        declaredTotalArea: 5.7,
        parcels: [
          { surveyNumber: '101', subdivisionNumber: '1A', area: 2.7 },
          { surveyNumber: '101', subdivisionNumber: '1B', area: 3.0 },
        ],
      });

      expect(result).toBeDefined();
      expect(prisma.landParcel.createMany).toHaveBeenCalledWith({
        data: [
          { land_id: 'land-1', survey_number: '101', subdivision_number: '1A', area: new Decimal(2.7), area_unit: 'ACRES' },
          { land_id: 'land-1', survey_number: '101', subdivision_number: '1B', area: new Decimal(3.0), area_unit: 'ACRES' },
        ],
      });
    });

    it('CASE 2: should accept different survey with same subdivision (101/1A + 102/1A)', async () => {
      prisma.beneficiary.findUnique.mockResolvedValue({ beneficiary_id: 'ben-1' });
      prisma.project.findUnique.mockResolvedValue({ project_id: 'proj-1', project_name: 'KB Scheme', status: 'ACTIVE' });
      prisma.landHolding.create.mockResolvedValue({ land_id: 'land-1', declared_total_area: new Decimal(5.0) });
      prisma.landHolding.findUnique.mockResolvedValue({
        land_id: 'land-1',
        parcels: [
          { survey_number: '101', subdivision_number: '1A', area: new Decimal(2.5) },
          { survey_number: '102', subdivision_number: '1A', area: new Decimal(2.5) },
        ],
      });

      const result = await service.createHoldingWithParcels({
        beneficiaryId: 'ben-1',
        projectId: 'proj-1',
        declaredTotalArea: 5.0,
        parcels: [
          { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
          { surveyNumber: '102', subdivisionNumber: '1A', area: 2.5 },
        ],
      });

      expect(result).toBeDefined();
    });

    it('CASE 3: should REJECT duplicate survey + subdivision (101/1A + 101/1A) in same holding payload', async () => {
      await expect(
        service.createHoldingWithParcels({
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          declaredTotalArea: 5.0,
          parcels: [
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('CASE 3b: should REJECT duplicate survey + subdivision with leading/trailing whitespace and mixed case (" 101 " / " 1a " vs "101" / "1A")', async () => {
      await expect(
        service.createHoldingWithParcels({
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          declaredTotalArea: 5.0,
          parcels: [
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
            { surveyNumber: ' 101 ', subdivisionNumber: ' 1a ', area: 2.5 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('CASE 4: should REJECT area checksum mismatch (Declared 5.70 != Parcels 2.70 + 2.50 = 5.20)', async () => {
      await expect(
        service.createHoldingWithParcels({
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          declaredTotalArea: 5.7,
          parcels: [
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.7 },
            { surveyNumber: '101', subdivisionNumber: '1B', area: 2.5 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateHoldingWithParcels', () => {
    it('should update declared area and replace parcels atomically', async () => {
      prisma.landHolding.findUnique
        .mockResolvedValueOnce({
          land_id: 'land-1',
          project_id: 'proj-1',
          declared_total_area: new Decimal(5.0),
          area_unit: 'ACRES',
          status: 'ACTIVE',
        })
        .mockResolvedValueOnce({
          land_id: 'land-1',
          declared_total_area: new Decimal(6.0),
          parcels: [
            { survey_number: '101', subdivision_number: '1A', area: new Decimal(3.0) },
            { survey_number: '101', subdivision_number: '1B', area: new Decimal(3.0) },
          ],
        });

      const updated = await service.updateHoldingWithParcels('land-1', {
        declaredTotalArea: 6.0,
        parcels: [
          { surveyNumber: '101', subdivisionNumber: '1A', area: 3.0 },
          { surveyNumber: '101', subdivisionNumber: '1B', area: 3.0 },
        ],
      });

      expect(updated).toBeDefined();
      expect(prisma.landHolding.update).toHaveBeenCalled();
      expect(prisma.landParcel.deleteMany).toHaveBeenCalledWith({ where: { land_id: 'land-1' } });
      expect(prisma.landParcel.createMany).toHaveBeenCalled();
    });

    it('should REJECT update if duplicate parcels are passed (e.g. 101/1B edited to 101/1A)', async () => {
      prisma.landHolding.findUnique.mockResolvedValue({
        land_id: 'land-1',
        project_id: 'proj-1',
        declared_total_area: new Decimal(5.0),
        area_unit: 'ACRES',
        status: 'ACTIVE',
      });

      await expect(
        service.updateHoldingWithParcels('land-1', {
          declaredTotalArea: 5.0,
          parcels: [
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
            { surveyNumber: '101', subdivisionNumber: '1A', area: 2.5 },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if holding does not exist', async () => {
      prisma.landHolding.findUnique.mockResolvedValue(null);

      await expect(
        service.updateHoldingWithParcels('non-existent', { declaredTotalArea: 5.0 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
