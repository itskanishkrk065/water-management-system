import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoleName } from '../common/enums';

export interface GlobalSearchResultItem {
  id: string;
  category: 'BENEFICIARY' | 'LAND_HOLDING' | 'WATER_APPLICATION' | 'BILL' | 'PAYMENT' | 'PROJECT_SCHEME' | 'LOCATION';
  title: string;
  subtitle: string;
  badgeText?: string;
  badgeType?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  metadata?: Record<string, any>;
  link: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalResults: number;
  categories: {
    beneficiaries: GlobalSearchResultItem[];
    landHoldings: GlobalSearchResultItem[];
    waterApplications: GlobalSearchResultItem[];
    bills: GlobalSearchResultItem[];
    payments: GlobalSearchResultItem[];
    projectSchemes: GlobalSearchResultItem[];
    locations: GlobalSearchResultItem[];
  };
  resultsByCategory: {
    beneficiaries: GlobalSearchResultItem[];
    landHoldings: GlobalSearchResultItem[];
    waterApplications: GlobalSearchResultItem[];
    bills: GlobalSearchResultItem[];
    payments: GlobalSearchResultItem[];
    projectSchemes: GlobalSearchResultItem[];
    locations: GlobalSearchResultItem[];
  };
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async globalSearch(
    query: string,
    role: RoleName,
    limit: number = 8,
  ): Promise<GlobalSearchResponse> {
    const rawTerm = (query || '').trim();
    if (!rawTerm) {
      const emptyMap = {
        beneficiaries: [],
        landHoldings: [],
        waterApplications: [],
        bills: [],
        payments: [],
        projectSchemes: [],
        locations: [],
      };
      return {
        query: '',
        totalResults: 0,
        categories: emptyMap,
        resultsByCategory: emptyMap,
      };
    }

    const cleanDigits = rawTerm.replace(/[^0-9]/g, '');
    const isFinancialAllowed = role === RoleName.ADMIN || role === RoleName.ACCOUNTS || role === RoleName.VIEWER;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawTerm);

    // 1. Search Beneficiaries
    const benWhereOR: Prisma.BeneficiaryWhereInput[] = [
      { name: { contains: rawTerm } },
    ];
    if (cleanDigits.length >= 3) {
      benWhereOR.push({ phone_number: { contains: cleanDigits } });
    }
    if (rawTerm.includes('@')) {
      benWhereOR.push({ email: { contains: rawTerm } });
    }
    if (isUuid) {
      benWhereOR.push({ beneficiary_id: rawTerm });
    }

    const beneficiariesPromise = this.prisma.beneficiary.findMany({
      where: { OR: benWhereOR },
      take: limit,
      include: {
        district: true,
        village: true,
      },
    });

    // 2. Search Land Holdings & Parcels
    const landWhereOR: Prisma.LandHoldingWhereInput[] = [
      {
        parcels: {
          some: {
            OR: [
              { survey_number: { contains: rawTerm } },
              { subdivision_number: { contains: rawTerm } },
            ],
          },
        },
      },
    ];
    if (isUuid) {
      landWhereOR.push({ land_id: rawTerm });
    }

    const landHoldingsPromise = this.prisma.landHolding.findMany({
      where: { OR: landWhereOR },
      take: limit,
      include: {
        beneficiary: { select: { beneficiary_id: true, name: true, phone_number: true } },
        project: { select: { project_name: true, project_code: true } },
        parcels: true,
      },
    });

    // 3. Search Water Applications
    const appWhereOR: Prisma.WaterApplicationWhereInput[] = [
      { beneficiary: { name: { contains: rawTerm } } },
    ];
    if (cleanDigits.length >= 3) {
      appWhereOR.push({ beneficiary: { phone_number: { contains: cleanDigits } } });
    }
    if (isUuid) {
      appWhereOR.push({ application_id: rawTerm });
    }

