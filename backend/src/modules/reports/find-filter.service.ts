import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FindFilterDto, ReportingDateType } from './dto/find-filter.dto';
import {
  Prisma,
  BeneficiaryStatus,
  LandStatus,
  AuditAction,
} from '@prisma/client';
import { Decimal } from 'decimal.js';
import { d, toDecimalString } from '../common/decimal.util';
import * as PDFDocument from 'pdfkit';

export interface FilteredRecordItem {
  beneficiaryId: string;
  name: string;
  phoneNumber: string;
  districtName: string;
  blockName: string;
  villageName: string;
  totalLandAcres: string;
  requiredLitres: string;
  calculatedLitres: string;
  approvedLitres: string;
  developmentCost: string;
  amountPaid: string;
  pendingBalance: string;
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'NO_BILL';
  infrastructureStatus: string;
  applicationStatus: string;
  extensionCount: number;
}

export interface FilteredMetricsSummary {
  beneficiaries: {
    total: number;
    active: number;
    inactive: number;
  };
  land: {
    totalLandAcres: string;
    totalHoldings: number;
    totalParcels: number;
  };
  water: {
    totalRequiredLitres: string;
    totalCalculatedLitres: string;
    totalApprovedLitres: string;
  };
  financials: {
    totalDevelopmentCost: string;
    totalAmountDue: string;
    totalAmountPaid: string;
    totalPending: string;
  };
  paymentBeneficiaries: {
    paid: number;
    partiallyPaid: number;
    unpaid: number;
    overdue: number;
  };
  installments: {
    total: number;
    paid: number;
    partiallyPaid: number;
    pending: number;
    overdue: number;
    amountDue: string;
    amountPaid: string;
    pendingBalance: string;
  };
  infrastructure: {
    planned: number;
    underConstruction: number;
    completed: number;
    commissioned: number;
  };
  extensions: {
    totalRequests: number;
    pending: number;
    approved: number;
    rejected: number;
    additionalLitresRequested: string;
    additionalLitresApproved: string;
  };
}

