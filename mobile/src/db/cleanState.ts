import * as SQLite from 'expo-sqlite';
import { getDatabase, closeDatabase, initDatabase } from './database';
import { seedDatabase } from './seed';
import { CREATE_TABLES_SQL } from './schema';

export type CleanStateScope =
  | 'BENEFICIARIES_ONLY'
  | 'LAND_ONLY'
  | 'WATER_APPLICATIONS_ONLY'
  | 'FINANCIAL_ONLY'
  | 'SYNC_QUEUE_ONLY'
  | 'AUDIT_LOGS_ONLY'
  | 'FULL_DATABASE_RESET';

export interface CleanStateResult {
  success: boolean;
  scope: CleanStateScope;
  message: string;
  clearedCounts: Record<string, number>;
  timestamp: string;
}

/**
 * Executes a scoped clean state operation safely inside a transaction.
 */
export async function executeCleanState(
  scope: CleanStateScope,
  reSeedBaseline: boolean = true
): Promise<CleanStateResult> {
  const db = await getDatabase();
  const clearedCounts: Record<string, number> = {};

  if (scope === 'FULL_DATABASE_RESET') {
    // 1. Run full database drop & recreate
    await db.execAsync(`
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS installments;
      DROP TABLE IF EXISTS development_bills;
      DROP TABLE IF EXISTS water_allotments;
      DROP TABLE IF EXISTS water_applications;
      DROP TABLE IF EXISTS survey_parcels;
      DROP TABLE IF EXISTS land_holdings;
      DROP TABLE IF EXISTS beneficiaries;
      DROP TABLE IF EXISTS rate_tariffs;
      DROP TABLE IF EXISTS project_schemes;
      DROP TABLE IF EXISTS villages;
      DROP TABLE IF EXISTS blocks;
      DROP TABLE IF EXISTS districts;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS local_drafts;
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS local_audit_logs;
      PRAGMA foreign_keys = ON;
    `);

    // 2. Re-create tables
    await db.execAsync(CREATE_TABLES_SQL);

    // 3. Re-seed if requested
    if (reSeedBaseline) {
      await seedDatabase(db);
    }

    return {
      success: true,
      scope,
      message: 'Full database reset and schema recreation completed successfully.',
      clearedCounts: { all_tables: 1 },
      timestamp: new Date().toISOString(),
    };
  }

  // Scoped Clean State Operations
  await db.withTransactionAsync(async () => {
    if (scope === 'SYNC_QUEUE_ONLY') {
      const res = await db.runAsync('DELETE FROM sync_queue;');
      clearedCounts['sync_queue'] = res.changes;
    } else if (scope === 'AUDIT_LOGS_ONLY') {
      const res = await db.runAsync('DELETE FROM local_audit_logs;');
      clearedCounts['local_audit_logs'] = res.changes;
    } else if (scope === 'FINANCIAL_ONLY') {
      const pRes = await db.runAsync('DELETE FROM payments;');
      const iRes = await db.runAsync('DELETE FROM installments;');
      const bRes = await db.runAsync('DELETE FROM development_bills;');
      clearedCounts['payments'] = pRes.changes;
      clearedCounts['installments'] = iRes.changes;
      clearedCounts['development_bills'] = bRes.changes;
    } else if (scope === 'WATER_APPLICATIONS_ONLY') {
      const pRes = await db.runAsync('DELETE FROM payments;');
      const iRes = await db.runAsync('DELETE FROM installments;');
      const bRes = await db.runAsync('DELETE FROM development_bills;');
      const altRes = await db.runAsync('DELETE FROM water_allotments;');
      const appRes = await db.runAsync('DELETE FROM water_applications;');
      clearedCounts['payments'] = pRes.changes;
      clearedCounts['installments'] = iRes.changes;
      clearedCounts['development_bills'] = bRes.changes;
      clearedCounts['water_allotments'] = altRes.changes;
      clearedCounts['water_applications'] = appRes.changes;
    } else if (scope === 'LAND_ONLY') {
      const pRes = await db.runAsync('DELETE FROM payments;');
      const iRes = await db.runAsync('DELETE FROM installments;');
      const bRes = await db.runAsync('DELETE FROM development_bills;');
      const altRes = await db.runAsync('DELETE FROM water_allotments;');
      const appRes = await db.runAsync('DELETE FROM water_applications;');
      const pclRes = await db.runAsync('DELETE FROM survey_parcels;');
      const hldRes = await db.runAsync('DELETE FROM land_holdings;');
      clearedCounts['survey_parcels'] = pclRes.changes;
      clearedCounts['land_holdings'] = hldRes.changes;
      clearedCounts['water_applications'] = appRes.changes;
    } else if (scope === 'BENEFICIARIES_ONLY') {
      const pRes = await db.runAsync('DELETE FROM payments;');
      const iRes = await db.runAsync('DELETE FROM installments;');
      const bRes = await db.runAsync('DELETE FROM development_bills;');
      const altRes = await db.runAsync('DELETE FROM water_allotments;');
      const appRes = await db.runAsync('DELETE FROM water_applications;');
      const pclRes = await db.runAsync('DELETE FROM survey_parcels;');
      const hldRes = await db.runAsync('DELETE FROM land_holdings;');
      const benRes = await db.runAsync('DELETE FROM beneficiaries;');
      const drfRes = await db.runAsync('DELETE FROM local_drafts;');
      clearedCounts['beneficiaries'] = benRes.changes;
      clearedCounts['land_holdings'] = hldRes.changes;
      clearedCounts['survey_parcels'] = pclRes.changes;
      clearedCounts['water_applications'] = appRes.changes;
      clearedCounts['local_drafts'] = drfRes.changes;
    }
  });

  return {
    success: true,
    scope,
    message: `Scoped cleanup for ${scope} executed cleanly.`,
    clearedCounts,
    timestamp: new Date().toISOString(),
  };
}