    const waterApplicationsPromise = this.prisma.waterApplication.findMany({
      where: { OR: appWhereOR },
      take: limit,
      include: {
        beneficiary: { select: { beneficiary_id: true, name: true } },
        project: { select: { project_name: true } },
        allotment: true,
      },
    });

    // 4. Search Bills (Financial Role check)
    let billsPromise = Promise.resolve<any[]>([]);
    if (isFinancialAllowed) {
      const billWhereOR: Prisma.DevelopmentBillWhereInput[] = [
        { beneficiary: { name: { contains: rawTerm } } },
      ];
      if (cleanDigits.length >= 3) {
        billWhereOR.push({ beneficiary: { phone_number: { contains: cleanDigits } } });
      }
      if (isUuid) {
        billWhereOR.push({ bill_id: rawTerm });
      }

      billsPromise = this.prisma.developmentBill.findMany({
        where: { OR: billWhereOR },
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true } },
        },
      });
    }

    // 5. Search Payments (Financial Role check)
    let paymentsPromise = Promise.resolve<any[]>([]);
    if (isFinancialAllowed) {
      const paymentWhereOR: Prisma.PaymentWhereInput[] = [
        { receipt_number: { contains: rawTerm } },
        { payment_reference: { contains: rawTerm } },
        { beneficiary: { name: { contains: rawTerm } } },
      ];
      if (isUuid) {
        paymentWhereOR.push({ payment_id: rawTerm });
      }

      paymentsPromise = this.prisma.payment.findMany({
        where: { OR: paymentWhereOR },
        take: limit,
        include: {
          beneficiary: { select: { beneficiary_id: true, name: true } },
        },
      });
    }

    // 6. Search Project Schemes
    const projectWhereOR: Prisma.ProjectWhereInput[] = [
      { project_name: { contains: rawTerm } },
      { project_code: { contains: rawTerm } },
    ];
    if (isUuid) {
      projectWhereOR.push({ project_id: rawTerm });
    }

    const projectSchemesPromise = this.prisma.project.findMany({
      where: { OR: projectWhereOR },
      take: limit,
    });

    // 7. Search Locations (Villages, Panchayats, Districts)
    const villagesPromise = this.prisma.village.findMany({
      where: {
        name: { contains: rawTerm },
      },
      take: limit,
      include: {
        block: { include: { district: true } },
      },
    });

    const [
      bens,
      lands,
      apps,
      bills,
      payments,
      schemes,
      villages,
    ] = await Promise.all([
      beneficiariesPromise,
      landHoldingsPromise,
      waterApplicationsPromise,
      billsPromise,
      paymentsPromise,
      projectSchemesPromise,
      villagesPromise,
    ]);

    // Format Beneficiaries
    const formattedBeneficiaries: GlobalSearchResultItem[] = bens.map((b) => ({
      id: b.beneficiary_id,
      category: 'BENEFICIARY',
      title: b.name,
      subtitle: `Phone: ${b.phone_number} • Location: ${b.village?.name || 'Village'}, ${b.district?.name || 'District'}`,
      badgeText: b.status,
      badgeType: b.status === 'ACTIVE' ? 'success' : 'warning',
      link: `/admin/beneficiaries/${b.beneficiary_id}`,
    }));

    // Format Land Holdings
    const formattedLand: GlobalSearchResultItem[] = lands.map((l) => {
      const parcelsSummary = l.parcels.map((p) => `SF ${p.survey_number}/${p.subdivision_number}`).join(', ');
      return {
        id: l.land_id,
        category: 'LAND_HOLDING',
        title: `Holding #${l.land_id.slice(0, 8)} (${Number(l.declared_total_area).toFixed(2)} Acres)${parcelsSummary ? ' • ' + parcelsSummary : ''}`,
        subtitle: `Farmer: ${l.beneficiary?.name} • Scheme: ${l.project?.project_name} • ${parcelsSummary || 'No parcels'}`,
        badgeText: l.status,
        badgeType: l.status === 'ACTIVE' ? 'success' : 'warning',
        link: `/admin/beneficiaries/${l.beneficiary_id}?tab=land`,
      };
    });

    // Format Water Applications
    const formattedApps: GlobalSearchResultItem[] = apps.map((a) => ({
      id: a.application_id,
      category: 'WATER_APPLICATION',
      title: `Water App #${a.application_id.slice(0, 8)} • ${Number(a.required_litres).toLocaleString()} L`,
      subtitle: `Farmer: ${a.beneficiary?.name} • Scheme: ${a.project?.project_name || 'Project'} • Approved: ${a.allotment ? Number(a.allotment.approved_litres).toLocaleString() + ' L' : 'Pending'}`,
      badgeText: a.status,
      badgeType: a.status === 'APPROVED' ? 'success' : a.status === 'SUBMITTED' ? 'info' : 'warning',
      link: `/admin/beneficiaries/${a.beneficiary_id}?tab=water`,
    }));

    // Format Bills
    const formattedBills: GlobalSearchResultItem[] = bills.map((bill) => ({
      id: bill.bill_id,
      category: 'BILL',
      title: `Development Bill #${bill.bill_id.slice(0, 8)} • ₹${Number(bill.total_amount).toLocaleString()}`,
      subtitle: `Farmer: ${bill.beneficiary?.name} • Paid: ₹${Number(bill.amount_paid).toLocaleString()} • Pending: ₹${Number(bill.pending_amount).toLocaleString()}`,
      badgeText: bill.status,
      badgeType: bill.status === 'PAID' ? 'success' : bill.status === 'PARTIALLY_PAID' ? 'warning' : 'danger',
      link: `/admin/beneficiaries/${bill.beneficiary_id}?tab=billing`,
    }));

    // Format Payments
    const formattedPayments: GlobalSearchResultItem[] = payments.map((p) => ({
      id: p.payment_id,
      category: 'PAYMENT',
      title: `Receipt ${p.receipt_number} • ₹${Number(p.amount).toLocaleString()}`,
      subtitle: `Farmer: ${p.beneficiary?.name} • Mode: ${p.payment_mode} • Ref: ${p.payment_reference || 'N/A'} • ${new Date(p.payment_date).toLocaleDateString()}`,
      badgeText: p.is_reversal ? 'REVERSED' : p.status,
      badgeType: p.is_reversal ? 'danger' : 'success',
      link: `/admin/beneficiaries/${p.beneficiary_id}?tab=payments`,
    }));

    // Format Project Schemes
    const formattedSchemes: GlobalSearchResultItem[] = schemes.map((s) => ({
      id: s.project_id,
      category: 'PROJECT_SCHEME',
      title: `${s.project_name} (${s.project_code})`,
      subtitle: s.description || 'Active irrigation development project scheme',
      badgeText: s.status,
      badgeType: s.status === 'ACTIVE' ? 'success' : 'warning',
      link: `/admin/project-schemes`,
    }));

    // Format Locations
    const formattedLocations: GlobalSearchResultItem[] = villages.map((v) => ({
      id: v.village_id,
      category: 'LOCATION',
      title: `Village: ${v.name}`,
      subtitle: `Block: ${v.block?.name || 'Block'}, District: ${v.block?.district?.name || 'District'}`,
      badgeText: 'LOCATION',
      badgeType: 'default',
      link: `/admin/find?villageId=${v.village_id}`,
    }));

    const totalResults =
      formattedBeneficiaries.length +
      formattedLand.length +
      formattedApps.length +
      formattedBills.length +
      formattedPayments.length +
      formattedSchemes.length +
      formattedLocations.length;

    const categoryMap = {
      beneficiaries: formattedBeneficiaries,
      landHoldings: formattedLand,
      waterApplications: formattedApps,
      bills: formattedBills,
      payments: formattedPayments,
      projectSchemes: formattedSchemes,
      locations: formattedLocations,
    };

    return {
      query: rawTerm,
      totalResults,
      categories: categoryMap,
      resultsByCategory: categoryMap,
    };
  }
}
