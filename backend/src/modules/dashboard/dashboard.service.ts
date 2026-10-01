import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApplicationStatus,
  BeneficiaryStatus,
  BillStatus,
  InfrastructureStatus,
  InstallmentStatus,
  LandStatus,
  PaymentStatus,
  RoleName,
} from '../common/enums';
import { Decimal } from 'decimal.js';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import { RequestUser } from '../common/decorators/current-user.decorator';
import { IntegrityService } from '../integrity/integrity.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrityService: IntegrityService,
  ) {}

  async getStats(filterDto: DashboardFilterDto = {}, user?: RequestUser) {
    const isFieldOfficer = user?.role === RoleName.FIELD_OFFICER;

    // Build location/entity filter clauses
    const beneficiaryWhere: any = {};
    const landWhere: any = {};
    const appWhere: any = {};
    const devBillWhere: any = {};
    const paymentWhere: any = { is_reversal: false, status: PaymentStatus.COMPLETED };

    if (filterDto.districtId) {
      beneficiaryWhere.district_id = filterDto.districtId;
    }
    if (filterDto.panchayatId) {
      beneficiaryWhere.panchayat_id = filterDto.panchayatId;
    }
    if (filterDto.villageId) {
      beneficiaryWhere.village_id = filterDto.villageId;
    }

    // Date range filter
    if (filterDto.dateFrom || filterDto.dateTo) {
      const dateClause: any = {};
      if (filterDto.dateFrom) dateClause.gte = new Date(filterDto.dateFrom);
      if (filterDto.dateTo) {
        const toDate = new Date(filterDto.dateTo);
        toDate.setHours(23, 59, 59, 999);
        dateClause.lte = toDate;
      }
      appWhere.created_at = dateClause;
      paymentWhere.payment_date = dateClause;
    }

    if (filterDto.status) {
      appWhere.status = filterDto.status;
    }

    if (filterDto.projectId) {
      landWhere.project_id = filterDto.projectId;
      appWhere.project_id = filterDto.projectId;
      beneficiaryWhere.landHoldings = { some: { project_id: filterDto.projectId } };
    }

    // Link beneficiary location to other entities if location filters provided
    if (Object.keys(beneficiaryWhere).length > 0) {
      landWhere.beneficiary = beneficiaryWhere;
      appWhere.beneficiary = beneficiaryWhere;
      devBillWhere.beneficiary = beneficiaryWhere;
    }

    // Execute queries in parallel
    const [
      totalBeneficiaries,
      activeBeneficiaries,
      inactiveBeneficiaries,
      allHoldings,
      activeHoldings,
      allApplications,
      allotments,
      devBills,
      runningBills,
      extensionBills,
      payments,
      pendingInstallmentsCount,
      overdueInstallmentsCount,
      pendingApprovalsCount,
      infrastructureAwaitingCount,
    ] = await Promise.all([
      // 1. Beneficiaries
      this.prisma.beneficiary.count({ where: beneficiaryWhere }),
      this.prisma.beneficiary.count({
        where: { ...beneficiaryWhere, status: BeneficiaryStatus.ACTIVE },
      }),
      this.prisma.beneficiary.count({
        where: {
          ...beneficiaryWhere,
          status: BeneficiaryStatus.INACTIVE,
        },
      }),

      // 2. Land Holdings (Strictly filter active holdings to active beneficiaries)
      this.prisma.landHolding.findMany({
        where: landWhere,
        select: { declared_total_area: true, status: true },
      }),
      this.prisma.landHolding.findMany({
        where: {
          ...landWhere,
          status: LandStatus.ACTIVE,
          beneficiary: { status: BeneficiaryStatus.ACTIVE },
        },
        select: { declared_total_area: true },
      }),

      // 3. Water Applications
      this.prisma.waterApplication.findMany({
        where: appWhere,
        select: {
          status: true,
          required_litres: true,
          landHolding: { select: { status: true } },
          beneficiary: { select: { status: true } },
        },
      }),
      // Water Allotments: Strictly active allotments from active applications attached to active holdings & beneficiaries
      this.prisma.waterAllotment.findMany({
        where: {
          application: {
            ...appWhere,
            status: { notIn: ['CANCELLED' as any, 'VOIDED' as any, 'REJECTED' as any] },
            landHolding: { status: LandStatus.ACTIVE },
            beneficiary: { status: BeneficiaryStatus.ACTIVE },
          },
        },
        select: { approved_litres: true },
      }),

      // 4. Financial (Bills & Payments) - Non-cancelled development bills with active applications
      !isFieldOfficer
        ? this.prisma.developmentBill.findMany({
            where: {
              ...devBillWhere,
              status: { not: BillStatus.CANCELLED },
              allotment: {
                application: {
                  status: { notIn: ['CANCELLED' as any, 'VOIDED' as any, 'REJECTED' as any] },
                  landHolding: { status: LandStatus.ACTIVE },
                  beneficiary: { status: BeneficiaryStatus.ACTIVE },
                },
              },
            },
            select: { total_amount: true, amount_paid: true, pending_amount: true, status: true },
          })
        : Promise.resolve([]),
      !isFieldOfficer
        ? this.prisma.runningBill.findMany({
            where: {
              ...(Object.keys(beneficiaryWhere).length > 0 ? { beneficiary: beneficiaryWhere } : {}),
              status: { not: BillStatus.CANCELLED },
            },
            select: { amount_due: true, amount_paid: true, pending_amount: true, status: true },
          })
        : Promise.resolve([]),
      !isFieldOfficer
        ? this.prisma.extension.findMany({
            select: { extension_cost: true, status: true },
          })
        : Promise.resolve([]),
      !isFieldOfficer
        ? this.prisma.payment.findMany({
            where: paymentWhere,
            select: { amount: true },
          })
        : Promise.resolve([]),

      // 5. Installments
      !isFieldOfficer
        ? this.prisma.installment.count({
            where: {
              status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID] },
              bill: {
                status: { not: BillStatus.CANCELLED },
                beneficiary: { status: BeneficiaryStatus.ACTIVE },
              },
            },
          })
        : Promise.resolve(0),
      !isFieldOfficer
        ? this.prisma.installment.count({
            where: {
              status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID] },
              due_date: { lt: new Date() },
              bill: {
                status: { not: BillStatus.CANCELLED },
                beneficiary: { status: BeneficiaryStatus.ACTIVE },
              },
            },
          })
        : Promise.resolve(0),

      // 6. Operational queues counts
      this.prisma.waterApplication.count({
        where: {
          ...appWhere,
          status: ApplicationStatus.SUBMITTED,
          landHolding: { status: LandStatus.ACTIVE },
          beneficiary: { status: BeneficiaryStatus.ACTIVE },
        },
      }),
      this.prisma.infrastructure.count({
        where: {
          status: {
            in: [
              InfrastructureStatus.PLANNED,
              InfrastructureStatus.UNDER_CONSTRUCTION,
              InfrastructureStatus.COMPLETED,
            ],
          },
        },
      }),
    ]);

    // Compute Land Totals
    const totalLandArea = allHoldings.reduce(
      (acc, h) => acc.plus(new Decimal(h.declared_total_area || 0)),
      new Decimal(0),
    );
    const totalActiveLandArea = activeHoldings.reduce(
      (acc, h) => acc.plus(new Decimal(h.declared_total_area || 0)),
      new Decimal(0),
    );

    // Compute Water Totals
    let submittedApps = 0;
    let underReviewApps = 0;
    let approvedApps = 0;
    let rejectedApps = 0;
    let cancelledApps = 0;
    let totalRequiredLitres = new Decimal(0);
    let activeAppsCount = 0;
    let historicalAppsCount = 0;

    for (const app of allApplications) {
      const isParentActive =
        app.landHolding?.status === LandStatus.ACTIVE &&
        app.beneficiary?.status === BeneficiaryStatus.ACTIVE;
      const isTerminal = ['CANCELLED', 'VOIDED', 'REJECTED', 'ARCHIVED'].includes(app.status as string);

      if (app.status === ApplicationStatus.SUBMITTED) submittedApps++;
      else if (app.status === ApplicationStatus.UNDER_REVIEW) underReviewApps++;
      else if (app.status === ApplicationStatus.APPROVED) approvedApps++;
      else if (app.status === ApplicationStatus.REJECTED) rejectedApps++;
      else if (['CANCELLED', 'VOIDED'].includes(app.status as string)) cancelledApps++;

      if (!isTerminal && isParentActive) {
        activeAppsCount++;
        if (app.required_litres) {
          totalRequiredLitres = totalRequiredLitres.plus(new Decimal(app.required_litres));
        }
      } else {
        historicalAppsCount++;
      }
    }

    const totalApprovedLitres = allotments.reduce(
      (acc, a) => acc.plus(new Decimal(a.approved_litres || 0)),
      new Decimal(0),
    );

    // Compute Financial Totals
    let totalDevBilled = new Decimal(0);
    let totalDevPaid = new Decimal(0);
    let totalDevPending = new Decimal(0);

    for (const b of devBills) {
      totalDevBilled = totalDevBilled.plus(new Decimal(b.total_amount || 0));
      totalDevPaid = totalDevPaid.plus(new Decimal(b.amount_paid || 0));
      totalDevPending = totalDevPending.plus(new Decimal(b.pending_amount || 0));
    }

    let totalRunningBilled = new Decimal(0);
    let totalRunningPaid = new Decimal(0);
    let totalRunningPending = new Decimal(0);

    for (const r of runningBills) {
      totalRunningBilled = totalRunningBilled.plus(new Decimal(r.amount_due || 0));
      totalRunningPaid = totalRunningPaid.plus(new Decimal(r.amount_paid || 0));
      totalRunningPending = totalRunningPending.plus(new Decimal(r.pending_amount || 0));
    }

    let totalExtBilled = new Decimal(0);
    for (const e of extensionBills) {
      totalExtBilled = totalExtBilled.plus(new Decimal(e.extension_cost || 0));
    }

    const totalCollected = payments.reduce(
      (acc, p) => acc.plus(new Decimal(p.amount || 0)),
      new Decimal(0),
    );

    const totalBilled = totalDevBilled.plus(totalRunningBilled).plus(totalExtBilled);
    const totalPending = totalDevPending.plus(totalRunningPending);

    // Data Quality Quick Check
    let dataQuality = {
      status: 'PASS',
      errorChecks: 0,
      warningChecks: 0,
      totalChecks: 0,
    };

    try {
      const auditResult = await this.integrityService.runFullIntegrityAudit();
      dataQuality = {
        status: auditResult.summary.status,
        errorChecks: auditResult.summary.errorChecks,
        warningChecks: auditResult.summary.warningChecks,
        totalChecks: auditResult.summary.totalChecks,
      };
    } catch (err) {
      this.logger.warn(`Failed to compute data quality for dashboard: ${err.message}`);
    }

    return {
      filters_applied: Object.keys(filterDto).some((k) => !!(filterDto as any)[k]),
      beneficiaries: {
        total: totalBeneficiaries,
        active: activeBeneficiaries,
        inactive: inactiveBeneficiaries,
      },
      land: {
        total_holdings: allHoldings.length,
        active_holdings: activeHoldings.length,
        inactive_holdings: Math.max(0, allHoldings.length - activeHoldings.length),
        total_land_acres: totalLandArea.toFixed(2),
        total_active_acres: totalActiveLandArea.toFixed(2),
      },
      water: {
        total_applications: allApplications.length,
        active_applications: activeAppsCount,
        draft_applications: 0,
        submitted_applications: submittedApps,
        under_review_applications: underReviewApps,
        approved_applications: approvedApps,
        rejected_applications: rejectedApps,
        cancelled_applications: cancelledApps,
        historical_applications: historicalAppsCount,
        total_required_litres: totalRequiredLitres.toFixed(0),
        total_calculated_litres: totalApprovedLitres.toFixed(0),
        total_approved_litres: totalApprovedLitres.toFixed(0),
      },
      financial: isFieldOfficer
        ? {
            accessible: false,
            message: 'Financial metrics are restricted for Field Officers',
          }
        : {
            accessible: true,
            total_development_billing: totalDevBilled.toFixed(2),
            total_development_paid: totalDevPaid.toFixed(2),
            total_development_pending: totalDevPending.toFixed(2),
            total_running_billing: totalRunningBilled.toFixed(2),
            total_running_paid: totalRunningPaid.toFixed(2),
            total_running_pending: totalRunningPending.toFixed(2),
            total_extension_billing: totalExtBilled.toFixed(2),
            total_billed_amount: totalBilled.toFixed(2),
            total_collected: totalCollected.toFixed(2),
            total_pending: totalPending.toFixed(2),
            pending_installments_count: pendingInstallmentsCount,
            overdue_installments_count: overdueInstallmentsCount,
          },
      operations: {
        pending_approvals_count: pendingApprovalsCount,
        infrastructure_awaiting_commissioning_count: infrastructureAwaitingCount,
      },
      data_quality: dataQuality,
      // Backward compatibility fields
      total_beneficiaries: activeBeneficiaries,
      total_land_acres: totalActiveLandArea.toFixed(2),
      total_approved_litres: totalApprovedLitres.toFixed(0),
      total_development_billing: totalDevBilled.toFixed(2),
      total_running_billing: totalRunningBilled.toFixed(2),
      total_collected: totalCollected.toFixed(2),
      total_pending: totalPending.toFixed(2),
      pending_approvals_count: pendingApprovalsCount,
      infrastructure_awaiting_commissioning_count: infrastructureAwaitingCount,
    };
  }

  async getRecentActivity(user?: RequestUser) {
    const isFieldOfficer = user?.role === RoleName.FIELD_OFFICER;

    const [recentApplications, recentApproved, recentPayments, pendingInstallments] =
      await Promise.all([
        this.prisma.waterApplication.findMany({
          orderBy: { created_at: 'desc' },
          take: 6,
          include: {
            beneficiary: {
              select: { beneficiary_id: true, name: true, phone_number: true, village: { select: { name: true } } },
            },
            project: { select: { project_id: true, project_name: true } },
          },
        }),
        this.prisma.waterApplication.findMany({
          where: { status: ApplicationStatus.APPROVED },
          orderBy: { updated_at: 'desc' },
          take: 6,
          include: {
            beneficiary: {
              select: { beneficiary_id: true, name: true, phone_number: true, village: { select: { name: true } } },
            },
            project: { select: { project_id: true, project_name: true } },
            allotment: { select: { approved_litres: true } },
          },
        }),
        !isFieldOfficer
          ? this.prisma.payment.findMany({
              where: { is_reversal: false, status: PaymentStatus.COMPLETED },
              orderBy: { created_at: 'desc' },
              take: 6,
              include: {
                beneficiary: {
                  select: { beneficiary_id: true, name: true, phone_number: true },
                },
              },
            })
          : Promise.resolve([]),
        !isFieldOfficer
          ? this.prisma.installment.findMany({
              where: {
                status: { in: [InstallmentStatus.PENDING, InstallmentStatus.PARTIALLY_PAID] },
              },
              orderBy: { due_date: 'asc' },
              take: 6,
              include: {
                bill: {
                  include: {
                    beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
                  },
                },
              },
            })
          : Promise.resolve([]),
      ]);

    return {
      recent_applications: recentApplications,
      recent_approved: recentApproved,
      recent_payments: recentPayments,
      pending_installments: pendingInstallments,
    };
  }

  async getPendingApprovals() {
    return this.prisma.waterApplication.findMany({
      where: { status: ApplicationStatus.SUBMITTED },
      orderBy: { created_at: 'asc' },
      take: 10,
      include: {
        beneficiary: {
          include: {
            district: true,
            village: true,
            landHoldings: { where: { status: LandStatus.ACTIVE } },
          },
        },
        project: true,
      },
    });
  }

  async getInfrastructureQueue() {
    return this.prisma.infrastructure.findMany({
      where: {
        status: {
          in: [
            InfrastructureStatus.PLANNED,
            InfrastructureStatus.UNDER_CONSTRUCTION,
            InfrastructureStatus.COMPLETED,
          ],
        },
      },
      orderBy: { created_at: 'asc' },
      take: 10,
      include: {
        beneficiary: true,
        allotment: true,
      },
    });
  }
}
