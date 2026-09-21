import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus, InfrastructureStatus, LandStatus, PaymentStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [
      totalBeneficiaries,
      activeHoldings,
      allotments,
      devBills,
      payments,
      pendingApprovalsCount,
      infrastructureAwaitingCommissioningCount,
    ] = await Promise.all([
      this.prisma.beneficiary.count(),
      this.prisma.landHolding.findMany({
        where: { status: LandStatus.ACTIVE },
        select: { declared_total_area: true },
      }),
      this.prisma.waterAllotment.findMany({
        select: { approved_litres: true },
      }),
      this.prisma.developmentBill.findMany({
        select: { total_amount: true, amount_paid: true, pending_amount: true },
      }),
      this.prisma.payment.findMany({
        where: { status: PaymentStatus.COMPLETED, is_reversal: false },
        select: { amount: true },
      }),
      this.prisma.waterApplication.count({
        where: { status: ApplicationStatus.SUBMITTED },
      }),
      this.prisma.infrastructure.count({
        where: { status: { in: [InfrastructureStatus.PLANNED, InfrastructureStatus.UNDER_CONSTRUCTION, InfrastructureStatus.COMPLETED] } },
      }),
    ]);

    const totalLandAcres = activeHoldings.reduce(
      (acc, h) => acc.plus(new Decimal(h.declared_total_area)),
      new Decimal(0),
    );

    const totalApprovedLitres = allotments.reduce(
      (acc, a) => acc.plus(new Decimal(a.approved_litres)),
      new Decimal(0),
    );

    const totalBilling = devBills.reduce(
      (acc, b) => acc.plus(new Decimal(b.total_amount)),
      new Decimal(0),
    );

    const totalCollected = payments.reduce(
      (acc, p) => acc.plus(new Decimal(p.amount)),
      new Decimal(0),
    );

    const totalPending = devBills.reduce(
      (acc, b) => acc.plus(new Decimal(b.pending_amount)),
      new Decimal(0),
    );

    return {
      total_beneficiaries: totalBeneficiaries,
      total_land_acres: totalLandAcres.toFixed(2),
      total_approved_litres: totalApprovedLitres.toFixed(0),
      total_development_billing: totalBilling.toFixed(2),
      total_collected: totalCollected.toFixed(2),
      total_pending: totalPending.toFixed(2),
      pending_approvals_count: pendingApprovalsCount,
      infrastructure_awaiting_commissioning_count: infrastructureAwaitingCommissioningCount,
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
        status: { in: [InfrastructureStatus.PLANNED, InfrastructureStatus.UNDER_CONSTRUCTION, InfrastructureStatus.COMPLETED] },
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
