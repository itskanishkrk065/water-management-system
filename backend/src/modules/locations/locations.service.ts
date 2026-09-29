import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDistrictDto,
  CreateBlockDto,
  CreateVillageDto,
  CreatePanchayatDto,
  QueryVillagesDto,
  QueryBlocksDto,
  LocationSearchQueryDto,
} from './dto/location.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all districts (optionally filtered by search term or active status)
   */
  async findDistricts(query?: { search?: string; activeOnly?: boolean }) {
    const where: Prisma.DistrictWhereInput = {};
    if (query?.activeOnly !== undefined) {
      where.is_active = query.activeOnly;
    }
    if (query?.search) {
      where.name = { contains: query.search.trim() };
    }

    return this.prisma.district.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            blocks: true,
            panchayats: true,
            beneficiaries: true,
          },
        },
      },
    });
  }

  /**
   * Get district by ID
   */
  async getDistrictById(districtId: string) {
    const district = await this.prisma.district.findUnique({
      where: { district_id: districtId },
      include: {
        blocks: {
          orderBy: { name: 'asc' },
          include: {
            _count: { select: { villages: true } },
          },
        },
      },
    });
    if (!district) {
      throw new NotFoundException(`District with ID ${districtId} not found`);
    }
    return district;
  }

  /**
   * Create district manually
   */
  async createDistrict(dto: CreateDistrictDto) {
    const trimmedName = dto.name.trim();
    if (dto.lgdDistrictCode) {
      const existingCode = await this.prisma.district.findUnique({
        where: { lgd_district_code: dto.lgdDistrictCode },
      });
      if (existingCode) {
        throw new ConflictException(`District with LGD Code ${dto.lgdDistrictCode} already exists (${existingCode.name})`);
      }
    }

    return this.prisma.district.create({
      data: {
        name: trimmedName,
        lgd_district_code: dto.lgdDistrictCode || null,
        is_active: true,
      },
    });
  }

  /**
   * Get blocks (optionally filtered by districtId, search term, active status)
   */
  async findBlocks(districtId?: string, query?: QueryBlocksDto) {
    const where: Prisma.BlockWhereInput = {};
    if (districtId) {
      where.district_id = districtId;
    } else if (query?.districtId) {
      where.district_id = query.districtId;
    }
    if (query?.activeOnly !== undefined) {
      where.is_active = query.activeOnly;
    }
    if (query?.search) {
      where.name = { contains: query.search.trim() };
    }

    return this.prisma.block.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        district: { select: { district_id: true, name: true, lgd_district_code: true } },
        _count: { select: { villages: true, beneficiaries: true } },
      },
    });
  }

  /**
   * Get block by ID
   */
  async getBlockById(blockId: string) {
    const block = await this.prisma.block.findUnique({
      where: { block_id: blockId },
      include: {
        district: true,
        villages: {
          orderBy: { name: 'asc' },
          take: 100,
        },
        _count: { select: { villages: true, beneficiaries: true } },
      },
    });
    if (!block) {
      throw new NotFoundException(`Block with ID ${blockId} not found`);
    }
    return block;
  }

  /**
   * Create block manually
   */
  async createBlock(dto: CreateBlockDto) {
    const district = await this.prisma.district.findUnique({
      where: { district_id: dto.districtId },
    });
    if (!district) {
      throw new NotFoundException(`Parent district ${dto.districtId} not found`);
    }

    const existing = await this.prisma.block.findUnique({
      where: { lgd_block_code: dto.lgdBlockCode },
    });
    if (existing) {
      throw new ConflictException(`Block with LGD Code ${dto.lgdBlockCode} already exists (${existing.name})`);
    }

    return this.prisma.block.create({
      data: {
        district_id: dto.districtId,
        lgd_block_code: dto.lgdBlockCode,
        name: dto.name.trim(),
        is_active: true,
      },
      include: { district: true },
    });
  }

  /**
   * Get villages (optionally filtered by blockId, panchayatId, search term, with pagination)
   */
  async findVillages(blockId?: string, query?: QueryVillagesDto) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(200, query?.limit || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.VillageWhereInput = {};
    if (blockId) {
      where.block_id = blockId;
    } else if (query?.blockId) {
      where.block_id = query.blockId;
    }

    if (query?.panchayatId) {
      where.panchayat_id = query.panchayatId;
    }

    if (query?.activeOnly !== undefined) {
      where.is_active = query.activeOnly;
    }

    if (query?.search) {
      const s = query.search.trim();
      where.name = { contains: s };
    }

    const [items, total] = await Promise.all([
      this.prisma.village.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          block: {
            include: {
              district: {
                select: { district_id: true, name: true, lgd_district_code: true },
              },
            },
          },
          _count: { select: { beneficiaries: true } },
        },
      }),
      this.prisma.village.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single village by ID
   */
  async getVillageById(villageId: string) {
    const village = await this.prisma.village.findUnique({
      where: { village_id: villageId },
      include: {
        block: {
          include: {
            district: true,
          },
        },
        panchayat: {
          include: {
            district: true,
          },
        },
        _count: { select: { beneficiaries: true } },
      },
    });

    if (!village) {
      throw new NotFoundException(`Village with ID ${villageId} not found`);
    }

    return village;
  }

  /**
   * Create village manually
   */
  async createVillage(dto: CreateVillageDto) {
    if (dto.lgdVillageCode) {
      const existing = await this.prisma.village.findUnique({
        where: { lgd_village_code: dto.lgdVillageCode },
      });
      if (existing) {
        throw new ConflictException(`Village with LGD Code ${dto.lgdVillageCode} already exists (${existing.name})`);
      }
    }

    return this.prisma.village.create({
      data: {
        block_id: dto.blockId || null,
        panchayat_id: dto.panchayatId || null,
        lgd_village_code: dto.lgdVillageCode || null,
        name: dto.name.trim(),
        is_active: true,
      },
      include: {
        block: { include: { district: true } },
      },
    });
  }

  /**
   * Search across districts, blocks, and villages
   */
  async searchLocations(dto: LocationSearchQueryDto) {
    const search = dto.search.trim();
    const limit = Math.max(1, Math.min(50, dto.limit || 10));

    const [districts, blocks, villages] = await Promise.all([
      this.prisma.district.findMany({
        where: {
          name: { contains: search },
          is_active: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.block.findMany({
        where: {
          name: { contains: search },
          is_active: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          district: { select: { district_id: true, name: true, lgd_district_code: true } },
        },
      }),
      this.prisma.village.findMany({
        where: {
          name: { contains: search },
          is_active: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          block: {
            include: {
              district: { select: { district_id: true, name: true, lgd_district_code: true } },
            },
          },
        },
      }),
    ]);

    return {
      districts,
      blocks,
      villages,
    };
  }

  /**
   * Get administrative hierarchy tree
   */
  async getHierarchyTree(districtId?: string) {
    const where: Prisma.DistrictWhereInput = { is_active: true };
    if (districtId) {
      where.district_id = districtId;
    }

    return this.prisma.district.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        blocks: {
          where: { is_active: true },
          orderBy: { name: 'asc' },
          include: {
            villages: {
              where: { is_active: true },
              orderBy: { name: 'asc' },
              take: 50, // Limit per block to prevent overwhelming payload size
            },
            _count: { select: { villages: true } },
          },
        },
        panchayats: {
          orderBy: { name: 'asc' },
          include: {
            villages: {
              orderBy: { name: 'asc' },
              take: 50,
            },
          },
        },
        _count: { select: { blocks: true, beneficiaries: true } },
      },
    });
  }

  // Legacy compatibility methods for Panchayats
  async findPanchayats(districtId?: string) {
    return this.prisma.panchayat.findMany({
      where: districtId ? { district_id: districtId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        district: true,
        _count: { select: { villages: true, beneficiaries: true } },
      },
    });
  }

  async createPanchayat(dto: CreatePanchayatDto) {
    return this.prisma.panchayat.create({
      data: {
        district_id: dto.districtId,
        name: dto.name.trim(),
      },
      include: { district: true },
    });
  }
}