@Injectable()
export class FindFilterService {
  private readonly logger = new Logger(FindFilterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Centralized filter condition builder mapping FindFilterDto into Prisma WhereInput.
   */
  public buildBeneficiaryWhere(dto: FindFilterDto): Prisma.BeneficiaryWhereInput {
    const where: Prisma.BeneficiaryWhereInput = {};
    const andConditions: Prisma.BeneficiaryWhereInput[] = [];

    // 1. Location Filters
    if (dto.districtId) {
      andConditions.push({ district_id: dto.districtId });
    }
    if (dto.blockId) {
      andConditions.push({ block_id: dto.blockId });
    }
    if (dto.panchayatId) {
      andConditions.push({ panchayat_id: dto.panchayatId });
    }
    if (dto.villageId) {
      andConditions.push({ village_id: dto.villageId });
    } else if (dto.villageIds && dto.villageIds.length > 0) {
      andConditions.push({ village_id: { in: dto.villageIds } });
    }

    // 2. Beneficiary Filters
    if (dto.beneficiaryName) {
      andConditions.push({
        name: { contains: dto.beneficiaryName.trim(), mode: 'insensitive' },
      });
    }
    if (dto.phoneNumber) {
      andConditions.push({
        phone_number: { contains: dto.phoneNumber.trim() },
      });
    }
    if (dto.beneficiaryStatus) {
      andConditions.push({ status: dto.beneficiaryStatus });
    }

    // 3. Land Filters
    const landCondition: Prisma.LandHoldingListRelationFilter = {};
    const landWhere: Prisma.LandHoldingWhereInput = { status: LandStatus.ACTIVE };
    let hasLandFilter = false;

    if (dto.landAreaMin !== undefined || dto.landAreaMax !== undefined) {
      hasLandFilter = true;
      const areaFilter: Prisma.DecimalFilter = {};
      if (dto.landAreaMin !== undefined) areaFilter.gte = dto.landAreaMin;
      if (dto.landAreaMax !== undefined) areaFilter.lte = dto.landAreaMax;
      landWhere.declared_total_area = areaFilter;
    }

    if (dto.surveyNumber || dto.subdivisionNumber) {
      hasLandFilter = true;
      const parcelWhere: Prisma.LandParcelWhereInput = {};
      if (dto.surveyNumber) {
        parcelWhere.survey_number = { contains: dto.surveyNumber.trim(), mode: 'insensitive' };
      }
      if (dto.subdivisionNumber) {
        parcelWhere.subdivision_number = { contains: dto.subdivisionNumber.trim(), mode: 'insensitive' };
      }
      landWhere.parcels = { some: parcelWhere };
    }

    if (hasLandFilter) {
      andConditions.push({ landHoldings: { some: landWhere } });
    }

    // 4. Water Application & Allotment Filters
    if (
      dto.requiredLitresMin !== undefined ||
      dto.requiredLitresMax !== undefined ||
      dto.applicationStatus
    ) {
      const appWhere: Prisma.WaterApplicationWhereInput = {};
      if (dto.requiredLitresMin !== undefined || dto.requiredLitresMax !== undefined) {
        const litresFilter: Prisma.DecimalFilter = {};
        if (dto.requiredLitresMin !== undefined) litresFilter.gte = dto.requiredLitresMin;
        if (dto.requiredLitresMax !== undefined) litresFilter.lte = dto.requiredLitresMax;
        appWhere.required_litres = litresFilter;
      }
      if (dto.applicationStatus) {
        appWhere.status = dto.applicationStatus;
      }
      andConditions.push({ waterApplications: { some: appWhere } });
    }

    if (
      dto.calculatedLitresMin !== undefined ||
      dto.calculatedLitresMax !== undefined ||
      dto.approvedLitresMin !== undefined ||
      dto.approvedLitresMax !== undefined ||
      dto.approvalStatus
    ) {
      const allotWhere: Prisma.WaterAllotmentWhereInput = {};
      if (dto.calculatedLitresMin !== undefined || dto.calculatedLitresMax !== undefined) {
        const calcFilter: Prisma.DecimalFilter = {};
        if (dto.calculatedLitresMin !== undefined) calcFilter.gte = dto.calculatedLitresMin;
        if (dto.calculatedLitresMax !== undefined) calcFilter.lte = dto.calculatedLitresMax;
        allotWhere.calculated_allotted_litres = calcFilter;
      }
      if (dto.approvedLitresMin !== undefined || dto.approvedLitresMax !== undefined) {
        const appFilter: Prisma.DecimalFilter = {};
        if (dto.approvedLitresMin !== undefined) appFilter.gte = dto.approvedLitresMin;
        if (dto.approvedLitresMax !== undefined) appFilter.lte = dto.approvedLitresMax;
        allotWhere.approved_litres = appFilter;
      }
      if (dto.approvalStatus) {
        allotWhere.approval_status = dto.approvalStatus;
      }
      andConditions.push({ waterAllotments: { some: allotWhere } });
    }

    // 5. Billing & Payment Status Filters
    const billWhere: Prisma.DevelopmentBillWhereInput = {};
    let hasBillFilter = false;

    if (dto.developmentBillStatus) {
      hasBillFilter = true;
      billWhere.status = dto.developmentBillStatus;
    }
    if (dto.developmentCostMin !== undefined || dto.developmentCostMax !== undefined) {
      hasBillFilter = true;
      const costFilter: Prisma.DecimalFilter = {};
      if (dto.developmentCostMin !== undefined) costFilter.gte = dto.developmentCostMin;
      if (dto.developmentCostMax !== undefined) costFilter.lte = dto.developmentCostMax;
      billWhere.total_amount = costFilter;
    }

    // Installment Filters
    if (
      dto.installmentNumber !== undefined ||
      dto.installmentStatus ||
      dto.installmentAmountDueMin !== undefined ||
      dto.installmentAmountDueMax !== undefined ||
      dto.installmentAmountPaidMin !== undefined ||
      dto.installmentAmountPaidMax !== undefined ||
      dto.installmentPendingMin !== undefined ||
      dto.installmentPendingMax !== undefined
    ) {
      hasBillFilter = true;
      const instWhere: Prisma.InstallmentWhereInput = {};
      if (dto.installmentNumber !== undefined) {
        instWhere.installment_number = dto.installmentNumber;
      }
      if (dto.installmentStatus) {
        instWhere.status = dto.installmentStatus;
      }
      if (dto.installmentAmountDueMin !== undefined || dto.installmentAmountDueMax !== undefined) {
        const dueFilter: Prisma.DecimalFilter = {};
        if (dto.installmentAmountDueMin !== undefined) dueFilter.gte = dto.installmentAmountDueMin;
        if (dto.installmentAmountDueMax !== undefined) dueFilter.lte = dto.installmentAmountDueMax;
        instWhere.amount_due = dueFilter;
      }
      if (dto.installmentAmountPaidMin !== undefined || dto.installmentAmountPaidMax !== undefined) {
        const paidFilter: Prisma.DecimalFilter = {};
        if (dto.installmentAmountPaidMin !== undefined) paidFilter.gte = dto.installmentAmountPaidMin;
        if (dto.installmentAmountPaidMax !== undefined) paidFilter.lte = dto.installmentAmountPaidMax;
        instWhere.amount_paid = paidFilter;
      }
      if (dto.installmentPendingMin !== undefined || dto.installmentPendingMax !== undefined) {
        const pendFilter: Prisma.DecimalFilter = {};
        if (dto.installmentPendingMin !== undefined) pendFilter.gte = dto.installmentPendingMin;
        if (dto.installmentPendingMax !== undefined) pendFilter.lte = dto.installmentPendingMax;
        instWhere.pending_amount = pendFilter;
      }
      billWhere.installments = { some: instWhere };
    }

    // High-level Payment Summary Status
    if (dto.paymentStatus) {
      hasBillFilter = true;
      if (dto.paymentStatus === 'PAID') {
        billWhere.status = 'PAID';
      } else if (dto.paymentStatus === 'PARTIALLY_PAID') {
        billWhere.status = 'PARTIALLY_PAID';
      } else if (dto.paymentStatus === 'UNPAID') {
        billWhere.status = 'PENDING';
        billWhere.amount_paid = { lte: 0 };
      } else if (dto.paymentStatus === 'OVERDUE') {
        billWhere.installments = {
          some: { status: 'OVERDUE' },
        };
      }
    }

    if (hasBillFilter) {
      andConditions.push({ developmentBills: { some: billWhere } });
    }

    // 6. Payment Transaction Filters
    if (
      dto.paymentMode ||
      dto.paymentDateFrom ||
      dto.paymentDateTo ||
      dto.paymentReference ||
      dto.receiptNumber
    ) {
      const payWhere: Prisma.PaymentWhereInput = { is_reversal: false };
      if (dto.paymentMode) payWhere.payment_mode = dto.paymentMode;
      if (dto.paymentReference) payWhere.payment_reference = { contains: dto.paymentReference.trim(), mode: 'insensitive' };
      if (dto.receiptNumber) payWhere.receipt_number = { contains: dto.receiptNumber.trim(), mode: 'insensitive' };
      if (dto.paymentDateFrom || dto.paymentDateTo) {
        const pDateFilter: Prisma.DateTimeFilter = {};
        if (dto.paymentDateFrom) pDateFilter.gte = new Date(dto.paymentDateFrom);
        if (dto.paymentDateTo) pDateFilter.lte = new Date(dto.paymentDateTo);
        payWhere.payment_date = pDateFilter;
      }
      andConditions.push({ payments: { some: payWhere } });
    }

    // 7. Infrastructure Status Filter
    if (dto.infrastructureStatus) {
      andConditions.push({
        infrastructures: { some: { status: dto.infrastructureStatus } },
      });
    }

    // 8. Running Charges Filters
    if (dto.runningBillStatus || dto.runningAmountMin !== undefined || dto.runningAmountMax !== undefined || dto.billingPeriod) {
      const rbWhere: Prisma.RunningBillWhereInput = {};
      if (dto.runningBillStatus) rbWhere.status = dto.runningBillStatus;
      if (dto.billingPeriod) rbWhere.billing_period = dto.billingPeriod;
      if (dto.runningAmountMin !== undefined || dto.runningAmountMax !== undefined) {
        const rbAmt: Prisma.DecimalFilter = {};
        if (dto.runningAmountMin !== undefined) rbAmt.gte = dto.runningAmountMin;
        if (dto.runningAmountMax !== undefined) rbAmt.lte = dto.runningAmountMax;
        rbWhere.amount_due = rbAmt;
      }
      andConditions.push({ runningBills: { some: rbWhere } });
    }

    // 9. Extensions Filters
    if (dto.extensionStatus || dto.extensionLitresMin !== undefined || dto.extensionLitresMax !== undefined) {
      const extWhere: Prisma.ExtensionWhereInput = {};
      if (dto.extensionStatus) extWhere.status = dto.extensionStatus;
      if (dto.extensionLitresMin !== undefined || dto.extensionLitresMax !== undefined) {
        const extLit: Prisma.DecimalFilter = {};
        if (dto.extensionLitresMin !== undefined) extLit.gte = dto.extensionLitresMin;
        if (dto.extensionLitresMax !== undefined) extLit.lte = dto.extensionLitresMax;
        extWhere.requested_additional_litres = extLit;
      }
      andConditions.push({ extensions: { some: extWhere } });
    }

    // 10. Generic Date Filter
    if (dto.dateType && (dto.dateFrom || dto.dateTo)) {
      const dFilter: Prisma.DateTimeFilter = {};
      if (dto.dateFrom) dFilter.gte = new Date(dto.dateFrom);
      if (dto.dateTo) dFilter.lte = new Date(dto.dateTo);

      switch (dto.dateType) {
        case ReportingDateType.APPLICATION_DATE:
          andConditions.push({ waterApplications: { some: { application_date: dFilter } } });
          break;
        case ReportingDateType.APPROVAL_DATE:
          andConditions.push({ waterAllotments: { some: { approved_at: dFilter } } });
          break;
        case ReportingDateType.PAYMENT_DATE:
          andConditions.push({ payments: { some: { payment_date: dFilter, is_reversal: false } } });
          break;
        case ReportingDateType.PLANNED_DATE:
          andConditions.push({ infrastructures: { some: { planned_date: dFilter } } });
          break;
        case ReportingDateType.COMMISSIONED_DATE:
          andConditions.push({ infrastructures: { some: { commissioned_date: dFilter } } });
          break;
        case ReportingDateType.EXTENSION_DATE:
          andConditions.push({ extensions: { some: { requested_at: dFilter } } });
          break;
        case ReportingDateType.CREATED_AT:
          andConditions.push({ created_at: dFilter });
          break;
      }
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    return where;
  }

  /**
   * Helper: Extracts display attributes & evaluates accurate payment status for a single beneficiary.
   */
  public transformBeneficiaryRecord(b: any): FilteredRecordItem {
    // 1. Total Land
    const totalLand = (b.landHoldings || [])
      .filter((h: any) => h.status === LandStatus.ACTIVE)
      .reduce((acc: Decimal, h: any) => acc.plus(d(h.declared_total_area)), new Decimal(0));

    // 2. Latest Application & Allotment
    const latestApp = b.waterApplications?.[0] || null;
    const activeAllotment = b.waterAllotments?.[0] || null;

    // 3. Financials
    const bill = activeAllotment?.developmentBill || b.developmentBills?.[0] || null;
    const devCost = bill ? d(bill.total_amount) : new Decimal(0);
    const amtPaid = bill ? d(bill.amount_paid) : new Decimal(0);
    const pendBal = bill ? d(bill.pending_amount) : new Decimal(0);

    // 4. Payment status evaluation
    let paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'OVERDUE' | 'NO_BILL' = 'NO_BILL';
    if (bill) {
      const hasOverdue = bill.installments?.some((inst: any) => inst.status === 'OVERDUE');
      if (hasOverdue) {
        paymentStatus = 'OVERDUE';
      } else if (bill.status === 'PAID') {
        paymentStatus = 'PAID';
      } else if (bill.status === 'PARTIALLY_PAID') {
        paymentStatus = 'PARTIALLY_PAID';
      } else {
        paymentStatus = 'UNPAID';
      }
    }

    // 5. Infrastructure status
    const infra = activeAllotment?.infrastructure || b.infrastructures?.[0] || null;

    return {
      beneficiaryId: b.beneficiary_id,
      name: b.name,
      phoneNumber: b.phone_number,
      districtName: b.district?.name || '—',
      blockName: b.block?.name || b.panchayat?.name || '—',
      villageName: b.village?.name || '—',
      totalLandAcres: toDecimalString(totalLand, 4),
      requiredLitres: latestApp ? toDecimalString(d(latestApp.required_litres), 2) : '0.00',
      calculatedLitres: activeAllotment ? toDecimalString(d(activeAllotment.calculated_allotted_litres), 2) : '0.00',
      approvedLitres: activeAllotment ? toDecimalString(d(activeAllotment.approved_litres), 2) : '0.00',
      developmentCost: toDecimalString(devCost, 2),
      amountPaid: toDecimalString(amtPaid, 2),
      pendingBalance: toDecimalString(pendBal, 2),
      paymentStatus,
      infrastructureStatus: infra ? infra.status : 'NOT_PLANNED',
      applicationStatus: latestApp ? latestApp.status : 'NO_APPLICATION',
      extensionCount: b.extensions?.length || 0,
    };
  }

  /**
   * Executes complete reporting query, calculates filtered metrics over the entire matching population, and returns paginated records.
   */
  async executeFilterQuery(dto: FindFilterDto, userId: string, ipAddress?: string) {
    const where = this.buildBeneficiaryWhere(dto);

    const page = Math.max(1, dto.page || 1);
    const limit = Math.max(1, Math.min(250, dto.limit || 50));
    const skip = (page - 1) * limit;

    // Fetch all matching beneficiaries with full relations for exact population metrics
    const [allMatchingBeneficiaries, totalCount] = await Promise.all([
      this.prisma.beneficiary.findMany({
        where,
        include: {
          district: true,
          block: true,
          panchayat: true,
          village: true,
          landHoldings: {
            where: { status: LandStatus.ACTIVE },
            include: { parcels: true },
          },
          waterApplications: {
            orderBy: { created_at: 'desc' },
          },
          waterAllotments: {
            orderBy: { created_at: 'desc' },
            include: {
              developmentBill: {
                include: {
                  installments: { orderBy: { installment_number: 'asc' } },
                },
              },
              infrastructure: true,
            },
          },
          developmentBills: {
            include: {
              installments: { orderBy: { installment_number: 'asc' } },
            },
          },
          infrastructures: {
            orderBy: { created_at: 'desc' },
          },
          extensions: {
            orderBy: { created_at: 'desc' },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.beneficiary.count({ where }),
    ]);

    // Compute Metrics Aggregation across ENTIRE matching population (without join duplicates)
    let totalLandSum = new Decimal(0);
    let totalHoldingsCount = 0;
    let totalParcelsCount = 0;

    let totalRequiredWater = new Decimal(0);
    let totalCalculatedWater = new Decimal(0);
    let totalApprovedWater = new Decimal(0);

    let totalDevCost = new Decimal(0);
    let totalPaid = new Decimal(0);
    let totalPending = new Decimal(0);

    let activeCount = 0;
    let inactiveCount = 0;

    let paidBenCount = 0;
    let partiallyPaidBenCount = 0;
    let unpaidBenCount = 0;
    let overdueBenCount = 0;

    let totalInstCount = 0;
    let paidInstCount = 0;
    let partialInstCount = 0;
    let pendingInstCount = 0;
    let overdueInstCount = 0;
    let instDueSum = new Decimal(0);
    let instPaidSum = new Decimal(0);
    let instPendingSum = new Decimal(0);

    let infraPlanned = 0;
    let infraUnderConst = 0;
    let infraCompleted = 0;
    let infraCommissioned = 0;

    let extTotalRequests = 0;
    let extPending = 0;
    let extApproved = 0;
    let extRejected = 0;
    let extReqLitresSum = new Decimal(0);
    let extAppLitresSum = new Decimal(0);

    for (const b of allMatchingBeneficiaries) {
      if (b.status === BeneficiaryStatus.ACTIVE) activeCount++;
      else inactiveCount++;

      // Land
      for (const h of b.landHoldings) {
        totalHoldingsCount++;
        totalLandSum = totalLandSum.plus(d(h.declared_total_area));
        totalParcelsCount += h.parcels?.length || 0;
      }

      // Water Applications
      if (b.waterApplications.length > 0) {
        totalRequiredWater = totalRequiredWater.plus(d(b.waterApplications[0].required_litres));
      }

      // Allotments
      if (b.waterAllotments.length > 0) {
        const a = b.waterAllotments[0];
        totalCalculatedWater = totalCalculatedWater.plus(d(a.calculated_allotted_litres));
        totalApprovedWater = totalApprovedWater.plus(d(a.approved_litres));
      }

      // Billing & Payments
      const bill = b.waterAllotments?.[0]?.developmentBill || b.developmentBills?.[0] || null;
      if (bill) {
        totalDevCost = totalDevCost.plus(d(bill.total_amount));
        totalPaid = totalPaid.plus(d(bill.amount_paid));
        totalPending = totalPending.plus(d(bill.pending_amount));

        const hasOverdue = bill.installments?.some((i: any) => i.status === 'OVERDUE');
        if (hasOverdue) overdueBenCount++;
        else if (bill.status === 'PAID') paidBenCount++;
        else if (bill.status === 'PARTIALLY_PAID') partiallyPaidBenCount++;
        else unpaidBenCount++;

        // Installments metrics
        for (const inst of bill.installments || []) {
          totalInstCount++;
          instDueSum = instDueSum.plus(d(inst.amount_due));
          instPaidSum = instPaidSum.plus(d(inst.amount_paid));
          instPendingSum = instPendingSum.plus(d(inst.pending_amount));

          if (inst.status === 'PAID') paidInstCount++;
          else if (inst.status === 'PARTIALLY_PAID') partialInstCount++;
          else if (inst.status === 'OVERDUE') overdueInstCount++;
          else pendingInstCount++;
        }
      }

      // Infrastructure
      const infra = b.waterAllotments?.[0]?.infrastructure || b.infrastructures?.[0] || null;
      if (infra) {
        if (infra.status === 'PLANNED') infraPlanned++;
        else if (infra.status === 'UNDER_CONSTRUCTION') infraUnderConst++;
        else if (infra.status === 'COMPLETED') infraCompleted++;
        else if (infra.status === 'COMMISSIONED') infraCommissioned++;
      }

      // Extensions
      for (const ext of b.extensions || []) {
        extTotalRequests++;
        extReqLitresSum = extReqLitresSum.plus(d(ext.requested_additional_litres));
        if (ext.approved_additional_litres) {
          extAppLitresSum = extAppLitresSum.plus(d(ext.approved_additional_litres));
        }
        if (ext.status === 'APPROVED') extApproved++;
        else if (ext.status === 'REQUESTED') extPending++;
        else if (ext.status === 'REJECTED') extRejected++;
      }
    }

    const metrics: FilteredMetricsSummary = {
      beneficiaries: {
        total: totalCount,
        active: activeCount,
        inactive: inactiveCount,
      },
      land: {
        totalLandAcres: toDecimalString(totalLandSum, 4),
        totalHoldings: totalHoldingsCount,
        totalParcels: totalParcelsCount,
      },
      water: {
        totalRequiredLitres: toDecimalString(totalRequiredWater, 2),
        totalCalculatedLitres: toDecimalString(totalCalculatedWater, 2),
        totalApprovedLitres: toDecimalString(totalApprovedWater, 2),
      },
      financials: {
        totalDevelopmentCost: toDecimalString(totalDevCost, 2),
        totalAmountDue: toDecimalString(totalDevCost, 2),
        totalAmountPaid: toDecimalString(totalPaid, 2),
        totalPending: toDecimalString(totalPending, 2),
      },
      paymentBeneficiaries: {
        paid: paidBenCount,
        partiallyPaid: partiallyPaidBenCount,
        unpaid: unpaidBenCount,
        overdue: overdueBenCount,
      },
      installments: {
        total: totalInstCount,
        paid: paidInstCount,
        partiallyPaid: partialInstCount,
        pending: pendingInstCount,
        overdue: overdueInstCount,
        amountDue: toDecimalString(instDueSum, 2),
        amountPaid: toDecimalString(instPaidSum, 2),
        pendingBalance: toDecimalString(instPendingSum, 2),
      },
      infrastructure: {
        planned: infraPlanned,
        underConstruction: infraUnderConst,
        completed: infraCompleted,
        commissioned: infraCommissioned,
      },
      extensions: {
        totalRequests: extTotalRequests,
        pending: extPending,
        approved: extApproved,
        rejected: extRejected,
        additionalLitresRequested: toDecimalString(extReqLitresSum, 2),
        additionalLitresApproved: toDecimalString(extAppLitresSum, 2),
      },
    };

    // Paginate matching records
    const paginatedBeneficiaries = allMatchingBeneficiaries.slice(skip, skip + limit);
    const items = paginatedBeneficiaries.map((b) => this.transformBeneficiaryRecord(b));

    // Audit Log for FIND_FILTER_EXECUTED
    if (userId) {
      await this.auditService.log({
        userId,
        action: AuditAction.CREATE,
        entityType: 'FindFilterQuery',
        entityId: `QUERY-${Date.now()}`,
        newValues: {
          filterCriteria: dto,
          recordCount: totalCount,
          page,
          limit,
        },
        reason: `Administrator executed dynamic Find & Filter query matching ${totalCount} records`,
        ipAddress,
      }).catch((err) => {
        this.logger.warn(`Failed to write find query audit log: ${err.message}`);
      });
    }

    return {
      items,
      metrics,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  }

  /**
   * Generates authoritative server-side PDF report from the exact filtered population.
   */
  async generatePdfReport(
    dto: FindFilterDto,
    user: any,
    ipAddress?: string,
  ): Promise<{ buffer: Buffer; fileName: string; recordCount: number }> {
    const reportData = await this.executeFilterQuery(
      { ...dto, page: 1, limit: 250 }, // Up to 250 records for PDF export
      user.sub || user.userId,
      ipAddress,
    );

    const reportId = `REP-${Date.now().toString().slice(-6)}`;
    const generatedAt = new Date();
    const formattedDate = generatedAt.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      bufferPages: true,
      info: {
        Title: 'Water Management System — Filtered Beneficiary Report',
        Author: user.email || 'Chief Administrator',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));

    // Promise completion
    const pdfPromise = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // --- PDF DESIGN & STRUCTURE ---

    // 1. Header Banner
    doc.rect(30, 30, 782, 55).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('WATER MANAGEMENT SYSTEM', 45, 42);
    doc.fontSize(10).font('Helvetica').fillColor('#94a3b8').text('Official Filtered Beneficiary & Quota Audit Report', 45, 62);

    doc.fillColor('#38bdf8').fontSize(10).font('Helvetica-Bold').text(`Report ID: ${reportId}`, 620, 42, { align: 'right' });
    doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica').text(`Generated: ${generatedAt.toLocaleString('en-IN')}`, 620, 58, { align: 'right' });
    doc.text(`Generated By: ${user.email || 'Admin'}`, 620, 70, { align: 'right' });

    doc.moveDown(2);

    // 2. Applied Filters Summary Bar
    const filterTags: string[] = [];
    if (dto.districtId) filterTags.push(`District ID: ${dto.districtId.slice(0, 8)}`);
    if (dto.blockId) filterTags.push(`Block ID: ${dto.blockId.slice(0, 8)}`);
    if (dto.villageId) filterTags.push(`Village ID: ${dto.villageId.slice(0, 8)}`);
    if (dto.beneficiaryName) filterTags.push(`Name: "${dto.beneficiaryName}"`);
    if (dto.phoneNumber) filterTags.push(`Phone: "${dto.phoneNumber}"`);
    if (dto.paymentStatus) filterTags.push(`Payment: ${dto.paymentStatus}`);
    if (dto.infrastructureStatus) filterTags.push(`Infra: ${dto.infrastructureStatus}`);
    if (dto.applicationStatus) filterTags.push(`App Status: ${dto.applicationStatus}`);
    if (dto.landAreaMin || dto.landAreaMax) filterTags.push(`Land: ${dto.landAreaMin || 0} - ${dto.landAreaMax || 'max'} acres`);

    const filterText = filterTags.length > 0 ? filterTags.join(' • ') : 'All Records (No Filters Applied)';

    doc.rect(30, 95, 782, 22).fill('#f1f5f9');
    doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold').text('APPLIED FILTERS: ', 40, 102, { continued: true });
    doc.font('Helvetica').fillColor('#475569').text(filterText);

    // 3. Metric Summary Cards (2 rows of 4 cards)
    const m = reportData.metrics;
    const startY = 125;
    const cardWidth = 190;
    const cardHeight = 38;

    const cards = [
      { label: 'TOTAL BENEFICIARIES', val: `${m.beneficiaries.total} (Active: ${m.beneficiaries.active})`, color: '#0284c7' },
      { label: 'TOTAL REGISTERED LAND', val: `${m.land.totalLandAcres} Acres`, color: '#059669' },
      { label: 'REQUIRED WATER (L)', val: `${parseFloat(m.water.totalRequiredLitres).toLocaleString()} L`, color: '#6366f1' },
      { label: 'APPROVED WATER (L)', val: `${parseFloat(m.water.totalApprovedLitres).toLocaleString()} L`, color: '#7c3aed' },
      { label: 'TOTAL DEV COST (₹)', val: `₹${parseFloat(m.financials.totalDevelopmentCost).toLocaleString()}`, color: '#0f172a' },
      { label: 'TOTAL AMOUNT PAID (₹)', val: `₹${parseFloat(m.financials.totalAmountPaid).toLocaleString()}`, color: '#16a34a' },
      { label: 'TOTAL PENDING (₹)', val: `₹${parseFloat(m.financials.totalPending).toLocaleString()}`, color: '#dc2626' },
      { label: 'PAYMENT BREAKDOWN', val: `Paid: ${m.paymentBeneficiaries.paid} • Unpaid: ${m.paymentBeneficiaries.unpaid}`, color: '#d97706' },
    ];

    cards.forEach((card, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = 30 + col * (cardWidth + 7);
      const y = startY + row * (cardHeight + 6);

      doc.rect(x, y, cardWidth, cardHeight).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#64748b').fontSize(6.5).font('Helvetica-Bold').text(card.label, x + 8, y + 6);
      doc.fillColor(card.color).fontSize(10).font('Helvetica-Bold').text(card.val, x + 8, y + 18);
    });

    // 4. Data Table
    const tableTop = 215;
    doc.rect(30, tableTop, 782, 20).fill('#1e293b');

    const headers = [
      { label: '#', x: 35, width: 25 },
      { label: 'Beneficiary Name', x: 65, width: 110 },
      { label: 'Phone', x: 180, width: 75 },
      { label: 'Village / Block', x: 260, width: 115 },
      { label: 'Land (Acres)', x: 380, width: 65, align: 'right' },
      { label: 'Approved (L)', x: 450, width: 75, align: 'right' },
      { label: 'Dev Cost (₹)', x: 530, width: 75, align: 'right' },
      { label: 'Paid (₹)', x: 610, width: 65, align: 'right' },
      { label: 'Pending (₹)', x: 680, width: 65, align: 'right' },
      { label: 'Status', x: 750, width: 55, align: 'center' },
    ];

    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    headers.forEach((h) => {
      doc.text(h.label, h.x, tableTop + 6, { width: h.width, align: (h.align as any) || 'left' });
    });

    let currentY = tableTop + 20;
    const rowHeight = 18;

    reportData.items.forEach((item, index) => {
      // Check for page break
      if (currentY > 530) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });

        // Header on new page
        doc.rect(30, 30, 782, 20).fill('#1e293b');
        doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
        headers.forEach((h) => {
          doc.text(h.label, h.x, 36, { width: h.width, align: (h.align as any) || 'left' });
        });
        currentY = 50;
      }

      // Alternating row background
      if (index % 2 === 0) {
        doc.rect(30, currentY, 782, rowHeight).fill('#f8fafc');
      }

      doc.fillColor('#1e293b').fontSize(7).font('Helvetica');
      doc.text(String(index + 1), 35, currentY + 5, { width: 25 });
      doc.font('Helvetica-Bold').text(item.name, 65, currentY + 5, { width: 110 });
      doc.font('Helvetica').text(item.phoneNumber, 180, currentY + 5, { width: 75 });
      doc.text(`${item.villageName}, ${item.blockName}`, 260, currentY + 5, { width: 115 });
      doc.text(item.totalLandAcres, 380, currentY + 5, { width: 65, align: 'right' });
      doc.text(parseFloat(item.approvedLitres).toLocaleString(), 450, currentY + 5, { width: 75, align: 'right' });
      doc.text(`₹${parseFloat(item.developmentCost).toLocaleString()}`, 530, currentY + 5, { width: 75, align: 'right' });
      doc.fillColor('#16a34a').text(`₹${parseFloat(item.amountPaid).toLocaleString()}`, 610, currentY + 5, { width: 65, align: 'right' });
      doc.fillColor(item.pendingBalance !== '0.00' ? '#dc2626' : '#16a34a').text(`₹${parseFloat(item.pendingBalance).toLocaleString()}`, 680, currentY + 5, { width: 65, align: 'right' });

      // Status pill
      doc.fillColor(item.paymentStatus === 'PAID' ? '#16a34a' : item.paymentStatus === 'OVERDUE' ? '#dc2626' : '#d97706')
        .font('Helvetica-Bold')
        .text(item.paymentStatus, 750, currentY + 5, { width: 55, align: 'center' });

      currentY += rowHeight;
    });

    // 5. Footer & Page Numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.rect(30, 560, 782, 1).fill('#e2e8f0');
      doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
        .text(`Water Management System • Confidential & Proprietary Report • Page ${i + 1} of ${totalPages}`, 30, 568, { align: 'center', width: 782 });
    }

    doc.end();
    const pdfBuffer = await pdfPromise;

    // Audit Log
    const exportUserId = (user as any).user_id || (user as any).sub || (user as any).id || (user as any).userId || 'system';
    await this.auditService.log({
      userId: exportUserId,
      action: AuditAction.CREATE,
      entityType: 'ReportExport',
      entityId: reportId,
      newValues: {
        reportId,
        format: 'PDF',
        filters: dto,
        recordCount: reportData.meta.total,
        exportedCount: reportData.items.length,
      },
      reason: `User generated filtered PDF report containing ${reportData.meta.total} matching records`,
      ipAddress,
    });

    const sanitizedFileName = `water-management-report-${formattedDate.replace(/ /g, '-')}-${reportId}.pdf`;

    return {
      buffer: pdfBuffer,
      fileName: sanitizedFileName,
      recordCount: reportData.meta.total,
    };
  }

  async getFilterMetadata() {
    return {
      beneficiaryStatuses: Object.values(BeneficiaryStatus),
      landStatuses: Object.values(LandStatus),
      applicationStatuses: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'],
      approvalStatuses: ['APPROVED', 'REJECTED', 'CANCELLED'],
      billStatuses: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'],
      installmentStatuses: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED'],
      paymentStatuses: ['PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE'],
      paymentModes: ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'DD', 'ONLINE', 'OTHER'],
      infrastructureStatuses: ['PLANNED', 'UNDER_CONSTRUCTION', 'COMPLETED', 'COMMISSIONED'],
      extensionStatuses: ['REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'],
      dateTypes: Object.values(ReportingDateType),
    };
  }
}
