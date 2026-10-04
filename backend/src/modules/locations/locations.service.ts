import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDistrictDto,
  CreateBlockDto,
  CreateRevenueVillageDto,
  CreateVillageDto,
  CreatePanchayatDto,
  UpdateDistrictDto,
  UpdateBlockDto,
  UpdateRevenueVillageDto,
  UpdateVillageDto,
  UpdatePanchayatDto,
  QueryRevenueVillagesDto,
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
    } else {
      // Default to active districts only for general queries
      where.is_active = true;
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

  /**
   * Update District
   */
  async updateDistrict(districtId: string, dto: UpdateDistrictDto) {
    const existing = await this.prisma.district.findUnique({ where: { district_id: districtId } });
    if (!existing) {
      throw new NotFoundException(`District with ID ${districtId} not found`);
    }

    if (dto.lgdDistrictCode && dto.lgdDistrictCode !== existing.lgd_district_code) {
      const codeCheck = await this.prisma.district.findUnique({ where: { lgd_district_code: dto.lgdDistrictCode } });
      if (codeCheck) {
        throw new ConflictException(`District with LGD Code ${dto.lgdDistrictCode} already exists (${codeCheck.name})`);
      }
    }

    return this.prisma.district.update({
      where: { district_id: districtId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        lgd_district_code: dto.lgdDistrictCode !== undefined ? dto.lgdDistrictCode : undefined,
        is_active: dto.isActive !== undefined ? dto.isActive : undefined,
      },
    });
  }

  /**
   * Safe Delete or Deactivate District
   */
  async deleteDistrict(districtId: string) {
    const district = await this.prisma.district.findUnique({
      where: { district_id: districtId },
      include: {
        _count: {
          select: { blocks: true, panchayats: true, beneficiaries: true },
        },
      },
    });
    if (!district) {
      throw new NotFoundException(`District with ID ${districtId} not found`);
    }

    const { blocks, panchayats, beneficiaries } = district._count;
    if (blocks > 0 || panchayats > 0 || beneficiaries > 0) {
      throw new BadRequestException(
        `Cannot delete district '${district.name}' because it is referenced by ${blocks} block(s), ${panchayats} panchayat(s), and ${beneficiaries} beneficiary record(s). Please deactivate the district instead to preserve historical integrity.`,
      );
    }

    await this.prisma.district.delete({ where: { district_id: districtId } });
    return { success: true, message: `District '${district.name}' was permanently deleted.` };
  }

  /**
   * Update Block
   */
  async updateBlock(blockId: string, dto: UpdateBlockDto) {
    const existing = await this.prisma.block.findUnique({ where: { block_id: blockId } });
    if (!existing) {
      throw new NotFoundException(`Block with ID ${blockId} not found`);
    }

    if (dto.lgdBlockCode && dto.lgdBlockCode !== existing.lgd_block_code) {
      const codeCheck = await this.prisma.block.findUnique({ where: { lgd_block_code: dto.lgdBlockCode } });
      if (codeCheck) {
        throw new ConflictException(`Block with LGD Code ${dto.lgdBlockCode} already exists (${codeCheck.name})`);
      }
    }

    return this.prisma.block.update({
      where: { block_id: blockId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        district_id: dto.districtId !== undefined ? dto.districtId : undefined,
        lgd_block_code: dto.lgdBlockCode !== undefined ? dto.lgdBlockCode : undefined,
        is_active: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: { district: true },
    });
  }

  /**
   * Safe Delete Block
   */
  async deleteBlock(blockId: string) {
    const block = await this.prisma.block.findUnique({
      where: { block_id: blockId },
      include: {
        _count: {
          select: { villages: true, beneficiaries: true },
        },
      },
    });
    if (!block) {
      throw new NotFoundException(`Block with ID ${blockId} not found`);
    }

    const { villages, beneficiaries } = block._count;
    if (villages > 0 || beneficiaries > 0) {
      throw new BadRequestException(
        `Cannot delete block '${block.name}' because it contains ${villages} village(s) and ${beneficiaries} beneficiary record(s). Please deactivate the block instead.`,
      );
    }

    await this.prisma.block.delete({ where: { block_id: blockId } });
    return { success: true, message: `Block '${block.name}' was permanently deleted.` };
  }

  /**
   * Update Village
   */
  async updateVillage(villageId: string, dto: UpdateVillageDto) {
    const existing = await this.prisma.village.findUnique({ where: { village_id: villageId } });
    if (!existing) {
      throw new NotFoundException(`Village with ID ${villageId} not found`);
    }

    if (dto.lgdVillageCode && dto.lgdVillageCode !== existing.lgd_village_code) {
      const codeCheck = await this.prisma.village.findUnique({ where: { lgd_village_code: dto.lgdVillageCode } });
      if (codeCheck) {
        throw new ConflictException(`Village with LGD Code ${dto.lgdVillageCode} already exists (${codeCheck.name})`);
      }
    }

    return this.prisma.village.update({
      where: { village_id: villageId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        block_id: dto.blockId !== undefined ? dto.blockId : undefined,
        panchayat_id: dto.panchayatId !== undefined ? dto.panchayatId : undefined,
        lgd_village_code: dto.lgdVillageCode !== undefined ? dto.lgdVillageCode : undefined,
        is_active: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: { block: { include: { district: true } } },
    });
  }

  /**
   * Safe Delete Village
   */
  async deleteVillage(villageId: string) {
    const village = await this.prisma.village.findUnique({
      where: { village_id: villageId },
      include: {
        _count: {
          select: { beneficiaries: true },
        },
      },
    });
    if (!village) {
      throw new NotFoundException(`Village with ID ${villageId} not found`);
    }

    if (village._count.beneficiaries > 0) {
      throw new BadRequestException(
        `Cannot delete village '${village.name}' because it is linked to ${village._count.beneficiaries} registered beneficiary record(s). Please deactivate the village instead.`,
      );
    }

    await this.prisma.village.delete({ where: { village_id: villageId } });
    return { success: true, message: `Village '${village.name}' was permanently deleted.` };
  }

  /**
   * Update Panchayat
   */
  async updatePanchayat(panchayatId: string, dto: UpdatePanchayatDto) {
    const existing = await this.prisma.panchayat.findUnique({ where: { panchayat_id: panchayatId } });
    if (!existing) {
      throw new NotFoundException(`Panchayat with ID ${panchayatId} not found`);
    }

    return this.prisma.panchayat.update({
      where: { panchayat_id: panchayatId },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        district_id: dto.districtId !== undefined ? dto.districtId : undefined,
      },
      include: { district: true },
    });
  }

  /**
   * Safe Delete Panchayat
   */
  async deletePanchayat(panchayatId: string) {
    const panchayat = await this.prisma.panchayat.findUnique({
      where: { panchayat_id: panchayatId },
      include: {
        _count: {
          select: { villages: true, beneficiaries: true },
        },
      },
    });
    if (!panchayat) {
      throw new NotFoundException(`Panchayat with ID ${panchayatId} not found`);
    }

    const { villages, beneficiaries } = panchayat._count;
    if (villages > 0 || beneficiaries > 0) {
      throw new BadRequestException(
        `Cannot delete panchayat '${panchayat.name}' because it is linked to ${villages} village(s) and ${beneficiaries} beneficiary record(s).`,
      );
    }

    await this.prisma.panchayat.delete({ where: { panchayat_id: panchayatId } });
    return { success: true, message: `Panchayat '${panchayat.name}' was permanently deleted.` };
  }

  // --- REVENUE VILLAGES ---

  async findRevenueVillages(blockId?: string, query?: QueryRevenueVillagesDto) {
    const where: Prisma.RevenueVillageWhereInput = {};
    const bId = blockId || query?.blockId;
    if (bId) {
      where.block_id = bId;
    }
    if (query?.activeOnly !== undefined) {
      where.is_active = query.activeOnly;
    }
    if (query?.search) {
      where.name = { contains: query.search.trim() };
    }

    const page = query?.page || 1;
    const limit = query?.limit || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.revenueVillage.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          block: { include: { district: true } },
          _count: { select: { villages: true, beneficiaries: true } },
        },
      }),
      this.prisma.revenueVillage.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getRevenueVillageById(id: string) {
    const rv = await this.prisma.revenueVillage.findUnique({
      where: { revenue_village_id: id },
      include: {
        block: { include: { district: true } },
        villages: { orderBy: { name: 'asc' } },
      },
    });
    if (!rv) throw new NotFoundException(`Revenue Village with ID ${id} not found`);
    return rv;
  }

  async createRevenueVillage(dto: CreateRevenueVillageDto) {
    const block = await this.prisma.block.findUnique({ where: { block_id: dto.blockId } });
    if (!block) throw new NotFoundException(`Block with ID ${dto.blockId} not found`);

    if (dto.lgdRevenueVillageCode) {
      const codeCheck = await this.prisma.revenueVillage.findUnique({
        where: { lgd_revenue_village_code: dto.lgdRevenueVillageCode },
      });
      if (codeCheck) {
        throw new ConflictException(`Revenue Village with LGD Code ${dto.lgdRevenueVillageCode} already exists`);
      }
    }

    return this.prisma.revenueVillage.create({
      data: {
        block_id: dto.blockId,
        name: dto.name.trim(),
        lgd_revenue_village_code: dto.lgdRevenueVillageCode || null,
        is_active: true,
      },
      include: { block: { include: { district: true } } },
    });
  }

  async updateRevenueVillage(id: string, dto: UpdateRevenueVillageDto) {
    const existing = await this.prisma.revenueVillage.findUnique({ where: { revenue_village_id: id } });
    if (!existing) throw new NotFoundException(`Revenue Village with ID ${id} not found`);

    return this.prisma.revenueVillage.update({
      where: { revenue_village_id: id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        block_id: dto.blockId !== undefined ? dto.blockId : undefined,
        lgd_revenue_village_code: dto.lgdRevenueVillageCode !== undefined ? dto.lgdRevenueVillageCode : undefined,
        is_active: dto.isActive !== undefined ? dto.isActive : undefined,
      },
      include: { block: { include: { district: true } } },
    });
  }

  async deleteRevenueVillage(id: string) {
    const rv = await this.prisma.revenueVillage.findUnique({
      where: { revenue_village_id: id },
      include: { _count: { select: { villages: true, beneficiaries: true } } },
    });
    if (!rv) throw new NotFoundException(`Revenue Village with ID ${id} not found`);

    const { villages, beneficiaries } = rv._count;
    if (villages > 0 || beneficiaries > 0) {
      throw new BadRequestException(
        `Cannot delete Revenue Village '${rv.name}' because historical records reference it (${villages} village(s), ${beneficiaries} beneficiary(ies)). Please deactivate it instead.`,
      );
    }

    await this.prisma.revenueVillage.delete({ where: { revenue_village_id: id } });
    return { success: true, message: `Revenue Village '${rv.name}' was permanently deleted.` };
  }

  // --- TOGGLE ACTIVE ENDPOINTS ---

  async toggleDistrictActive(id: string) {
    const district = await this.prisma.district.findUnique({ where: { district_id: id } });
    if (!district) throw new NotFoundException(`District with ID ${id} not found`);

    return this.prisma.district.update({
      where: { district_id: id },
      data: { is_active: !district.is_active },
    });
  }

  async toggleBlockActive(id: string) {
    const block = await this.prisma.block.findUnique({ where: { block_id: id } });
    if (!block) throw new NotFoundException(`Block with ID ${id} not found`);

    return this.prisma.block.update({
      where: { block_id: id },
      data: { is_active: !block.is_active },
    });
  }

  async toggleRevenueVillageActive(id: string) {
    const rv = await this.prisma.revenueVillage.findUnique({ where: { revenue_village_id: id } });
    if (!rv) throw new NotFoundException(`Revenue Village with ID ${id} not found`);

    return this.prisma.revenueVillage.update({
      where: { revenue_village_id: id },
      data: { is_active: !rv.is_active },
    });
  }

  async toggleVillageActive(id: string) {
    const village = await this.prisma.village.findUnique({ where: { village_id: id } });
    if (!village) throw new NotFoundException(`Village with ID ${id} not found`);

    return this.prisma.village.update({
      where: { village_id: id },
      data: { is_active: !village.is_active },
    });
  }

  // --- HIERARCHY VALIDATION ---

  async validateHierarchy(params: {
    districtId?: string;
    blockId?: string;
    revenueVillageId?: string;
    villageId?: string;
  }) {
    const { districtId, blockId, revenueVillageId, villageId } = params;

    if (blockId && districtId) {
      const block = await this.prisma.block.findUnique({ where: { block_id: blockId } });
      if (!block || block.district_id !== districtId) {
        throw new BadRequestException('Selected Block does not belong to the selected District');
      }
    }

    if (revenueVillageId && blockId) {
      const rv = await this.prisma.revenueVillage.findUnique({ where: { revenue_village_id: revenueVillageId } });
      if (!rv || rv.block_id !== blockId) {
        throw new BadRequestException('Selected Revenue Village does not belong to the selected Block');
      }
    }

    if (villageId && revenueVillageId) {
      const village = await this.prisma.village.findUnique({ where: { village_id: villageId } });
      if (!village || village.revenue_village_id !== revenueVillageId) {
        throw new BadRequestException('Selected Village does not belong to the selected Revenue Village');
      }
    }

    return { valid: true };
  }
}

