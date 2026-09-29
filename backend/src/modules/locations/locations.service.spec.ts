import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService } from './locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: any;

  const mockPrisma = {
    district: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    block: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    village: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
    },
    panchayat: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findDistricts', () => {
    it('should return districts ordered by name ASC', async () => {
      mockPrisma.district.findMany.mockResolvedValue([
        { district_id: 'd1', name: 'Coimbatore', lgd_district_code: 528 },
        { district_id: 'd2', name: 'Tiruppur', lgd_district_code: 600 },
      ]);

      const result = await service.findDistricts();
      expect(result.length).toBe(2);
      expect(mockPrisma.district.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });
  });

  describe('findBlocks', () => {
    it('should filter blocks by districtId when provided', async () => {
      mockPrisma.block.findMany.mockResolvedValue([
        { block_id: 'b1', name: 'Pollachi North', district_id: 'd1', lgd_block_code: 6482 },
      ]);

      const result = await service.findBlocks('d1');
      expect(result.length).toBe(1);
      expect(mockPrisma.block.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { district_id: 'd1' },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findVillages', () => {
    it('should filter villages by blockId and support search & pagination', async () => {
      mockPrisma.village.findMany.mockResolvedValue([
        { village_id: 'v1', name: 'Angambakkam', block_id: 'b1', lgd_village_code: 223994 },
      ]);
      mockPrisma.village.count.mockResolvedValue(1);

      const result = await service.findVillages('b1', { search: 'anga', page: 1, limit: 50 });
      expect(result.items.length).toBe(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockPrisma.village.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            block_id: 'b1',
            name: { contains: 'anga', mode: 'insensitive' },
          }),
        }),
      );
    });
  });

  describe('searchLocations', () => {
    it('should search across districts, blocks, and villages', async () => {
      mockPrisma.district.findMany.mockResolvedValue([{ name: 'Coimbatore' }]);
      mockPrisma.block.findMany.mockResolvedValue([{ name: 'Coimbatore South' }]);
      mockPrisma.village.findMany.mockResolvedValue([{ name: 'Coimbatore Village' }]);

      const result = await service.searchLocations({ search: 'Coimbatore', limit: 5 });
      expect(result.districts.length).toBe(1);
      expect(result.blocks.length).toBe(1);
      expect(result.villages.length).toBe(1);
    });
  });
});
