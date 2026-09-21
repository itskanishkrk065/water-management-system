import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
} from '@prisma/client';
import { DecimalUtil } from '../common/decimal.util';
import { Decimal } from 'decimal.js';

@Injectable()
export class WaterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Preview calculated allotment and snapshot rates before application submission or approval.
   */
  async previewAllotment(beneficiaryId: string, projectId: string) {
    const [beneficiary, rate] = await Promise.all([
      this.prisma.beneficiary.findUnique({
        where: { beneficiary_id: beneficiaryId },
        include: {
          landHoldings: {
            where: { status: LandStatus.ACTIVE },
            include: { parcels: true },
          },
        },
      }),
      this.prisma.rateConfiguration.findFirst({
        where: { project_id: projectId, is_active: true },
        orderBy: { effective_from: 'desc' },
      }),
    ]);

    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${beneficiaryId} not found`);
    }
    if (!rate) {
      throw new NotFoundException(`No active rate configuration found for project ${projectId}`);
    }

    const totalLandAcres = beneficiary.landHoldings.reduce(
      (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
      new Decimal(0),
    );

    const calculatedAllottedLitres = DecimalUtil.mul(totalLandAcres, rate.litres_per_acre);

    return {
      beneficiary_id: beneficiaryId,
      beneficiary_name: beneficiary.name,
      project_id: projectId,
      total_land_acres: totalLandAcres.toFixed(4),
      rate_id: rate.rate_id,
      litres_per_acre: rate.litres_per_acre.toString(),
      calculated_allotted_litres: calculatedAllottedLitres.toFixed(2),
      development_cost_per_litre: rate.development_cost_per_litre.toString(),
      running_cost_per_litre: rate.running_cost_per_litre.toString(),
    };
  }

  /**
   * Beneficiary submits a water requirement application.
   */
  async createApplication(dto: CreateWaterApplicationDto, createdBy: string, userId?: string, ipAddress?: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({
      where: { beneficiary_id: dto.beneficiaryId },
      include: { landHoldings: { where: { status: LandStatus.ACTIVE } } },
    });
    if (!beneficiary) {
      throw new NotFoundException(`Beneficiary ${dto.beneficiaryId} not found`);
    }

    if (beneficiary.landHoldings.length === 0) {
      throw new BadRequestException('Beneficiary must have at least one active land holding before submitting a water application.');
    }

    const application = await this.prisma.waterApplication.create({
      data: {
        project_id: dto.projectId,
        beneficiary_id: dto.beneficiaryId,
        required_litres: new Decimal(dto.requiredLitres),
        status: ApplicationStatus.SUBMITTED,
        created_by: createdBy,
      },
      include: {
        beneficiary: true,
        project: true,
      },
    });

    await this.auditService.log({
      userId,
      action: AuditAction.SUBMIT,
      entityType: 'WaterApplication',
      entityId: application.application_id,
      newValues: application,
      reason: dto.remarks || 'Submitted water requirement application',
      ipAddress,
    });

    return application;
  }

  async findAllApplications(query: {
    projectId?: string;
    beneficiaryId?: string;
    status?: ApplicationStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.projectId) where.project_id = query.projectId;
    if (query.beneficiaryId) where.beneficiary_id = query.beneficiaryId;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.waterApplication.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        include: {
          beneficiary: {
            include: {
              district: true,
              panchayat: true,
              village: true,
              landHoldings: { where: { status: LandStatus.ACTIVE } },
            },
          },
          project: true,
          allotment: {
            include: {
              developmentBill: {
                include: { installments: true },
              },
            },
          },
        },
      }),
      this.prisma.waterApplication.count({ where }),
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
    const application = await this.prisma.waterApplication.findUnique({
      where: { application_id: dto.applicationId },
      include: {
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

    // Active rate for the project
    const activeRate = await this.prisma.rateConfiguration.findFirst({
      where: { project_id: application.project_id, is_active: true },
      orderBy: { effective_from: 'desc' },
    });
    if (!activeRate) {
      throw new BadRequestException(`No active rate configuration found for project ${application.project_id}`);
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

    // Compute total land
    const totalLandAcres = application.beneficiary.landHoldings.reduce(
      (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
      new Decimal(0),
    );

    if (totalLandAcres.isZero()) {
      throw new BadRequestException('Beneficiary has zero active land holdings. Cannot approve allotment.');
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

      return { allotment, bill };
    });

    // Record Audit Log
    await this.auditService.log({
      userId,
      action: AuditAction.APPROVE,
      entityType: 'WaterApplication',
      entityId: application.application_id,
      oldValues: { status: application.status },
      newValues: {
        status: ApplicationStatus.APPROVED,
        allotment_id: transactionResult.allotment.allotment_id,
        bill_id: transactionResult.bill.bill_id,
        approved_litres: dto.approvedLitres,
      },
      reason: dto.approvalRemarks || 'Approved water application and created allotment with 5 installments',
      ipAddress,
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
            include: { district: true, panchayat: true, village: true },
          },
          application: true,
          rate: true,
          developmentBill: {
            include: { installments: { orderBy: { installment_number: 'asc' } } },
          },
          infrastructure: true,
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
}
