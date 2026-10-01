import { getDatabase } from '../db/database';

export interface TableStats {
  tableName: string;
  rowCount: number;
}

export interface DatabaseDiagnostics {
  status: 'HEALTHY' | 'DEGRADED' | 'ERROR';
  sqliteVersion: string;
  integrityCheck: string;
  totalTables: number;
  tableStats: TableStats[];
  databaseSizeEstimateKB: number;
  lastDiagnosticCheck: string;
}

export class DiagnosticsService {
  /**
   * Run full local diagnostics on the mobile database
   */
  async runDiagnostics(): Promise<DatabaseDiagnostics> {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // 1. Get SQLite version
    const versionRes = await db.getFirstAsync<{ version: string }>(
      'SELECT sqlite_version() as version;'
    );
    const sqliteVersion = versionRes?.version || 'Unknown';

    // 2. Run PRAGMA integrity_check
    const integrityRes = await db.getFirstAsync<{ integrity_check: string }>(
      'PRAGMA integrity_check;'
    );
    const integrityCheck = integrityRes?.integrity_check || 'ok';

    // 3. Get all user tables
    const tables = await db.getAllAsync<{ name: string }>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%' 
      ORDER BY name ASC;
    `);

    // 4. Count rows in each table
    const tableStats: TableStats[] = [];
    let totalRows = 0;

    for (const t of tables) {
      const countRes = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${t.name};`
      );
      const rowCount = countRes?.count || 0;
      tableStats.push({
        tableName: t.name,
        rowCount,
      });
      totalRows += rowCount;
    }

    // Estimate DB size (rough estimate based on total rows * page size)
    const pageCountRes = await db.getFirstAsync<{ page_count: number }>('PRAGMA page_count;');
    const pageSizeRes = await db.getFirstAsync<{ page_size: number }>('PRAGMA page_size;');
    const pageCount = pageCountRes?.page_count || 0;
    const pageSize = pageSizeRes?.page_size || 4096;
    const sizeKB = Math.round((pageCount * pageSize) / 1024);

    return {
      status: integrityCheck === 'ok' ? 'HEALTHY' : 'DEGRADED',
      sqliteVersion,
      integrityCheck,
      totalTables: tables.length,
      tableStats,
      databaseSizeEstimateKB: sizeKB,
      lastDiagnosticCheck: now,
    };
  }

  /**
   * Fetch table data for Developer Inspector
   */
  async inspectTable(tableName: string, limit: number = 25): Promise<any[]> {
    const db = await getDatabase();
    // Sanitize table name against sqlite_master
    const isValid = await db.getFirstAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = ?;",
      [tableName]
    );

    if (!isValid) {
      throw new Error(`Invalid table name: ${tableName}`);
    }

    return await db.getAllAsync(`SELECT * FROM ${tableName} ORDER BY 1 DESC LIMIT ?;`, [limit]);
  }
}
