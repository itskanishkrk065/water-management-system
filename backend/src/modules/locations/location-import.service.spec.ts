import { Test, TestingModule } from '@nestjs/testing';
import { LocationImportService } from './location-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { LocationImportStatus } from '@prisma/client';
import * as xlsx from 'xlsx';

describe('LocationImportService', () => {
  let service: LocationImportService;
  let prisma: any;
  let auditService: any;

  const mockPrisma = {
    locationImport: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    district: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    block: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    village: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrisma)),
  };

  const mockAuditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationImportService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<LocationImportService>(LocationImportService);
    prisma = module.get<PrismaService>(PrismaService);
    auditService = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  // Helper to create in-memory Excel file buffer
  function createExcelBuffer(headers: string[], rows: any[][]): Buffer {
    const wb = xlsx.utils.book_new();
    const wsData = [headers, ...rows];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  describe('processAndPreviewExcel', () => {
    it('should successfully parse valid Excel rows and return accurate preview counts', async () => {
      const headers = [
        'LGD District Code',
        'District Name',
        'LGD Block code',
        'Block Name',
        'LGD Village Code',
        'Village Name',
      ];
      const rows = [
        [528, '  KANCHEEPURAM  ', 6482, 'KANCHEEPURAM', 223994, 'Angambakkam'],
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223995, 'Ariyaperumpakkam'],
        [529, 'COIMBATORE', 6490, 'POLLACHI NORTH', 224001, 'Annamalai'],
      ];
      const buffer = createExcelBuffer(headers, rows);

      mockPrisma.district.findMany.mockResolvedValue([{ lgd_district_code: 528 }]);
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockPrisma.village.findMany.mockResolvedValue([]);
      mockPrisma.locationImport.create.mockResolvedValue({
        import_id: 'import-uuid-1',
        status: LocationImportStatus.VALIDATED,
      });

      const result = await service.processAndPreviewExcel(buffer, 'locations.xlsx', 'admin@water.gov');

      expect(result.totalRows).toBe(3);
      expect(result.validRows).toBe(3);
      expect(result.invalidRows).toBe(0);
      expect(result.existingDistricts).toBe(1); // 528 exists
      expect(result.newDistricts).toBe(1); // 529 is new
      expect(result.newBlocks).toBe(2);
      expect(result.newVillages).toBe(3);
      expect(result.status).toBe(LocationImportStatus.VALIDATED);
      expect(mockPrisma.locationImport.create).toHaveBeenCalled();
    });

    it('should reject file and throw BadRequestException when required column is missing', async () => {
      const headers = [
        'LGD District Code',
        'District Name',
        'LGD Block code',
        'Block Name',
        // 'LGD Village Code' is missing!
        'Village Name',
      ];
      const rows = [[528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 'Angambakkam']];
      const buffer = createExcelBuffer(headers, rows);
      mockPrisma.locationImport.create.mockResolvedValue({ import_id: 'fail-1' });

      await expect(
        service.processAndPreviewExcel(buffer, 'broken.xlsx', 'admin@water.gov'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.processAndPreviewExcel(buffer, 'broken.xlsx', 'admin@water.gov'),
      ).rejects.toThrow(/Missing required column.*LGD Village Code/i);
    });

    it('should be tolerant of header casing, whitespace, and synonyms', async () => {
      const headers = [
        ' lgd district code ',
        'DISTRICT_NAME',
        'lgd_block_code',
        'Block  Name',
        'LGD Village Code',
        'Village name',
      ];
      const rows = [[528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223994, 'Angambakkam']];
      const buffer = createExcelBuffer(headers, rows);

      mockPrisma.district.findMany.mockResolvedValue([]);
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockPrisma.village.findMany.mockResolvedValue([]);
      mockPrisma.locationImport.create.mockResolvedValue({ import_id: 'uuid-success' });

      const result = await service.processAndPreviewExcel(buffer, 'tolerant.xlsx', 'admin@water.gov');
      expect(result.validRows).toBe(1);
      expect(result.invalidRows).toBe(0);
    });

    it('should flag rows with empty or non-numeric codes', async () => {
      const headers = [
        'LGD District Code',
        'District Name',
        'LGD Block code',
        'Block Name',
        'LGD Village Code',
        'Village Name',
      ];
      const rows = [
        ['invalid_code', 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223994, 'Angambakkam'], // invalid district code
        [528, '', 6482, 'KANCHEEPURAM', 223995, 'Ariyaperumpakkam'], // empty district name
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223996, ''], // empty village name
      ];
      const buffer = createExcelBuffer(headers, rows);

      mockPrisma.district.findMany.mockResolvedValue([]);
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockPrisma.village.findMany.mockResolvedValue([]);
      mockPrisma.locationImport.create.mockResolvedValue({ import_id: 'uuid-err' });

      const result = await service.processAndPreviewExcel(buffer, 'invalid_rows.xlsx', 'admin@water.gov');
      expect(result.validRows).toBe(0);
      expect(result.invalidRows).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect conflicting district names for the same LGD code', async () => {
      const headers = [
        'LGD District Code',
        'District Name',
        'LGD Block code',
        'Block Name',
        'LGD Village Code',
        'Village Name',
      ];
      const rows = [
        [528, 'KANCHEEPURAM', 6482, 'KANCHEEPURAM', 223994, 'Angambakkam'],
        [528, 'CHENNAI_CONFLICT', 6482, 'KANCHEEPURAM', 223995, 'Ariyaperumpakkam'],
      ];
      const buffer = createExcelBuffer(headers, rows);

      mockPrisma.district.findMany.mockResolvedValue([]);
      mockPrisma.block.findMany.mockResolvedValue([]);
      mockPrisma.village.findMany.mockResolvedValue([]);
      mockPrisma.locationImport.create.mockResolvedValue({ import_id: 'uuid-conflict' });

      const result = await service.processAndPreviewExcel(buffer, 'conflict.xlsx', 'admin@water.gov');
      expect(result.errors.some((e) => e.reason.includes('Conflicting district names'))).toBe(true);
    });
  });

  describe('confirmImport', () => {
    it('should execute transactional upsert and update status to IMPORTED', async () => {
      const mockImportRecord = {
        import_id: 'imp-1',
        file_name: 'test.xlsx',
        status: LocationImportStatus.VALIDATED,
        preview_data: {
          parsedRows: [
            {
              rowNumber: 2,
              lgdDistrictCode: 528,
              districtName: 'KANCHEEPURAM',
              lgdBlockCode: 6482,
              blockName: 'KANCHEEPURAM',
              lgdVillageCode: 223994,
              villageName: 'Angambakkam',
            },
          ],
        },
      };

      mockPrisma.locationImport.findUnique.mockResolvedValue(mockImportRecord);
      mockPrisma.district.findUnique.mockResolvedValue(null);
      mockPrisma.district.create.mockResolvedValue({ district_id: 'dist-uuid-1' });
      mockPrisma.block.findUnique.mockResolvedValue(null);
      mockPrisma.block.create.mockResolvedValue({ block_id: 'block-uuid-1' });
      mockPrisma.village.findUnique.mockResolvedValue(null);
      mockPrisma.village.create.mockResolvedValue({ village_id: 'vil-uuid-1' });
      mockPrisma.locationImport.update.mockResolvedValue({ import_id: 'imp-1', status: LocationImportStatus.IMPORTED });

      const result = await service.confirmImport('imp-1', 'admin-user-uuid');

      expect(result.status).toBe(LocationImportStatus.IMPORTED);
      expect(result.summary.districtsCreated).toBe(1);
      expect(result.summary.blocksCreated).toBe(1);
      expect(result.summary.villagesCreated).toBe(1);
      expect(mockPrisma.locationImport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { import_id: 'imp-1' },
          data: expect.objectContaining({ status: LocationImportStatus.IMPORTED }),
        }),
      );
    });

    it('should reject already imported files', async () => {
      mockPrisma.locationImport.findUnique.mockResolvedValue({
        import_id: 'imp-2',
        status: LocationImportStatus.IMPORTED,
      });

      await expect(service.confirmImport('imp-2', 'admin-user-uuid')).rejects.toThrow(ConflictException);
    });
  });
});
