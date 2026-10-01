import { getDatabase } from '../db/database';

export interface FinancialReportSummary {
  totalBilledAmount: number;
  totalCollectedAmount: number;
  totalPendingAmount: number;
  collectionRatePct: number;
  devBillsCount: number;
  runningBillsCount: number;
}

export interface WaterAllocationSummary {
  totalBeneficiaries: number;
  totalAllotments: number;
  totalApprovedLitres: number;
  totalLandAcres: number;
  avgLitresPerAcre: number;
}

export interface InfrastructureReportSummary {
  planned: number;
  underConstruction: number;
  completed: number;
  commissioned: number;
  total: number;
  commissionedRatePct: number;
}

export interface VillageLandCoverage {
  villageName: string;
  districtName: string;
  beneficiariesCount: number;
  totalAcres: number;
}

export class ReportRepository {
  /**
   * Financial & Collection Summary Report
   */
  async getFinancialSummary(): Promise<FinancialReportSummary> {
    const db = await getDatabase();

    const devResult = await db.getFirstAsync<{
      total_billed: number;
      total_paid: number;
      total_pending: number;
      count: number;
    }>(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as total_billed,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(pending_amount), 0) as total_pending,
        COUNT(*) as count
      FROM development_bills
      WHERE status != 'CANCELLED';
    `);

    const rbResult = await db.getFirstAsync<{
      total_due: number;
      total_paid: number;
      total_pending: number;
      count: number;
    }>(`
      SELECT 
        COALESCE(SUM(amount_due), 0) as total_due,
        COALESCE(SUM(amount_paid), 0) as total_paid,
        COALESCE(SUM(pending_amount), 0) as total_pending,
        COUNT(*) as count
      FROM running_bills
      WHERE status != 'CANCELLED';
    `);

    const totalBilled = (devResult?.total_billed || 0) + (rbResult?.total_due || 0);
    const totalCollected = (devResult?.total_paid || 0) + (rbResult?.total_paid || 0);
    const totalPending = (devResult?.total_pending || 0) + (rbResult?.total_pending || 0);
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;

    return {
      totalBilledAmount: totalBilled,
      totalCollectedAmount: totalCollected,
      totalPendingAmount: totalPending,
      collectionRatePct: collectionRate,
      devBillsCount: devResult?.count || 0,
      runningBillsCount: rbResult?.count || 0,
    };
  }

  /**
   * Water Quota & Allotment Summary Report
   */
  async getWaterSummary(): Promise<WaterAllocationSummary> {
    const db = await getDatabase();

    const benCount = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM beneficiaries WHERE status = "ACTIVE";'
    );

    const landResult = await db.getFirstAsync<{ total_acres: number }>(
      'SELECT COALESCE(SUM(declared_total_area), 0) as total_acres FROM land_holdings WHERE status = "ACTIVE";'
    );

    const allotmentResult = await db.getFirstAsync<{
      count: number;
      total_litres: number;
    }>(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(approved_litres), 0) as total_litres
      FROM water_allotments
      WHERE is_active = 1;
    `);

    const totalAcres = landResult?.total_acres || 0;
    const totalLitres = allotmentResult?.total_litres || 0;
    const avgLitres = totalAcres > 0 ? Math.round(totalLitres / totalAcres) : 0;

    return {
      totalBeneficiaries: benCount?.count || 0,
      totalAllotments: allotmentResult?.count || 0,
      totalApprovedLitres: totalLitres,
      totalLandAcres: totalAcres,
      avgLitresPerAcre: avgLitres,
    };
  }

  /**
   * Infrastructure Status Summary Report
   */
  async getInfrastructureSummary(): Promise<InfrastructureReportSummary> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ status: string; count: number }>(`
      SELECT status, COUNT(*) as count 
      FROM infrastructure 
      GROUP BY status;
    `);

    const summary: InfrastructureReportSummary = {
      planned: 0,
      underConstruction: 0,
      completed: 0,
      commissioned: 0,
      total: 0,
      commissionedRatePct: 0,
    };

    for (const r of rows) {
      if (r.status === 'PLANNED') summary.planned = r.count;
      else if (r.status === 'UNDER_CONSTRUCTION') summary.underConstruction = r.count;
      else if (r.status === 'COMPLETED') summary.completed = r.count;
      else if (r.status === 'COMMISSIONED') summary.commissioned = r.count;
      summary.total += r.count;
    }

    summary.commissionedRatePct =
      summary.total > 0 ? Math.round((summary.commissioned / summary.total) * 100) : 0;

    return summary;
  }

  /**
   * Village Land Coverage Breakdown
   */
  async getVillageLandCoverage(): Promise<VillageLandCoverage[]> {
    const db = await getDatabase();
    const sql = `
      SELECT 
        v.name as villageName,
        d.name as districtName,
        COUNT(DISTINCT b.beneficiary_id) as beneficiariesCount,
        COALESCE(SUM(b.total_land_acres), 0) as totalAcres
      FROM villages v
      JOIN districts d ON v.block_id IN (SELECT block_id FROM blocks WHERE district_id = d.district_id)
      LEFT JOIN beneficiaries b ON b.village_id = v.village_id AND b.status = 'ACTIVE'
      GROUP BY v.village_id
      ORDER BY totalAcres DESC;
    `;
    return await db.getAllAsync<VillageLandCoverage>(sql);
  }
}
