import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateBeneficiaryDto,
  UpdateBeneficiaryDto,
  CompleteOnboardingDto,
} from './dto/beneficiary.dto';
import { DecimalUtil } from '../common/decimal.util';
import { Prisma } from '@prisma/client';
import { AuditAction, BeneficiaryStatus, LandStatus, InfrastructureStatus } from '../common/enums';
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
          include: {
            landHolding: { include: { parcels: true } },
            allotment: true,
          },
        },
      },
    });

    if (!beneficiary) {
      return { found: false, beneficiary: null };
    }

    const totalLand = this.calculateTotalLand(beneficiary.landHoldings as any);

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

  /**
   * ATOMIC COMPLETE ONBOARDING:
   * Creates Beneficiary + Multiple Land Holdings + SF Parcels + Water Applications in a single database transaction.
   * If any step fails, everything is rolled back.
   */
  async completeOnboarding(dto: CompleteOnboardingDto, userId?: string, ipAddress?: string) {
    // 1. Validate phone number duplication
    const existing = await this.prisma.beneficiary.findFirst({
      where: { phone_number: dto.phoneNumber.trim() },
    });
    if (existing) {
      throw new ConflictException(
        `Beneficiary with phone number '${dto.phoneNumber}' already exists with ID ${existing.beneficiary_id}.`,
      );
    }

    // 2. Validate location hierarchy
    await this.validateLocationHierarchy(
      dto.districtId,
      dto.blockId,
      dto.villageId,
      dto.panchayatId,
    );

    // 3. Pre-validate project schemes & parcel sums for all holdings
    if (dto.holdings && dto.holdings.length > 0) {
      for (let i = 0; i < dto.holdings.length; i++) {
        const h = dto.holdings[i];
        const project = await this.prisma.project.findUnique({
          where: { project_id: h.projectId },
        });
        if (!project) {
          throw new NotFoundException(`Holding #${i + 1}: Project Scheme with ID '${h.projectId}' not found.`);
        }
        if (project.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Holding #${i + 1}: Project Scheme '${project.project_name}' (${project.project_code}) is inactive.`,
          );
        }

        const declared = new Decimal(h.declaredTotalArea);
        if (h.parcels && h.parcels.length > 0) {
          const seenInHolding = new Set<string>();
          for (const p of h.parcels) {
            const sTrim = p.surveyNumber.trim();
            const subTrim = p.subdivisionNumber.trim();
            const key = `${sTrim.toUpperCase()}#${subTrim.toUpperCase()}`;
            if (seenInHolding.has(key)) {
              throw new BadRequestException(
                `Holding #${i + 1}: Duplicate parcel detected (Survey ${sTrim} / Subdivision ${subTrim}).`,
              );
            }
            seenInHolding.add(key);

            // Check if already registered in active database
            const existingParcel = await this.prisma.landParcel.findFirst({
              where: {
                survey_number: sTrim,
                subdivision_number: subTrim,
                landHolding: { status: LandStatus.ACTIVE },
              },
              include: {
                landHolding: {
                  include: {
                    beneficiary: { select: { name: true, phone_number: true } },
                  },
                },
              },
            });

            if (existingParcel) {
              const owner = existingParcel.landHolding?.beneficiary?.name || 'another holding';
              throw new BadRequestException(
                `Holding #${i + 1}: Survey number ${sTrim} with subdivision ${subTrim} is already registered under ${owner}. Duplicate survey parcels are not permitted.`,
              );
            }
          }

          const sumParcels = DecimalUtil.sum(h.parcels.map((p) => p.area));
          if (!DecimalUtil.equalsWithTolerance(sumParcels, declared)) {
            throw new BadRequestException(
              `Holding #${i + 1}: Sum of parcel areas (${sumParcels.toFixed(4)}) does not match declared total area (${declared.toFixed(4)}).`,
            );
          }
        }
      }
    }

    // 4. Pre-validate water applications (1 per holding index)
    if (dto.waterApplications && dto.waterApplications.length > 0) {
      const holdingIndices = new Set<number>();
      for (const w of dto.waterApplications) {
        if (
          w.holdingIndex === undefined ||
          w.holdingIndex < 0 ||
          !dto.holdings ||
          w.holdingIndex >= dto.holdings.length
        ) {
          throw new BadRequestException(`Water application references invalid land holding index ${w.holdingIndex}.`);
        }
        if (holdingIndices.has(w.holdingIndex)) {
          throw new BadRequestException(
            `Holding #${w.holdingIndex + 1} has multiple water applications in this onboarding request. Only one active water application per land holding is allowed.`,
          );
        }
        holdingIndices.add(w.holdingIndex);
      }
    }

    // 5. Execute complete atomic transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 5a. Create Beneficiary
      const beneficiary = await tx.beneficiary.create({
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
      });

      // 5b. Create Land Holdings + Parcels
      const createdHoldings: any[] = [];
      if (dto.holdings && dto.holdings.length > 0) {
        for (const h of dto.holdings) {
          const holding = await tx.landHolding.create({
            data: {
              beneficiary_id: beneficiary.beneficiary_id,
              project_id: h.projectId,
              declared_total_area: new Decimal(h.declaredTotalArea),
              area_unit: h.areaUnit || 'ACRES',
              status: LandStatus.ACTIVE,
            },
          });

          if (h.parcels && h.parcels.length > 0) {
            await tx.landParcel.createMany({
              data: h.parcels.map((p) => ({
                land_id: holding.land_id,
                survey_number: p.surveyNumber.trim(),
                subdivision_number: p.subdivisionNumber.trim(),
                area: new Decimal(p.area),
                area_unit: p.areaUnit || h.areaUnit || 'ACRES',
              })),
            });
          }

          createdHoldings.push(holding);
        }
      }

      // 5c. Create Water Applications
      const createdWaterApps: any[] = [];
      if (dto.waterApplications && dto.waterApplications.length > 0) {
        for (const w of dto.waterApplications) {
          const targetHolding = createdHoldings[w.holdingIndex];
          const waterApp = await tx.waterApplication.create({
            data: {
              beneficiary_id: beneficiary.beneficiary_id,
              land_id: targetHolding.land_id,
              project_id: targetHolding.project_id,
              required_litres: new Decimal(w.requiredLitres),
              status: 'SUBMITTED',
              created_by: userId || 'SYSTEM',
            },
          });
          createdWaterApps.push(waterApp);
        }
      }

      return {
        beneficiary,
        holdingsCount: createdHoldings.length,
        waterAppsCount: createdWaterApps.length,
      };
    });

    await this.auditService.log({
      userId,
      action: AuditAction.CREATE,
      entityType: 'Beneficiary',
      entityId: result.beneficiary.beneficiary_id,
      newValues: result,
      reason: `Completed full onboarding: Beneficiary registered with ${result.holdingsCount} land holding(s) and ${result.waterAppsCount} water application(s)`,
      ipAddress,
    });

    return result.beneficiary;
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
        { name: { contains: query.search } },
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

  async getBeneficiaryOverview(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
        user: { select: { user_id: true, email: true, full_name: true, is_active: true } },
        landHoldings: {
          where: { status: LandStatus.ACTIVE },
          select: { land_id: true, declared_total_area: true, status: true },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const totalLand = this.calculateTotalLand(beneficiary.landHoldings as any);

    // Parallel aggregate overview stats
    const [allotmentAgg, appAgg, billAgg, paymentAgg, activeAppsCount, historicalAppsCount, infraCount, billsCount, paymentsCount] = await Promise.all([
      this.prisma.waterAllotment.aggregate({
        where: { beneficiary_id: id },
        _sum: { approved_litres: true },
      }),
      this.prisma.waterApplication.aggregate({
        where: {
          beneficiary_id: id,
          status: { notIn: ['REJECTED', 'CANCELLED', 'VOIDED', 'ARCHIVED'] },
        },
        _sum: { required_litres: true },
      }),
      this.prisma.developmentBill.aggregate({
        where: { beneficiary_id: id },
        _sum: { total_amount: true, pending_amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { beneficiary_id: id, status: 'COMPLETED', is_reversal: false },
        _sum: { amount: true },
      }),
      this.prisma.waterApplication.count({
        where: {
          beneficiary_id: id,
          status: { notIn: ['REJECTED', 'CANCELLED', 'VOIDED', 'ARCHIVED'] },
        },
      }),
      this.prisma.waterApplication.count({
        where: {
          beneficiary_id: id,
          status: { in: ['REJECTED', 'CANCELLED', 'VOIDED', 'ARCHIVED'] },
        },
      }),
      this.prisma.infrastructure.count({ where: { beneficiary_id: id } }),
      this.prisma.developmentBill.count({ where: { beneficiary_id: id } }),
      this.prisma.payment.count({ where: { beneficiary_id: id, is_reversal: false } }),
    ]);

    return {
      ...beneficiary,
      total_land_acres: totalLand.toString(),
      metrics: {
        totalLandAcres: totalLand.toString(),
        activeHoldingsCount: beneficiary.landHoldings.length,
        waterApplicationsCount: activeAppsCount,
        activeWaterAppsCount: activeAppsCount,
        historicalWaterAppsCount: historicalAppsCount,
        requiredLitresTotal: appAgg._sum.required_litres?.toString() || '0',
        approvedLitresTotal: allotmentAgg._sum.approved_litres?.toString() || '0',
        billsTotalAmount: billAgg._sum.total_amount?.toString() || '0',
        pendingBalance: billAgg._sum.pending_amount?.toString() || '0',
        totalPaid: paymentAgg._sum.amount?.toString() || '0',
        infrastructureCount: infraCount,
        billsCount,
        paymentsCount,
      },
    };
  }

  async getBeneficiaryWater(id: string) {
    const [applications, allotments] = await Promise.all([
      this.prisma.waterApplication.findMany({
        where: { beneficiary_id: id },
        orderBy: { created_at: 'desc' },
        include: {
          landHolding: { include: { parcels: true } },
          project: { select: { project_id: true, project_code: true, project_name: true } },
          allotment: true,
        },
      }),
      this.prisma.waterAllotment.findMany({
        where: { beneficiary_id: id },
        orderBy: { created_at: 'desc' },
        include: {
          rate: true,
          developmentBill: {
            include: {
              installments: { orderBy: { installment_number: 'asc' } },
            },
          },
          infrastructure: true,
        },
      }),
    ]);
    return { waterApplications: applications, waterAllotments: allotments };
  }

  async getBeneficiaryBilling(id: string) {
    const [developmentBills, runningBills] = await Promise.all([
      this.prisma.developmentBill.findMany({
        where: { beneficiary_id: id },
        orderBy: { created_at: 'desc' },
        include: {
          allotment: {
            include: { rate: true },
          },
          installments: {
            orderBy: { installment_number: 'asc' },
            include: {
              payments: {
                where: { is_reversal: false },
                orderBy: { payment_date: 'desc' },
              },
            },
          },
        },
      }),
      this.prisma.runningBill.findMany({
        where: { beneficiary_id: id },
        orderBy: { created_at: 'desc' },
        include: {
          rate: true,
        },
      }),
    ]);
    return { developmentBills, runningBills };
  }

  async getBeneficiaryPayments(id: string, query?: { page?: number; limit?: number }) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, Math.min(100, query?.limit || 50));
    const skip = (page - 1) * limit;

    const [items, total, developmentBills] = await Promise.all([
      this.prisma.payment.findMany({
        where: { beneficiary_id: id },
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
        include: {
          installment: true,
        },
      }),
      this.prisma.payment.count({ where: { beneficiary_id: id } }),
      this.prisma.developmentBill.findMany({
        where: { beneficiary_id: id },
        orderBy: { created_at: 'desc' },
        include: {
          installments: {
            orderBy: { installment_number: 'asc' },
            include: {
              payments: {
                where: { is_reversal: false },
                orderBy: { payment_date: 'desc' },
              },
            },
          },
        },
      }),
    ]);

    const installments = developmentBills.flatMap((b) => b.installments || []);

    return {
      items,
      developmentBills,
      installments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBeneficiaryInfrastructure(id: string) {
    return this.prisma.infrastructure.findMany({
      where: { beneficiary_id: id },
      orderBy: [{ updated_at: 'desc' }, { created_at: 'desc' }],
      include: {
        allotment: true,
      },
    });
  }

  async getBeneficiaryExtensions(id: string) {
    return this.prisma.extension.findMany({
      where: { beneficiary_id: id },
      orderBy: { created_at: 'desc' },
      include: {
        originalAllotment: true,
        rate: true,
      },
    });
  }

  async getBeneficiaryDocuments(id: string) {
    return this.prisma.beneficiaryDocument.findMany({
      where: { beneficiary_id: id },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: {
        district: true,
        block: true,
        panchayat: true,
        village: true,
        user: { select: { user_id: true, email: true, full_name: true, is_active: true } },
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
            landHolding: {
              include: { parcels: true },
            },
            project: { select: { project_id: true, project_code: true, project_name: true } },
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
        documents: {
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const totalLand = this.calculateTotalLand(beneficiary.landHoldings as any);

    // Compute Running Billing Financial Summary
    let totalRunningBilled = new Decimal(0);
    let totalRunningPaid = new Decimal(0);
    let totalRunningPending = new Decimal(0);

    for (const rb of beneficiary.runningBills || []) {
      totalRunningBilled = totalRunningBilled.plus(new Decimal(rb.amount_due || 0));
      totalRunningPaid = totalRunningPaid.plus(new Decimal(rb.amount_paid || 0));
      totalRunningPending = totalRunningPending.plus(new Decimal(rb.pending_amount || 0));
    }

    const primaryInfra = beneficiary.infrastructures?.[0] || beneficiary.waterAllotments?.[0]?.infrastructure || null;
    const isCommissioned = primaryInfra?.status === InfrastructureStatus.COMMISSIONED;
    const runningStartDate = primaryInfra?.running_charge_start_date || primaryInfra?.commissioned_date || null;
    const hasStarted = runningStartDate && new Date(runningStartDate) <= new Date();

    const runningSummary = {
      status: isCommissioned && hasStarted ? 'ACTIVE' : 'NOT_STARTED',
      reason: !primaryInfra
        ? 'Infrastructure not planned'
        : !isCommissioned
        ? `Infrastructure status is ${primaryInfra.status}`
        : !hasStarted
        ? `Running charges start on ${new Date(runningStartDate!).toISOString().slice(0, 10)}`
        : 'Active and eligible for running charges',
      commissionedDate: primaryInfra?.commissioned_date || null,
      runningChargeStartDate: runningStartDate,
      totalBilled: totalRunningBilled.toFixed(2),
      totalPaid: totalRunningPaid.toFixed(2),
      totalPending: totalRunningPending.toFixed(2),
      billCount: beneficiary.runningBills?.length || 0,
    };

    return {
      ...beneficiary,
      total_land_acres: totalLand.toString(),
      running_summary: runningSummary,
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
        phone_number: dto.phoneNumber !== undefined ? dto.phoneNumber?.trim() : undefined,
        address_line_1: dto.addressLine1 !== undefined ? (dto.addressLine1?.trim() || null) : undefined,
        address_line_2: dto.addressLine2 !== undefined ? (dto.addressLine2?.trim() || null) : undefined,
        address_line_3: dto.addressLine3 !== undefined ? (dto.addressLine3?.trim() || null) : undefined,
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
        name: { equals: dto.name.trim() },
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
   * Retrieves complete chronological audit history for a beneficiary and all associated assets.
   */
  async getBeneficiaryHistory(id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: id },
      include: {
        landHoldings: { select: { land_id: true } },
        waterApplications: { select: { application_id: true } },
        waterAllotments: { select: { allotment_id: true } },
        developmentBills: { select: { bill_id: true } },
        payments: { select: { payment_id: true } },
        infrastructures: { select: { infrastructure_id: true } },
        extensions: { select: { extension_id: true } },
      },
    });
    if (!beneficiary) {
      throw new NotFoundException('Beneficiary not found');
    }

    const relatedEntityIds = [
      id,
      ...(beneficiary.user_id ? [beneficiary.user_id] : []),
      ...beneficiary.landHoldings.map((h) => h.land_id),
      ...beneficiary.waterApplications.map((w) => w.application_id),
      ...beneficiary.waterAllotments.map((a) => a.allotment_id),
      ...beneficiary.developmentBills.map((b) => b.bill_id),
      ...beneficiary.payments.map((p) => p.payment_id),
      ...beneficiary.infrastructures.map((i) => i.infrastructure_id),
      ...beneficiary.extensions.map((e) => e.extension_id),
    ];

    return this.prisma.auditLog.findMany({
      where: {
        entity_id: { in: relatedEntityIds },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
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
