import { Injectable, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateWaterApplicationDto, ApproveWaterApplicationDto, RejectWaterApplicationDto } from './dto/water.dto';
import {
  ApplicationStatus,
  ApprovalStatus,
  AuditAction,
  BillStatus,
  InfrastructureStatus,
  InstallmentStatus,
  LandStatus,
} from '../common/enums';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';
import { ApplicationClockService } from '../system/application-clock.service';

@Injectable()
export class WaterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Optional() private readonly clock?: ApplicationClockService,
  ) {}

  /**
   * Preview calculated allotment and snapshot rates before application submission or approval.
   */
  async previewAllotment(beneficiaryId: string, projectId?: string, landId?: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: beneficiaryId },
      include: {
        landHoldings: {
          where: { status: LandStatus.ACTIVE },
          include: { parcels: true },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${beneficiaryId} not found`);
    }

    let targetHolding: any = null;
    if (landId) {
      targetHolding = beneficiary.landHoldings.find((h) => h.land_id === landId);
      if (!targetHolding) {
        throw new NotFoundException(`Active land holding ${landId} not found for this beneficiary`);
      }
    } else if (beneficiary.landHoldings.length === 1) {
      targetHolding = beneficiary.landHoldings[0];
    }

    const effProjectId = projectId || targetHolding?.project_id || beneficiary.landHoldings[0]?.project_id;
    if (!effProjectId) {
      throw new BadRequestException('No active project scheme found for preview');
    }

    const rate = await this.prisma.rateConfiguration.findFirst({
      where: { project_id: effProjectId, is_active: true },
      orderBy: { effective_from: 'desc' },
    });

    if (!rate) {
      throw new NotFoundException(`No active rate configuration found for project ${effProjectId}`);
    }

    let totalLandAcres: Decimal;
    if (targetHolding) {
      totalLandAcres = new Decimal(targetHolding.declared_total_area);
    } else {
      totalLandAcres = beneficiary.landHoldings.reduce(
        (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
        new Decimal(0),
      );
    }

    const calculatedAllottedLitres = DecimalUtil.mul(totalLandAcres, rate.litres_per_acre);

    return {
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiary.name,
      project_id: effProjectId,
      land_id: targetHolding?.land_id || null,
      total_land_acres: totalLandAcres.toFixed(4),
      rate_id: rate.rate_id,
      litres_per_acre: rate.litres_per_acre.toString(),
      calculated_allotted_litres: calculatedAllottedLitres.toFixed(2),
      development_cost_per_litre: rate.development_cost_per_litre.toString(),
      running_cost_per_litre: rate.running_cost_per_litre.toString(),
    };
  }

  /**
   * Canonical backend query: Get eligible land holdings for a new water application.
   * Excludes land holdings that already have an active / blocking water application (APPROVED, SUBMITTED, UNDER_REVIEW, DRAFT).
   * Holdings with REJECTED, CANCELLED, or VOIDED applications are released and eligible.
   */
  async getEligibleHoldings(beneficiaryId: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: beneficiaryId },
      include: {
        landHoldings: {
          where: { status: LandStatus.ACTIVE },
          include: {
            parcels: { orderBy: { survey_number: 'asc' } },
            project: { select: { project_id: true, project_code: true, project_name: true } },
          },
          orderBy: { created_at: 'asc' },
        },
        waterApplications: {
          select: {
            application_id: true,
            land_id: true,
            status: true,
            required_litres: true,
            created_at: true,
          },
        },
      },
    });

    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${beneficiaryId} not found`);
    }

    const blockingStatuses = [
      ApplicationStatus.APPROVED,
      ApplicationStatus.SUBMITTED,
      ApplicationStatus.UNDER_REVIEW,
      'DRAFT',
    ];

    const eligibleHoldings = beneficiary.landHoldings
      .filter((h) => {
        const blockingApp = beneficiary.waterApplications.find(
          (a) => a.land_id === h.land_id && blockingStatuses.includes(a.status as any),
        );
        return !blockingApp;
      })
      .map((h, idx) => ({
        holding_index: idx + 1,
        land_id: h.land_id,
        project_id: h.project_id,
        project_name: h.project?.project_name,
        project_code: h.project?.project_code,
        declared_total_area: h.declared_total_area.toString(),
        area_unit: h.area_unit,
        parcels: h.parcels.map((p) => ({
          parcel_id: p.parcel_id,
          survey_number: p.survey_number,
          subdivision_number: p.subdivision_number,
          area: p.area.toString(),
        })),
        is_eligible: true,
      }));

    const fulfilledOrBlockedHoldings = beneficiary.landHoldings
      .filter((h) => {
        const blockingApp = beneficiary.waterApplications.find(
          (a) => a.land_id === h.land_id && blockingStatuses.includes(a.status as any),
        );
        return !!blockingApp;
      })
      .map((h, idx) => {
        const blockingApp = beneficiary.waterApplications.find(
          (a) => a.land_id === h.land_id && blockingStatuses.includes(a.status as any),
        );
        return {
          holding_index: idx + 1,
          land_id: h.land_id,
          declared_total_area: h.declared_total_area.toString(),
          blocking_application_id: blockingApp?.application_id,
          blocking_status: blockingApp?.status,
          is_eligible: false,
          reason: `Holding already has a water application in status: ${blockingApp?.status}`,
        };
      });

    return {
      beneficiary_id: beneficiary.beneficiary_id,
      beneficiary_name: beneficiary.name,
      total_active_holdings: beneficiary.landHoldings.length,
      eligible_holdings_count: eligibleHoldings.length,
      eligible_holdings: eligibleHoldings,
      ineligible_holdings: fulfilledOrBlockedHoldings,
    };
  }

  private readonly holdingLocks = new Set<string>();

  private async acquireLock(key: string): Promise<() => void> {
    while (this.holdingLocks.has(key)) {
      await new Promise((resolve) => setTimeout(resolve, 15));
    }
    this.holdingLocks.add(key);
    return () => {
      this.holdingLocks.delete(key);
    };
  }

  /**
   * Beneficiary submits a water requirement application for an eligible Land Holding.
   * CORE BUSINESS RULE #1: ONE WATER APPLICATION PER LAND HOLDING (CONCURRENCY SAFE)
   */
  async createApplication(dto: CreateWaterApplicationDto, createdBy: string, userId?: string, ipAddress?: string) {
    if (this.clock) {
      await this.clock.assertClockValid(userId, ipAddress);
    }

    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: dto.beneficiaryId },
      include: { landHoldings: { where: { status: LandStatus.ACTIVE }, include: { parcels: true } } },
    });
    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${dto.beneficiaryId} not found`);
    }

    if (beneficiary.landHoldings.length === 0) {
      throw new BadRequestException('Beneficiary must have at least one active land holding before submitting a water application.');
    }

    let targetLand: any = null;
    if (dto.landId) {
      targetLand = beneficiary.landHoldings.find((h) => h.land_id === dto.landId);
      if (!targetLand) {
        throw new BadRequestException(`Specified land holding ${dto.landId} is not valid or active for this beneficiary.`);
      }
    } else if (beneficiary.landHoldings.length === 1) {
      targetLand = beneficiary.landHoldings[0];
    } else {
      throw new BadRequestException('Beneficiary has multiple land holdings. Please select a specific land holding for this water application.');
    }

    const releaseLock = await this.acquireLock(targetLand.land_id);

    try {
      // Execute atomically in a transaction with holding-level lock
      const application = await this.prisma.$transaction(async (tx) => {
        // CORE BUSINESS RULE #1: UNIQUE WATER APPLICATION PER LAND HOLDING
        const existingActiveApp = await tx.waterApplication.findFirst({
          where: {
            land_id: targetLand.land_id,
            status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.APPROVED, 'DRAFT'] },
          },
        });

        if (existingActiveApp) {
          throw new BadRequestException(
            `Land holding (${targetLand.parcels?.map((p: any) => p.survey_number).join(', ') || targetLand.land_id}) already has an active water application (#${existingActiveApp.application_id.slice(0, 8)} with status ${existingActiveApp.status}). Duplicate water applications for the same land holding are strictly prohibited.`,
          );
        }

        const effProjectId = dto.projectId || targetLand.project_id;

        return tx.waterApplication.create({
          data: {
            project_id: effProjectId,
            beneficiary_id: dto.beneficiaryId,
            land_id: targetLand.land_id,
            required_litres: new Decimal(dto.requiredLitres),
            status: ApplicationStatus.SUBMITTED,
            created_by: createdBy,
          },
          include: {
            beneficiary: true,
            project: true,
            landHolding: true,
          },
        });
      });

      await this.auditService.log({
        userId,
        action: AuditAction.SUBMIT,
        entityType: 'WaterApplication',
        entityId: application.application_id,
        newValues: {
          ...application,
          land_id: targetLand.land_id,
          declared_total_area: targetLand.declared_total_area,
        },
        reason: dto.remarks || `Submitted water requirement application for Land Holding ${targetLand.land_id}`,
        ipAddress,
      });

      return application;
    } finally {
      releaseLock();
    }
  }

  async findAllApplications(query: {
    projectId?: string;
    beneficiaryId?: string;
    status?: ApplicationStatus;
    scope?: 'CURRENT' | 'HISTORY' | 'ALL';
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.projectId) where.project_id = query.projectId;
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;

    if (query.status) {
      where.status = query.status;
    } else if (query.scope === 'HISTORY') {
      where.OR = [
        { status: { in: ['CANCELLED', 'REJECTED', 'VOIDED', 'ARCHIVED', 'SUPERSEDED'] as any } },
        { landHolding: { status: { not: LandStatus.ACTIVE } } },
      ];
    } else if (query.scope === 'ALL') {
      // Return everything without status restriction
    } else {
      // Default: CURRENT operational applications on active holdings
      where.status = { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW, ApplicationStatus.APPROVED] };
      where.landHolding = { status: LandStatus.ACTIVE };
    }

    const [items, total] = await Promise.all([
      this.prisma.waterApplication.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: {
            select: {
              beneficiary_id: true,
              name: true,
              phone_number: true,
              village: { select: { name: true } },
              district: { select: { name: true } },
              landHoldings: {
                where: { status: LandStatus.ACTIVE },
                select: {
                  land_id: true,
                  declared_total_area: true,
                  area_unit: true,
                  parcels: {
                    select: { survey_number: true, subdivision_number: true },
                  },
                },
              },
            },
          },
          project: {
            select: { project_id: true, project_code: true, project_name: true },
          },
          landHolding: {
            select: {
              land_id: true,
              declared_total_area: true,
              area_unit: true,
              parcels: {
                select: { survey_number: true, subdivision_number: true },
              },
            },
          },
          allotment: {
            select: {
              allotment_id: true,
              approved_litres: true,
              approval_status: true,
            },
          },
        },
      }),
      this.prisma.waterApplication.count({ where }),
    ]);

    // Enrich each application with exact land holding calculation and effective tariff rate
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let totalLand = new Decimal(0);
        if (item.landHolding) {
          totalLand = new Decimal(item.landHolding.declared_total_area);
        } else if (item.beneficiary?.landHoldings?.length) {
          totalLand = item.beneficiary.landHoldings.reduce(
            (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
            new Decimal(0),
          );
        }

        const appDate = item.application_date ? new Date(item.application_date) : new Date();
        let rate = await this.prisma.rateConfiguration.findFirst({
          where: {
            project_id: item.project_id,
            effective_from: { lte: appDate },
            OR: [{ effective_to: null }, { effective_to: { gt: appDate } }],
          },
          orderBy: { effective_from: 'desc' },
        });
        if (!rate) {
          rate = await this.prisma.rateConfiguration.findFirst({
            where: { project_id: item.project_id, is_active: true },
            orderBy: { effective_from: 'desc' },
          });
        }
        if (!rate) {
          rate = await this.prisma.rateConfiguration.findFirst({
            where: { project_id: item.project_id },
            orderBy: { effective_from: 'desc' },
          });
        }

        const litresPerAcre = rate ? new Decimal(rate.litres_per_acre) : new Decimal(10000);
        const calculatedAllotment = DecimalUtil.mul(totalLand, litresPerAcre);

        return {
          ...item,
          total_land_acres: totalLand.toFixed(4),
          litres_per_acre: litresPerAcre.toString(),
          calculated_allotment: calculatedAllotment.toFixed(2),
          development_cost_per_litre: rate?.development_cost_per_litre?.toString() || '2.00',
          running_cost_per_litre: rate?.running_cost_per_litre?.toString() || '0.50',
          rate_configuration: rate || null,
        };
      }),
    );

    return {
      items: enrichedItems,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOneApplication(id: string) {
    const app = await this.prisma.waterApplication.findUnique({
      where: { application_id: id },
      include: {
        beneficiary: {
          include: {
            district: true,
            panchayat: true,
            village: true,
            landHoldings: {
              where: { status: LandStatus.ACTIVE },
              include: { parcels: true },
            },
          },
        },
        project: true,
        allotment: {
          include: {
            rate: true,
            developmentBill: {
              include: { installments: true },
            },
            infrastructure: true,
          },
        },
      },
    });

    if (!app) {
      throw new NotFoundException('Water application not found');
    }

    return app;
  }

  /**
   * CRITICAL TRANSACTIONAL OPERATION:
   * Approving a water application atomically:
   * 1. Validates application is in SUBMITTED or UNDER_REVIEW status
   * 2. Snapshots active rate configuration & template
   * 3. Calculates allotted litres from total land
   * 4. Creates WaterAllotment with approved quantity and snapshots
   * 5. Calculates development cost = approved_litres * development_cost_per_litre
   * 6. Creates DevelopmentBill
   * 7. Creates 5 Installments according to active schedule
   * 8. Creates initial Infrastructure lifecycle record in PLANNED status
   * 9. Updates application status to APPROVED
   * 10. Records audit entries and commits
   */
  async approveApplication(
    dto: ApproveWaterApplicationDto,
    approverEmail: string,
    userId?: string,
    ipAddress?: string,
  ) {
    if (this.clock) {
      await this.clock.assertClockValid(userId, ipAddress);
    }

    const application = await this.prisma.waterApplication.findUnique({
      where: { application_id: dto.applicationId },
      include: {
        landHolding: true,
        beneficiary: {
          include: {
            landHoldings: {
              where: { status: LandStatus.ACTIVE },
            },
          },
        },
        allotment: true,
      },
    });

    if (!application) {
      throw new NotFoundException(`Application ${dto.applicationId} not found`);
    }
    if (application.status === ApplicationStatus.APPROVED || application.allotment) {
      throw new BadRequestException('This application has already been approved and has an active allotment.');
    }
    if (application.status === ApplicationStatus.REJECTED) {
      throw new BadRequestException('Cannot approve a rejected application.');
    }

    // Resolve applicable rate for the project using application/effective date
    const appDate = application.application_date ? new Date(application.application_date) : new Date();
    let activeRate = await this.prisma.rateConfiguration.findFirst({
      where: {
        project_id: application.project_id,
        effective_from: { lte: appDate },
        OR: [{ effective_to: null }, { effective_to: { gt: appDate } }],
      },
      orderBy: { effective_from: 'desc' },
    });
    if (!activeRate) {
      activeRate = await this.prisma.rateConfiguration.findFirst({
        where: { project_id: application.project_id, is_active: true },
        orderBy: { effective_from: 'desc' },
      });
    }
    if (!activeRate) {
      throw new BadRequestException(`No rate configuration found for project ${application.project_id}`);
    }

    // Active installment template
    let template = await this.prisma.installmentTemplate.findFirst({
      where: { project_id: application.project_id, is_active: true },
    });
    if (!template) {
      // Default fallback template: 2.5%, 20%, 25%, 25%, 27.5%
      template = {
        template_id: 'default',
        project_id: application.project_id,
        name: 'Standard Default',
        inst_1_pct: new Decimal(2.5),
        inst_2_pct: new Decimal(20.0),
        inst_3_pct: new Decimal(25.0),
        inst_4_pct: new Decimal(25.0),
        inst_5_pct: new Decimal(27.5),
        is_active: true,
        created_by: 'system',
        created_at: new Date(),
      };
    }

    // Compute total land for this specific application / land holding
    const totalLandAcres = application.landHolding
      ? new Decimal(application.landHolding.declared_total_area)
      : application.beneficiary.landHoldings.reduce(
          (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
          new Decimal(0),
        );

    if (totalLandAcres.isZero()) {
      throw new BadRequestException('Land holding area is zero. Cannot approve allotment.');
    }

    // Formula: Calculated Allotted Litres = Total Land * Litres Per Acre
    const calculatedAllottedLitres = DecimalUtil.mul(totalLandAcres, activeRate.litres_per_acre);
    const approvedLitresDecimal = new Decimal(dto.approvedLitres);

    // Formula: Development Cost = Approved Litres * Development Cost / L
    const totalDevelopmentCost = DecimalUtil.roundMoney(
      DecimalUtil.mul(approvedLitresDecimal, activeRate.development_cost_per_litre),
    );

    // Atomic PostgreSQL transaction
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      // 1. Create WaterAllotment
      const allotment = await tx.waterAllotment.create({
        data: {
          application_id: application.application_id,
          beneficiary_id: application.beneficiary_id,
          rate_id: activeRate.rate_id,
          total_land_acres_snapshot: totalLandAcres,
          litres_per_acre_snapshot: activeRate.litres_per_acre,
          calculated_allotted_litres: calculatedAllottedLitres,
          approved_litres: approvedLitresDecimal,
          approval_status: ApprovalStatus.APPROVED,
          approved_by: approverEmail,
          approval_remarks: dto.approvalRemarks || null,
        },
      });

      // 2. Create DevelopmentBill
      const bill = await tx.developmentBill.create({
        data: {
          allotment_id: allotment.allotment_id,
          beneficiary_id: application.beneficiary_id,
          approved_litres_snapshot: approvedLitresDecimal,
          development_cost_per_litre_snapshot: activeRate.development_cost_per_litre,
          total_amount: totalDevelopmentCost,
          amount_paid: new Decimal(0),
          pending_amount: totalDevelopmentCost,
          status: BillStatus.PENDING,
        },
      });

      // 3. Create 5 Installments according to schedule percentages
      const percentages = [
        new Decimal(template.inst_1_pct),
        new Decimal(template.inst_2_pct),
        new Decimal(template.inst_3_pct),
        new Decimal(template.inst_4_pct),
        new Decimal(template.inst_5_pct),
      ];

      // Due date intervals (days from today)
      const dayIntervals = [15, 45, 90, 150, 210];
      const now = new Date();
      let allocatedTotal = new Decimal(0);

      for (let i = 0; i < 5; i++) {
        const instNum = i + 1;
        const pct = percentages[i];
        let amountDue: Decimal;

        if (instNum === 5) {
          // Adjust 5th installment to absorb any rounding penny differences
          amountDue = DecimalUtil.sub(totalDevelopmentCost, allocatedTotal);
        } else {
          amountDue = DecimalUtil.roundMoney(DecimalUtil.mul(totalDevelopmentCost, pct).dividedBy(100));
          allocatedTotal = DecimalUtil.add(allocatedTotal, amountDue);
        }

        const dueDate = new Date(now.getTime() + dayIntervals[i] * 24 * 60 * 60 * 1000);

        await tx.installment.create({
          data: {
            bill_id: bill.bill_id,
            installment_number: instNum,
            percentage: pct,
            amount_due: amountDue,
            due_date: dueDate,
            amount_paid: new Decimal(0),
            pending_amount: amountDue,
            status: InstallmentStatus.PENDING,
          },
        });
      }

      // 4. Create Infrastructure lifecycle record (PLANNED status)
      await tx.infrastructure.create({
        data: {
          allotment_id: allotment.allotment_id,
          beneficiary_id: application.beneficiary_id,
          status: InfrastructureStatus.PLANNED,
          planned_date: now,
          remarks: 'Auto-initialized infrastructure lifecycle upon allotment approval',
        },
      });

      // 5. Update application status to APPROVED
      await tx.waterApplication.update({
        where: { application_id: application.application_id },
        data: { status: ApplicationStatus.APPROVED },
      });

      // 6. Record Audit Log inside transaction
      await this.auditService.log({
        userId,
        action: AuditAction.APPROVE,
        entityType: 'WaterApplication',
        entityId: application.application_id,
        oldValues: { status: application.status },
        newValues: {
          status: ApplicationStatus.APPROVED,
          allotment_id: allotment.allotment_id,
          bill_id: bill.bill_id,
          approved_litres: dto.approvedLitres,
        },
        reason: dto.approvalRemarks || 'Approved water application and created allotment with 5 installments',
        ipAddress,
        tx,
      });

      return { allotment, bill };
    });

    return this.findOneAllotment(transactionResult.allotment.allotment_id);
  }

  async rejectApplication(
    dto: RejectWaterApplicationDto,
    rejecterEmail: string,
    userId?: string,
    ipAddress?: string,
  ) {
    const application = await this.prisma.waterApplication.findUnique({
      where: { application_id: dto.applicationId },
    });
    if (!application) {
      throw new NotFoundException('Water application not found');
    }
    if (application.status === ApplicationStatus.APPROVED) {
      throw new BadRequestException('Cannot reject an already approved application.');
    }

    const updated = await this.prisma.waterApplication.update({
      where: { application_id: dto.applicationId },
      data: { status: ApplicationStatus.REJECTED },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.REJECT,
      entityType: 'WaterApplication',
      entityId: dto.applicationId,
      oldValues: { status: application.status },
      newValues: { status: ApplicationStatus.REJECTED, rejectionRemarks: dto.rejectionRemarks },
      reason: dto.rejectionRemarks,
      ipAddress,
    });

    return updated;
  }

  async findAllAllotments(query: { beneficiaryId?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;

    const [items, total] = await Promise.all([
      this.prisma.waterAllotment.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: {
            select: {
              beneficiary_id: true,
              name: true,
              phone_number: true,
              village: { select: { name: true } },
            },
          },
          application: {
            select: {
              application_id: true,
              required_litres: true,
              project: { select: { project_name: true, project_code: true } },
            },
          },
          rate: {
            select: {
              rate_id: true,
              development_cost_per_litre: true,
            },
          },
          developmentBill: {
            select: {
              bill_id: true,
              total_amount: true,
              amount_paid: true,
              pending_amount: true,
              status: true,
            },
          },
          infrastructure: {
            select: {
              infrastructure_id: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.waterAllotment.count({ where }),
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

  async findOneAllotment(id: string) {
    const allotment = await this.prisma.waterAllotment.findUnique({
      where: { allotment_id: id },
      include: {
        beneficiary: {
          include: {
            district: true,
            panchayat: true,
            village: true,
            landHoldings: { where: { status: LandStatus.ACTIVE }, include: { parcels: true } },
          },
        },
        application: true,
        rate: true,
        developmentBill: {
          include: {
            installments: {
              orderBy: { installment_number: 'asc' },
              include: { payments: true },
            },
          },
        },
        infrastructure: true,
        runningBills: { orderBy: { created_at: 'desc' } },
        extensions: { orderBy: { created_at: 'desc' } },
      },
    });

    if (!allotment) {
      throw new NotFoundException('Water allotment not found');
    }

    return allotment;
  }

  /**
   * Safe Delete Water Application.
   * Only unapproved/draft/rejected/cancelled applications without linked allotment or financial records can be permanently deleted.
   * Approved or financially linked applications must be voided/cancelled to preserve audit and financial integrity.
   */
  async deleteApplication(applicationId: string, userId?: string, ipAddress?: string) {
    const application = await this.prisma.waterApplication.findUnique({
      where: { application_id: applicationId },
      include: {
        allotment: {
          include: {
            developmentBill: {
              include: { installments: { include: { payments: true } } },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Water application ${applicationId} not found`);
    }

    if (application.status === ApplicationStatus.APPROVED || application.allotment) {
      throw new BadRequestException(
        'Cannot permanently delete an approved water application with an active allotment or financial billing records. Use application cancellation or voiding instead to preserve audit integrity.',
      );
    }

    await this.prisma.waterApplication.delete({
      where: { application_id: applicationId },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.DELETE_VOID,
      entityType: 'WaterApplication',
      entityId: applicationId,
      oldValues: application,
      reason: `Permanently deleted water application #${applicationId.slice(0, 8)} (Status: ${application.status})`,
      ipAddress,
    });

    return {
      success: true,
      message: `Water application #${applicationId.slice(0, 8)} was permanently deleted.`,
    };
  }

  /**
   * Cancel or Void Water Application with audit trail.
   */
  async cancelApplication(applicationId: string, reason?: string, userId?: string, ipAddress?: string) {
    const application = await this.prisma.waterApplication.findUnique({
      where: { application_id: applicationId },
      include: {
        allotment: {
          include: {
            developmentBill: {
              include: { installments: { include: { payments: true } } },
            },
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException(`Water application ${applicationId} not found`);
    }

    if (application.status === 'CANCELLED' || application.status === 'VOIDED') {
      throw new BadRequestException(`Application is already in status '${application.status}'`);
    }

    // Check if any payment was recorded
    const payments = application.allotment?.developmentBill?.installments?.flatMap((i) => i.payments) || [];
    if (payments.length > 0) {
      throw new BadRequestException(
        'Cannot cancel an application with recorded payment receipts. Financial reversal workflow is required.',
      );
    }

    const newStatus = application.status === ApplicationStatus.APPROVED ? 'VOIDED' : 'CANCELLED';

    const updated = await this.prisma.waterApplication.update({
      where: { application_id: applicationId },
      data: { status: newStatus },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.REJECT,
      entityType: 'WaterApplication',
      entityId: applicationId,
      oldValues: { status: application.status },
      newValues: { status: newStatus },
      reason: reason || `Cancelled water application #${applicationId.slice(0, 8)}`,
      ipAddress,
    });

    return updated;
  }
}

