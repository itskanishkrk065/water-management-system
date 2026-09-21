import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';
import { AuditAction, BeneficiaryStatus, LandStatus, Prisma } from '@prisma/client';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class BeneficiariesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async lookupByPhone(phone: string) {
    const trimmed = phone.trim();
    const beneficiary = await this.prisma.beneficiary.findFirst({
      where: { phone_number: trimmed },
      include: {
        district: true,
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

    const beneficiary = await this.prisma.beneficiary.create({
      data: {
        name: dto.name,
        phone_number: dto.phoneNumber.trim(),
        address_line_1: dto.addressLine1,
        address_line_2: dto.addressLine2,
        address_line_3: dto.addressLine3,
        district_id: dto.districtId,
        panchayat_id: dto.panchayatId,
        village_id: dto.villageId,
        pincode: dto.pincode,
        location_direction: dto.locationDirection,
        location_description: dto.locationDescription,
        status: dto.status || BeneficiaryStatus.ACTIVE,
      },
      include: {
        district: true,
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
      reason: 'Created new beneficiary profile',
      ipAddress,
    });

    return beneficiary;
  }

  async findAll(query: {
    search?: string;
    districtId?: string;
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

    // Fetch related audit logs for the History tab
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

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: id },
      data: {
        name: dto.name,
        phone_number: dto.phoneNumber?.trim(),
        address_line_1: dto.addressLine1,
        address_line_2: dto.addressLine2,
        address_line_3: dto.addressLine3,
        pincode: dto.pincode,
        location_direction: dto.locationDirection,
        location_description: dto.locationDescription,
        status: dto.status,
      },
      include: {
        district: true,
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
      reason: 'Updated beneficiary details',
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
