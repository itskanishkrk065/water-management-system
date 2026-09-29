import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';
import { AuditAction, BeneficiaryStatus, LandStatus, Prisma } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class BeneficiariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Validates cascading location consistency:
   * 1. District exists
   * 2. If blockId provided, block exists and belongs to districtId
   * 3. If villageId provided, village exists and belongs to blockId (or panchayatId)
   */
  private async validateLocationHierarchy(
    districtId?: string,
    blockId?: string,
    villageId?: string,
    panchayatId?: string,
  ) {
    if (districtId) {
      const district = await this.prisma.district.findUnique({
        where: { district_id: districtId },
      });
      if (!district) {
        throw new BadRequestException(`District with ID '${districtId}' not found`);
      }
    }

    if (blockId) {
      const block = await this.prisma.block.findUnique({
        where: { block_id: blockId },
      });
      if (!block) {
        throw new BadRequestException(`Block with ID '${blockId}' not found`);
      }
      if (districtId && block.district_id !== districtId) {
        throw new BadRequestException(
          `Location mismatch: Selected Block does not belong to the selected District.`,
        );
      }
    }

    if (villageId) {
      const village = await this.prisma.village.findUnique({
        where: { village_id: villageId },
        include: {
          block: true,
          panchayat: true,
        },
      });
      if (!village) {
        throw new BadRequestException(`Village with ID '${villageId}' not found`);
      }

      if (blockId && village.block_id && village.block_id !== blockId) {
        throw new BadRequestException(
          `Location mismatch: Selected Village does not belong to the selected Block.`,
        );
      }

      if (districtId) {
        const parentDistId = village.block?.district_id || village.panchayat?.district_id;
        if (parentDistId && parentDistId !== districtId) {
          throw new BadRequestException(
            `Location mismatch: Selected Village does not belong to the selected District.`,
          );
        }
      }
    }
  }

  async lookupByPhone(phone: string) {
    const trimmed = phone.trim();
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { phone_number: trimmed },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
        landHoldings: {
          where: { status: LandStatus.ACTIVE },
          include: {
            parcels: true,
            project: { select: { project_id: true, project_code: true, project_name: true } },
          },
        },
        waterApplications: {
          orderBy: { created_at: 'desc' },
          include: { allotment: true },
        },
      },
    });

    if (!beneficiary) {
      return { found: false, beneficiary: null };
    }

    const totalLand = this.calculateTotalLand(beneficiary.landHoldings);

    return {
      found: true,
      beneficiary: {
        ...beneficiary,
        total_land_acres: totalLand.toString(),
      },
    };
  }

  async create(dto: CreateBeneficiaryDto, userId?: string, ipAddress?: string) {
    const existing = await this.prisma.beneficiary.findFirst({
      where: { phone_number: dto.phoneNumber.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Beneficiary with phone number '${dto.phoneNumber}' already exists with ID ${existing.beneficiary_id}. Please use lookup to view or add land.`,
      );
    }

    // Strictly validate location hierarchy
    await this.validateLocationHierarchy(
      dto.districtId,
      dto.blockId,
      dto.villageId,
      dto.panchayatId,
    );

    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        name: dto.name.trim(),
        email: dto.email?.trim() || null,
        phone_number: dto.phoneNumber.trim(),
        address_line_1: dto.addressLine1?.trim(),
        address_line_2: dto.addressLine2?.trim() || null,
        address_line_3: dto.addressLine3?.trim() || null,
        district_id: dto.districtId,
        block_id: dto.blockId || null,
        panchayat_id: dto.panchayatId || null,
        village_id: dto.villageId,
        pincode: dto.pincode?.trim(),
        location_direction: dto.locationDirection,
        location_description: dto.locationDescription?.trim() || null,
        status: dto.status || BeneficiaryStatus.ACTIVE,
      },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Beneficiary',
      entityId: beneficiary.beneficiary_id,
      newValues: beneficiary,
      reason: 'Created new beneficiary profile with verified location hierarchy',
      ipAddress,
    });

    return beneficiary;
  }

  async findAll(query: {
    search?: string;
    districtId?: string;
    blockId?: string;
    panchayatId?: string;
    status?: BeneficiaryStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.BeneficiaryWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.districtId) where.district_id = query.districtId;
    if (query.blockId) where.block_id = query.blockId;
    if (query.panchayatId) where.panchayat_id = query.panchayatId;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone_number: { contains: query.search } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.beneficiary.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          district: true,
          block: true,
          panchayat: true,
          village: true,
          landHoldings: {
            where: { status: LandStatus.ACTIVE },
            select: { declared_total_area: true },
          },
          _count: {
            select: {
              landHoldings: true,
              waterApplications: true,
              waterAllotments: true,
            },
          },
        },
      }),
      this.prisma.beneficiary.count({ where }),
    ]);

    const enriched = items.map((b) => {
      const totalLand = b.landHoldings.reduce(
        (acc, curr) => acc.plus(new Decimal(curr.declared_total_area)),
        new Decimal(0),
      );
      return {
        ...b,
        total_land_acres: totalLand.toString(),
      };
    });

    return {
      items: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
        landHoldings: {
          orderBy: { created_at: 'asc' },
          include: {
            parcels: { orderBy: { created_at: 'asc' } },
            project: { select: { project_id: true, project_code: true, project_name: true } },
          },
        },
        waterApplications: {
          orderBy: { created_at: 'desc' },
          include: {
            project: true,
            allotment: true,
          },
        },
        waterAllotments: {
          orderBy: { created_at: 'desc' },
          include: {
            rate: true,
            developmentBill: {
              include: {
                installments: { orderBy: { installment_number: 'asc' } },
              },
            },
            infrastructure: true,
            runningBills: { orderBy: { created_at: 'desc' } },
            extensions: { orderBy: { created_at: 'desc' } },
          },
        },
        developmentBills: {
          orderBy: { created_at: 'desc' },
          include: {
            installments: { orderBy: { installment_number: 'asc' } },
          },
        },
        payments: {
          orderBy: { payment_date: 'desc' },
        },
        infrastructures: {
          orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
        },
        runningBills: {
          orderBy: { created_at: 'desc' },
        },
        extensions: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const totalLand = this.calculateTotalLand(beneficiary.landHoldings);

    // Fetch related audit logs for History
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity_type: 'Beneficiary', entity_id: id },
          {
            entity_type: { in: ['LandHolding', 'WaterApplication', 'WaterAllotment', 'Payment', 'Infrastructure', 'Extension'] },
          },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      include: {
        user: { select: { email: true, full_name: true, role: { select: { name: true } } } },
      },
    });

    return {
      ...beneficiary,
      total_land_acres: totalLand.toString(),
      history: auditLogs,
    };
  }

  async update(id: string, dto: UpdateBeneficiaryDto, userId?: string, ipAddress?: string) {
    const existing = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficiary not found');
    }

    const effectiveDistrictId = dto.districtId !== undefined ? dto.districtId : existing.district_id;
    const effectiveBlockId = dto.blockId !== undefined ? dto.blockId : existing.block_id;
    const effectiveVillageId = dto.villageId !== undefined ? dto.villageId : existing.village_id;

    if (dto.districtId || dto.blockId || dto.villageId) {
      await this.validateLocationHierarchy(
        effectiveDistrictId || undefined,
        effectiveBlockId || undefined,
        effectiveVillageId || undefined,
      );
    }

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: id },
      data: {
        name: dto.name?.trim(),
        email: dto.email?.trim(),
        phone_number: dto.phoneNumber?.trim(),
        address_line_1: dto.addressLine1?.trim(),
        address_line_2: dto.addressLine2?.trim(),
        address_line_3: dto.addressLine3?.trim(),
        district_id: dto.districtId !== undefined ? dto.districtId : undefined,
        block_id: dto.blockId !== undefined ? dto.blockId : undefined,
        panchayat_id: dto.panchayatId !== undefined ? dto.panchayatId : undefined,
        village_id: dto.villageId !== undefined ? dto.villageId : undefined,
        pincode: dto.pincode?.trim(),
        location_direction: dto.locationDirection,
        location_description: dto.locationDescription?.trim(),
        status: dto.status,
      },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Beneficiary',
      entityId: id,
      oldValues: existing,
      newValues: updated,
      reason: 'Updated beneficiary profile and location hierarchy',
      ipAddress,
    });

    return updated;
  }

  private calculateTotalLand(holdings: { declared_total_area: any; status: LandStatus }[]): Decimal {
    return holdings
      .filter((h) => h.status === LandStatus.ACTIVE)
      .reduce((acc, h) => acc.plus(new Decimal(h.declared_total_area)), new Decimal(0));
  }
}
