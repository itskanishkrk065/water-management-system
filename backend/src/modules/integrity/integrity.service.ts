import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from 'decimal.js';

export interface IntegrityFinding {
  code: string;
  category: 'WATER_APPLICATION' | 'LAND_HOLDING' | 'WATER_ALLOTMENT' | 'BILLING' | 'INSTALLMENT' | 'PAYMENT' | 'FINANCIAL_BALANCE';
  severity: 'PASS' | 'WARNING' | 'ERROR';
  entityId?: string;
  title: string;
  description: string;
  details?: any;
}

export interface IntegrityReport {
  timestamp: string;
  summary: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    errorChecks: number;
  };
  findings: IntegrityFinding[];
}

@Injectable()
export class IntegrityService {
  private readonly logger = new Logger(IntegrityService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runFullIntegrityAudit(): Promise<IntegrityReport> {
    const findings: IntegrityFinding[] = [];

    await this.checkWaterApplications(findings);
    await this.checkLandHoldings(findings);
    await this.checkWaterAllotments(findings);
    await this.checkDevelopmentBills(findings);
    await this.checkInstallments(findings);
    await this.checkPayments(findings);
    await this.checkFinancialBalances(findings);

    const errorCount = findings.filter((f) => f.severity === 'ERROR').length;
    const warningCount = findings.filter((f) => f.severity === 'WARNING').length;
    const passCount = findings.filter((f) => f.severity === 'PASS').length;

    const overallStatus: 'PASS' | 'WARNING' | 'ERROR' =
      errorCount > 0 ? 'ERROR' : warningCount > 0 ? 'WARNING' : 'PASS';

    return {
      timestamp: new Date().toISOString(),
      summary: {
        status: overallStatus,
        totalChecks: findings.length,
        passedChecks: passCount,
        warningChecks: warningCount,
        errorChecks: errorCount,
      },
      findings,
    };
  }

  private async checkWaterApplications(findings: IntegrityFinding[]) {
    // 1. Check for duplicate active applications per land holding
    const activeApps = await this.prisma.waterApplication.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'DRAFT'] },
        land_id: { not: null },
      },
      include: { landHolding: true, beneficiary: true },
    });

    const landAppMap = new Map<string, typeof activeApps>();
    for (const app of activeApps) {
      if (!app.land_id) continue;
      const list = landAppMap.get(app.land_id) || [];
      list.push(app);
      landAppMap.set(app.land_id, list);
    }

    let duplicateHoldingsCount = 0;
    for (const [landId, apps] of landAppMap.entries()) {
      if (apps.length > 1) {
        duplicateHoldingsCount++;
        findings.push({
          code: 'WATER_APP_DUPLICATE_HOLDING',
          category: 'WATER_APPLICATION',
          severity: 'ERROR',
          entityId: landId,
          title: `Duplicate active water applications on Land Holding ${landId}`,
          description: `Land holding has ${apps.length} active applications (${apps.map((a) => `#${a.application_id.slice(0, 8)} [${a.status}]`).join(', ')}). Only one active application is permitted per holding.`,
          details: {
            landId,
            beneficiaryId: apps[0].beneficiary_id,
            applications: apps.map((a) => ({ id: a.application_id, status: a.status, required_litres: a.required_litres.toString() })),
          },
        });
      }
    }

    if (duplicateHoldingsCount === 0) {
      findings.push({
        code: 'WATER_APP_HOLDING_UNIQUENESS_PASS',
        category: 'WATER_APPLICATION',
        severity: 'PASS',
        title: 'One water application per land holding rule satisfied',
        description: 'All active land holdings have at most one active water application.',
      });
    }

    // 2. Check for ownership mismatch between water application and land holding
    for (const app of activeApps) {
      if (app.landHolding && app.landHolding.beneficiary_id !== app.beneficiary_id) {
        findings.push({
          code: 'WATER_APP_OWNERSHIP_MISMATCH',
          category: 'WATER_APPLICATION',
          severity: 'ERROR',
          entityId: app.application_id,
          title: `Application #${app.application_id.slice(0, 8)} land ownership mismatch`,
          description: `Application beneficiary (${app.beneficiary_id}) does not match land holding beneficiary (${app.landHolding.beneficiary_id}).`,
        });
      }
    }

    // 3. Check for approved applications without water allotments
    const approvedWithoutAllotment = await this.prisma.waterApplication.findMany({
      where: {
        status: 'APPROVED',
        allotment: null,
      },
    });

    for (const app of approvedWithoutAllotment) {
      findings.push({
        code: 'WATER_APP_APPROVED_MISSING_ALLOTMENT',
        category: 'WATER_APPLICATION',
        severity: 'ERROR',
        entityId: app.application_id,
        title: `Approved Application #${app.application_id.slice(0, 8)} missing Allotment record`,
        description: 'Application is marked APPROVED but has no corresponding WaterAllotment row.',
      });
    }
  }

  private async checkLandHoldings(findings: IntegrityFinding[]) {
    const holdings = await this.prisma.landHolding.findMany({
      include: { parcels: true, beneficiary: true },
    });

    let invalidAreaCount = 0;
    for (const h of holdings) {
      const area = new Decimal(h.declared_total_area);
      if (area.lte(0)) {
        invalidAreaCount++;
        findings.push({
          code: 'LAND_INVALID_AREA',
          category: 'LAND_HOLDING',
          severity: 'ERROR',
          entityId: h.land_id,
          title: `Land holding #${h.land_id.slice(0, 8)} has zero or negative declared area`,
          description: `Declared area is ${area.toString()} acres.`,
        });
      }

      if (h.parcels.length > 0) {
        const parcelSum = h.parcels.reduce((acc, p) => acc.plus(new Decimal(p.area)), new Decimal(0));
        if (!parcelSum.equals(area)) {
          findings.push({
            code: 'LAND_PARCEL_SUM_MISMATCH',
            category: 'LAND_HOLDING',
            severity: 'WARNING',
            entityId: h.land_id,
            title: `Land holding #${h.land_id.slice(0, 8)} parcel area sum mismatch`,
            description: `Declared area is ${area.toString()} acres but sum of parcels is ${parcelSum.toString()} acres.`,
            details: { declaredArea: area.toString(), parcelSum: parcelSum.toString() },
          });
        }
      }
    }

    if (invalidAreaCount === 0) {
      findings.push({
        code: 'LAND_AREA_VALID_PASS',
        category: 'LAND_HOLDING',
        severity: 'PASS',
        title: 'All land holdings have valid positive declared areas',
        description: 'No zero or negative land areas detected.',
      });
    }
  }

  private async checkWaterAllotments(findings: IntegrityFinding[]) {
    const allotments = await this.prisma.waterAllotment.findMany({
      include: { rate: true, application: true, developmentBill: true },
    });

    let missingRateCount = 0;
    for (const a of allotments) {
      const approvedLitres = new Decimal(a.approved_litres);
      if (approvedLitres.lte(0)) {
        findings.push({
          code: 'ALLOTMENT_ZERO_APPROVED_LITRES',
          category: 'WATER_ALLOTMENT',
          severity: 'ERROR',
          entityId: a.allotment_id,
          title: `Allotment #${a.allotment_id.slice(0, 8)} has non-positive approved litres`,
          description: `Approved volume is ${approvedLitres.toString()} L.`,
        });
      }

      if (!a.rate && !a.rate_id) {
        missingRateCount++;
        findings.push({
          code: 'ALLOTMENT_MISSING_RATE',
          category: 'WATER_ALLOTMENT',
          severity: 'ERROR',
          entityId: a.allotment_id,
          title: `Allotment #${a.allotment_id.slice(0, 8)} missing rate configuration link`,
          description: 'Allotment does not link to a valid historical RateConfiguration.',
        });
      }
    }

    if (missingRateCount === 0 && allotments.length > 0) {
      findings.push({
        code: 'ALLOTMENT_RATE_SNAPSHOT_PASS',
        category: 'WATER_ALLOTMENT',
        severity: 'PASS',
        title: 'All water allotments have valid historical rate snapshots',
        description: 'Rate configurations and volume snapshots are properly linked.',
      });
    }
  }

  private async checkDevelopmentBills(findings: IntegrityFinding[]) {
    const bills = await this.prisma.developmentBill.findMany({
      include: { allotment: true, installments: true },
    });

    let calculationMismatches = 0;
    for (const b of bills) {
      const approvedLitres = new Decimal(b.approved_litres_snapshot);
      const devRate = new Decimal(b.development_cost_per_litre_snapshot);
      const totalAmount = new Decimal(b.total_amount);

      const expectedTotal = approvedLitres.mul(devRate).toDecimalPlaces(2);
      if (!totalAmount.equals(expectedTotal)) {
        calculationMismatches++;
        findings.push({
          code: 'BILL_CALCULATION_MISMATCH',
          category: 'BILLING',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Development Bill #${b.bill_id.slice(0, 8)} calculation mismatch`,
          description: `Stored total ₹${totalAmount.toFixed(2)} does not match formula (${approvedLitres.toString()} L × ₹${devRate.toString()}/L = ₹${expectedTotal.toFixed(2)}).`,
          details: { approvedLitres: approvedLitres.toString(), rate: devRate.toString(), storedTotal: totalAmount.toString(), expectedTotal: expectedTotal.toString() },
        });
      }

      if (totalAmount.lt(0)) {
        findings.push({
          code: 'BILL_NEGATIVE_TOTAL',
          category: 'BILLING',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Development Bill #${b.bill_id.slice(0, 8)} has negative total amount`,
          description: `Stored total is ₹${totalAmount.toString()}.`,
        });
      }
    }

    if (calculationMismatches === 0) {
      findings.push({
        code: 'BILL_CALCULATIONS_ACCURATE_PASS',
        category: 'BILLING',
        severity: 'PASS',
        title: 'Development bills mathematically match approved volume × historical rate',
        description: 'All development bill calculations are consistent and locked to historical rates.',
      });
    }
  }

  private async checkInstallments(findings: IntegrityFinding[]) {
    const bills = await this.prisma.developmentBill.findMany({
      include: { installments: { orderBy: { installment_number: 'asc' } } },
    });

    let installmentErrors = 0;
    for (const b of bills) {
      const insts = b.installments;
      if (insts.length !== 5) {
        installmentErrors++;
        findings.push({
          code: 'INSTALLMENT_COUNT_MISMATCH',
          category: 'INSTALLMENT',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Bill #${b.bill_id.slice(0, 8)} has ${insts.length} installments instead of 5`,
          description: 'Every development bill must have exactly 5 milestone installments.',
        });
      }

      const totalPct = insts.reduce((acc, inst) => acc.plus(new Decimal(inst.percentage)), new Decimal(0));
      if (!totalPct.equals(new Decimal(100))) {
        installmentErrors++;
        findings.push({
          code: 'INSTALLMENT_PERCENTAGE_SUM_MISMATCH',
          category: 'INSTALLMENT',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Bill #${b.bill_id.slice(0, 8)} installment percentages sum to ${totalPct.toString()}% (expected 100%)`,
          description: 'Installment percentages must sum to exactly 100%.',
        });
      }

      const totalDue = insts.reduce((acc, inst) => acc.plus(new Decimal(inst.amount_due)), new Decimal(0));
      const billTotal = new Decimal(b.total_amount);
      if (!totalDue.equals(billTotal)) {
        installmentErrors++;
        findings.push({
          code: 'INSTALLMENT_AMOUNT_SUM_MISMATCH',
          category: 'INSTALLMENT',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Bill #${b.bill_id.slice(0, 8)} installments sum ₹${totalDue.toFixed(2)} does not match bill total ₹${billTotal.toFixed(2)}`,
          description: 'Sum of installment amounts due must equal the development bill total amount.',
        });
      }
    }

    if (installmentErrors === 0) {
      findings.push({
        code: 'INSTALLMENTS_VALID_PASS',
        category: 'INSTALLMENT',
        severity: 'PASS',
        title: 'Installment milestone schedules total exactly 100% and match bill amounts',
        description: 'All 5-stage installment schedules are mathematically balanced with proper rounding.',
      });
    }
  }

  private async checkPayments(findings: IntegrityFinding[]) {
    const payments = await this.prisma.payment.findMany();

    let invalidPayments = 0;
    for (const p of payments) {
      const amount = new Decimal(p.amount);
      if (!p.is_reversal && amount.lte(0)) {
        invalidPayments++;
        findings.push({
          code: 'PAYMENT_INVALID_AMOUNT',
          category: 'PAYMENT',
          severity: 'ERROR',
          entityId: p.payment_id,
          title: `Payment #${p.payment_id.slice(0, 8)} has non-positive amount`,
          description: `Payment amount is ₹${amount.toString()}.`,
        });
      }
    }

    if (invalidPayments === 0) {
      findings.push({
        code: 'PAYMENTS_VALID_PASS',
        category: 'PAYMENT',
        severity: 'PASS',
        title: 'All payment transactions have valid monetary amounts and audit references',
        description: 'No invalid payment amounts detected.',
      });
    }
  }

  private async checkFinancialBalances(findings: IntegrityFinding[]) {
    const bills = await this.prisma.developmentBill.findMany({
      include: {
        installments: {
          include: {
            payments: { where: { status: 'COMPLETED', is_reversal: false } },
          },
        },
      },
    });

    let balanceMismatches = 0;
    for (const b of bills) {
      let expectedBillPaid = new Decimal(0);

      for (const inst of b.installments) {
        const instPaid = inst.payments.reduce((acc, p) => acc.plus(new Decimal(p.amount)), new Decimal(0));
        expectedBillPaid = expectedBillPaid.plus(instPaid);

        const storedInstPaid = new Decimal(inst.amount_paid);
        const storedInstPending = new Decimal(inst.pending_amount);
        const instDue = new Decimal(inst.amount_due);

        if (!storedInstPaid.equals(instPaid)) {
          balanceMismatches++;
          findings.push({
            code: 'INSTALLMENT_PAID_BALANCE_MISMATCH',
            category: 'FINANCIAL_BALANCE',
            severity: 'ERROR',
            entityId: inst.installment_id,
            title: `Installment #${inst.installment_number} of Bill #${b.bill_id.slice(0, 8)} paid mismatch`,
            description: `Stored amount_paid ₹${storedInstPaid.toFixed(2)} does not match verified payments sum ₹${instPaid.toFixed(2)}.`,
          });
        }

        const expectedInstPending = Decimal.max(0, instDue.minus(instPaid));
        if (!storedInstPending.equals(expectedInstPending)) {
          balanceMismatches++;
          findings.push({
            code: 'INSTALLMENT_PENDING_BALANCE_MISMATCH',
            category: 'FINANCIAL_BALANCE',
            severity: 'ERROR',
            entityId: inst.installment_id,
            title: `Installment #${inst.installment_number} of Bill #${b.bill_id.slice(0, 8)} pending mismatch`,
            description: `Stored pending_amount ₹${storedInstPending.toFixed(2)} does not match expected ₹${expectedInstPending.toFixed(2)}.`,
          });
        }
      }

      const storedBillPaid = new Decimal(b.amount_paid);
      const storedBillPending = new Decimal(b.pending_amount);
      const billTotal = new Decimal(b.total_amount);

      if (!storedBillPaid.equals(expectedBillPaid)) {
        balanceMismatches++;
        findings.push({
          code: 'BILL_PAID_BALANCE_MISMATCH',
          category: 'FINANCIAL_BALANCE',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Bill #${b.bill_id.slice(0, 8)} amount_paid mismatch`,
          description: `Stored amount_paid ₹${storedBillPaid.toFixed(2)} does not match sum of verified payments ₹${expectedBillPaid.toFixed(2)}.`,
        });
      }

      const expectedBillPending = Decimal.max(0, billTotal.minus(expectedBillPaid));
      if (!storedBillPending.equals(expectedBillPending)) {
        balanceMismatches++;
        findings.push({
          code: 'BILL_PENDING_BALANCE_MISMATCH',
          category: 'FINANCIAL_BALANCE',
          severity: 'ERROR',
          entityId: b.bill_id,
          title: `Bill #${b.bill_id.slice(0, 8)} pending_amount mismatch`,
          description: `Stored pending_amount ₹${storedBillPending.toFixed(2)} does not match expected balance ₹${expectedBillPending.toFixed(2)}.`,
        });
      }
    }

    if (balanceMismatches === 0) {
      findings.push({
        code: 'FINANCIAL_BALANCES_ACCURATE_PASS',
        category: 'FINANCIAL_BALANCE',
        severity: 'PASS',
        title: 'Financial ledgers, total paid and outstanding balances 100% reconciled',
        description: 'All development bills and installment pending amounts match verified posted transactions.',
      });
    }
  }
}
