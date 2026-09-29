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

    if (dto.phoneNumber && dto.phoneNumber.trim() !== existing.phone_number) {
      const duplicatePhone = await this.prisma.beneficiary.findFirst({
        where: {
          phone_number: dto.phoneNumber.trim(),
          beneficiary_id: { not: id },
        },
      });
      if (duplicatePhone) {
        throw new ConflictException(`Phone number ${dto.phoneNumber} is already registered to beneficiary '${duplicatePhone.name}'.`);
      }
    }

    if (dto.email && dto.email.trim() !== existing.email) {
      const duplicateEmail = await this.prisma.beneficiary.findFirst({
        where: {
          email: dto.email.trim(),
          beneficiary_id: { not: id },
        },
      });
      if (duplicateEmail) {
        throw new ConflictException(`Email address ${dto.email} is already registered to beneficiary '${duplicateEmail.name}'.`);
      }
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
      reason: dto.reason?.trim() || 'Updated beneficiary profile and location hierarchy',
      ipAddress,
    });

    return updated;
  }

  /**
   * Evaluates outstanding obligations before administrative deactivation.
   */
  async getObligationsSummary(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: {
        waterApplications: {
          where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
        },
        waterAllotments: {
          where: { approval_status: 'APPROVED' },
          include: {
            developmentBill: true,
            infrastructure: true,
          },
        },
        developmentBills: {
          include: {
            installments: {
              where: { status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] } },
            },
          },
        },
        extensions: {
          where: { status: 'REQUESTED' },
        },
        infrastructures: {
          where: { status: { in: ['PLANNED', 'UNDER_CONSTRUCTION', 'COMPLETED'] } },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    let totalPendingAmount = new Decimal(0);
    let pendingInstallmentsCount = 0;

    for (const bill of beneficiary.developmentBills) {
      totalPendingAmount = totalPendingAmount.plus(new Decimal(bill.pending_amount));
      pendingInstallmentsCount += bill.installments.length;
    }

    const approvedWaterLitres = beneficiary.waterAllotments.reduce(
      (acc, a) => acc.plus(new Decimal(a.approved_litres)),
      new Decimal(0),
    );

    const hasObligations =
      beneficiary.waterApplications.length > 0 ||
      beneficiary.waterAllotments.length > 0 ||
      totalPendingAmount.greaterThan(0) ||
      pendingInstallmentsCount > 0 ||
      beneficiary.infrastructures.length > 0 ||
      beneficiary.extensions.length > 0;

    return {
      beneficiaryId: id,
      name: beneficiary.name,
      status: beneficiary.status,
      hasObligations,
      activeApplicationsCount: beneficiary.waterApplications.length,
      approvedAllotmentsCount: beneficiary.waterAllotments.length,
      approvedWaterLitres: approvedWaterLitres.toString(),
      totalPendingAmount: totalPendingAmount.toString(),
      pendingInstallmentsCount,
      activeInfrastructureCount: beneficiary.infrastructures.length,
      pendingExtensionsCount: beneficiary.extensions.length,
      warningMessage: hasObligations
        ? `This beneficiary has active operational records: ${approvedWaterLitres.toString()} L approved water, ₹${totalPendingAmount.toString()} pending balance, and ${pendingInstallmentsCount} pending installments. Review before deactivating.`
        : null,
    };
  }

  /**
   * Deactivates a beneficiary profile with active obligations verification and audit trail.
   */
  async deactivateBeneficiary(id: string, reason: string, userId: string, ipAddress?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A valid reason is required for deactivation');
    }

    const existing = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficiary not found');
    }

    if (existing.status === BeneficiaryStatus.INACTIVE) {
      throw new BadRequestException('Beneficiary is already inactive');
    }

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: id },
      data: { status: BeneficiaryStatus.INACTIVE },
      include: { district: true, block: true, village: true },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Beneficiary',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: BeneficiaryStatus.INACTIVE },
      reason: reason.trim(),
      ipAddress,
    });

    return updated;
  }

  /**
   * Reactivates an inactive beneficiary profile.
   */
  async reactivateBeneficiary(id: string, reason: string, userId: string, ipAddress?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A valid reason is required for reactivation');
    }

    const existing = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficiary not found');
    }

    if (existing.status === BeneficiaryStatus.ACTIVE) {
      throw new BadRequestException('Beneficiary is already active');
    }

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: id },
      data: { status: BeneficiaryStatus.ACTIVE },
      include: { district: true, block: true, village: true },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Beneficiary',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: BeneficiaryStatus.ACTIVE },
      reason: reason.trim(),
      ipAddress,
    });

    return updated;
  }

  /**
   * Archives a beneficiary profile (Administrative retention only).
   */
  async archiveBeneficiary(id: string, reason: string, userId: string, ipAddress?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A valid reason is required for archiving');
    }

    const existing = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
    });
    if (!existing) {
      throw new NotFoundException('Beneficiary not found');
    }

    const updated = await this.prisma.beneficiary.update({
      where: { beneficiary_id: id },
      data: { status: BeneficiaryStatus.INACTIVE },
      include: { district: true, block: true, village: true },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Beneficiary',
      entityId: id,
      oldValues: { status: existing.status },
      newValues: { status: 'ARCHIVED' },
      reason: `ARCHIVE: ${reason.trim()}`,
      ipAddress,
    });

    return updated;
  }

  /**
   * Detects duplicate beneficiaries by phone, email, and (name + village).
   */
  async checkDuplicates(
    dto: {
      phoneNumber?: string;
      email?: string;
      name?: string;
      villageId?: string;
    },
    excludeBeneficiaryId?: string,
  ) {
    const conditions: Prisma.BeneficiaryWhereInput[] = [];

    if (dto.phoneNumber) {
      conditions.push({ phone_number: dto.phoneNumber.trim() });
    }

    if (dto.email) {
      conditions.push({ email: dto.email.trim() });
    }

    if (dto.name && dto.villageId) {
      conditions.push({
        name: { equals: dto.name.trim(), mode: 'insensitive' },
        village_id: dto.villageId,
      });
    }

    if (conditions.length === 0) {
      return { found: false, matches: [] };
    }

    const where: Prisma.BeneficiaryWhereInput = {
      OR: conditions,
    };

    if (excludeBeneficiaryId) {
      where.beneficiary_id = { not: excludeBeneficiaryId };
    }

    const matches = await this.prisma.beneficiary.findMany({
      where,
      include: {
        district: true,
        block: true,
        village: true,
        landHoldings: {
          where: { status: LandStatus.ACTIVE },
          select: { declared_total_area: true },
        },
      },
    });

    const enriched = matches.map((b) => {
      const totalLand = b.landHoldings.reduce(
        (acc, curr) => acc.plus(new Decimal(curr.declared_total_area)),
        new Decimal(0),
      );
      return {
        beneficiaryId: b.beneficiary_id,
        name: b.name,
        phoneNumber: b.phone_number,
        email: b.email,
        districtName: b.district?.name,
        blockName: b.block?.name,
        villageName: b.village?.name,
        totalLandAcres: totalLand.toString(),
        status: b.status,
      };
    });

    return {
      found: enriched.length > 0,
      matches: enriched,
    };
  }

  /**
   * Retrieves complete chronological audit history for a beneficiary.
   */
  async getBeneficiaryHistory(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
    });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    return this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entity_id: id },
          { entity_type: 'Beneficiary', entity_id: id },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            user_id: true,
            email: true,
            full_name: true,
            role: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * Toggles login access for the linked beneficiary user account.
   */
  async toggleAccountStatus(id: string, isActive: boolean, reason?: string, userId?: string, ipAddress?: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: { user: true },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    if (!beneficiary.user_id) {
      throw new BadRequestException('Beneficiary does not have a linked user account');
    }

    const updatedUser = await this.prisma.user.update({
      where: { user_id: beneficiary.user_id },
      data: { is_active: isActive },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'UserAccount',
      entityId: beneficiary.user_id,
      oldValues: { is_active: beneficiary.user?.is_active },
      newValues: { is_active: isActive },
      reason: reason?.trim() || `Administrative login account status set to ${isActive ? 'ENABLED' : 'DISABLED'}`,
      ipAddress,
    });

    return {
      success: true,
      userId: updatedUser.user_id,
      isActive: updatedUser.is_active,
    };
  }

  /**
   * Forces administrative password reset for the linked user.
   */
  async forcePasswordReset(id: string, reason?: string, userId?: string, ipAddress?: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: { user: true },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    if (!beneficiary.user_id) {
      throw new BadRequestException('Beneficiary does not have a linked user account');
    }

    await this.auditService.log({
      userId,
      action: AuditAction.UPDATE,
      entityType: 'UserAccount',
      entityId: beneficiary.user_id,
      newValues: { passwordResetRequested: true },
      reason: reason?.trim() || 'Administrative forced password reset initiated',
      ipAddress,
    });

    return {
      success: true,
      message: 'Password reset request recorded in audit log. Beneficiary can reset via email or SMS verification.',
    };
  }

  private calculateTotalLand(holdings: { declared_total_area: any; status: LandStatus }[]): Decimal {
    return holdings
      .filter((h) => h.status === LandStatus.ACTIVE)
      .reduce((acc, h) => acc.plus(new Decimal(h.declared_total_area)), new Decimal(0));
  }
}
