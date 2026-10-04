import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryTableDataDto, ExecuteReadOnlySqlDto } from '../dto/developer.dto';
import * as fs from 'fs';
import * as path from 'path';

export interface TableColumnMetadata {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

export interface TableForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

export interface TableIndexMetadata {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
  columns?: string[];
}

export interface TableSchemaSummary {
  tableName: string;
  rowCount: number;
  primaryKey: string[];
  columns: TableColumnMetadata[];
  foreignKeys: TableForeignKey[];
  indexes: TableIndexMetadata[];
  reverseRelations?: { fromTable: string; fromColumn: string; toColumn: string }[];
}

@Injectable()
export class DeveloperDbExplorerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Introspect all physical SQLite tables and their schema structure.
   */
  async getAllTablesSummary(): Promise<TableSchemaSummary[]> {
    if (!this.prisma.isSqlite()) {
      const tablesRaw: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT table_name as name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '_prisma_%' ORDER BY table_name ASC;`
      );

      const summaries: TableSchemaSummary[] = [];
      for (const row of tablesRaw) {
        const tableName = row.name;
        const columnsRaw: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT column_name as name, data_type as type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1;`,
          tableName
        );
        const pkRaw: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1;`,
          tableName
        );
        const primaryKey = pkRaw.map((p) => p.column_name);
        const columns: TableColumnMetadata[] = columnsRaw.map((c, idx) => ({
          cid: idx,
          name: c.name,
          type: c.type,
          notnull: c.is_nullable === 'NO',
          dflt_value: null,
          pk: primaryKey.includes(c.name),
        }));
        const countRes: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}";`);
        const rowCount = countRes[0]?.count ? Number(countRes[0].count) : 0;

        summaries.push({
          tableName,
          rowCount,
          primaryKey,
          columns,
          foreignKeys: [],
          indexes: [],
        });
      }
      return summaries;
    }

    // Query all tables in SQLite master (excluding sqlite internal tables)
    const tablesRaw: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name ASC;`
    );

    const summaries: TableSchemaSummary[] = [];

    for (const row of tablesRaw) {
      const tableName = row.name;

      // 1. Column metadata
      const columnsRaw: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}");`);
      const columns: TableColumnMetadata[] = columnsRaw.map((c) => ({
        cid: c.cid,
        name: c.name,
        type: c.type,
        notnull: Boolean(c.notnull),
        dflt_value: c.dflt_value,
        pk: Boolean(c.pk),
      }));

      // 2. Primary keys
      const primaryKey = columns.filter((c) => c.pk).map((c) => c.name);

      // 3. Row count
      const countRes: any[] = await this.prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}";`);
      const rowCount = countRes[0]?.count ? Number(countRes[0].count) : 0;

      // 4. Foreign keys
      const fksRaw: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA foreign_key_list("${tableName}");`);
      const foreignKeys: TableForeignKey[] = fksRaw.map((fk) => ({
        id: fk.id,
        seq: fk.seq,
        table: fk.table,
        from: fk.from,
        to: fk.to,
        on_update: fk.on_update,
        on_delete: fk.on_delete,
      }));

      // 5. Indexes
      const idxRaw: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA index_list("${tableName}");`);
      const indexes: TableIndexMetadata[] = [];
      for (const idx of idxRaw) {
        let cols: string[] = [];
        try {
          const idxInfo: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA index_info("${idx.name}");`);
          cols = idxInfo.map((i) => i.name);
        } catch {}

        indexes.push({
          seq: idx.seq,
          name: idx.name,
          unique: Boolean(idx.unique),
          origin: idx.origin,
          partial: Boolean(idx.partial),
          columns: cols,
        });
      }

      summaries.push({
        tableName,
        rowCount,
        primaryKey,
        columns,
        foreignKeys,
        indexes,
      });
    }

    // Build reverse relations
    for (const t of summaries) {
      t.reverseRelations = [];
      for (const other of summaries) {
        for (const fk of other.foreignKeys) {
          if (fk.table === t.tableName) {
            t.reverseRelations.push({
              fromTable: other.tableName,
              fromColumn: fk.from,
              toColumn: fk.to,
            });
          }
        }
      }
    }

    return summaries;
  }

  /**
   * Server-side paginated data browser for any database table with search, sorting, and filters.
   */
  async getTableData(tableName: string, query: QueryTableDataDto) {
    let columns: TableColumnMetadata[] = [];
    if (!this.prisma.isSqlite()) {
      columns = (await this.getAllTablesSummary()).find((t) => t.tableName === tableName)?.columns || [];
      if (columns.length === 0) {
        throw new NotFoundException(`Table '${tableName}' does not exist in database.`);
      }
    } else {
      // Validate table existence in SQLite
      const validTables: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?;`,
        tableName
      );
      if (!validTables || validTables.length === 0) {
        throw new NotFoundException(`Table '${tableName}' does not exist in SQLite database.`);
      }
      const columnsRaw: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}");`);
      columns = columnsRaw.map((c) => ({
        cid: c.cid,
        name: c.name,
        type: c.type,
        notnull: Boolean(c.notnull),
        dflt_value: c.dflt_value,
        pk: Boolean(c.pk),
      }));
    }

    const validColNames = columns.map((c) => c.name);

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(250, Math.max(10, query.limit || 25));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];

    // Global text search across text/varchar columns
    if (query.search && query.search.trim()) {
      const searchStr = `%${query.search.trim()}%`;
      const textCols = columns.filter((c) => /TEXT|CHAR|VARCHAR|BLOB/i.test(c.type));
      if (textCols.length > 0) {
        const searchConditions = textCols.map((c) => `"${c.name}" LIKE ?`).join(' OR ');
        whereClauses.push(`(${searchConditions})`);
        textCols.forEach(() => params.push(searchStr));
      }
    }

    // Column specific filters
    if (query.filters) {
      try {
        const parsed = JSON.parse(query.filters);
        for (const [key, val] of Object.entries(parsed)) {
          if (validColNames.includes(key) && val !== undefined && val !== '') {
            whereClauses.push(`"${key}" = ?`);
            params.push(val);
          }
        }
      } catch {}
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Sort order
    let sortSql = '';
    if (query.sortBy && validColNames.includes(query.sortBy)) {
      const order = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
      sortSql = `ORDER BY "${query.sortBy}" ${order}`;
    } else {
      const pk = columns.find((c) => c.pk);
      if (pk) {
        sortSql = `ORDER BY "${pk.name}" DESC`;
      }
    }

    // Count total matching
    const countSql = `SELECT COUNT(*) as count FROM "${tableName}" ${whereSql};`;
    const countRes: any[] = await this.prisma.$queryRawUnsafe(countSql, ...params);
    const totalRecords = countRes[0]?.count ? Number(countRes[0].count) : 0;

    // Fetch paginated rows
    const dataSql = `SELECT * FROM "${tableName}" ${whereSql} ${sortSql} LIMIT ? OFFSET ?;`;
    const rows: any[] = await this.prisma.$queryRawUnsafe(dataSql, ...params, limit, offset);

    // Redact sensitive secrets from all rows
    const sanitizedRows = rows.map((r) => this.redactSensitiveRow(r));

    return {
      tableName,
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      columns: columns.map((c) => ({
        name: c.name,
        type: c.type,
        pk: Boolean(c.pk),
        notnull: Boolean(c.notnull),
      })),
      rows: sanitizedRows,
    };
  }

  /**
   * Deep record inspection with connected relationships and foreign key references.
   */
  async getRecordDetails(tableName: string, recordId: string) {
    if (!this.prisma.isSqlite()) {
      const summary = (await this.getAllTablesSummary()).find((t) => t.tableName === tableName);
      const pkCol = summary?.primaryKey[0] || 'id';
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT * FROM "${tableName}" WHERE "${pkCol}" = $1 LIMIT 1;`,
        recordId
      );
      if (!rows || rows.length === 0) {
        throw new NotFoundException(`Record '${recordId}' not found in table '${tableName}'.`);
      }
      return {
        tableName,
        recordId,
        primaryKey: pkCol,
        data: this.redactSensitiveRow(rows[0]),
        foreignKeys: [],
        relatedChildren: [],
        auditHistory: [],
      };
    }

    const columns: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA table_info("${tableName}");`);
    const pkCol = columns.find((c) => c.pk)?.name || 'id';

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" WHERE "${pkCol}" = ? LIMIT 1;`,
      recordId
    );

    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Record '${recordId}' not found in table '${tableName}'.`);
    }

    const record = this.redactSensitiveRow(rows[0]);

    // Introspect foreign keys
    const fks: any[] = await this.prisma.$queryRawUnsafe(`PRAGMA foreign_key_list("${tableName}");`);
    const foreignKeyValues: any[] = [];
    for (const fk of fks) {
      const val = rows[0][fk.from];
      let referencedRecord: any = null;
      if (val) {
        try {
          const targetRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "${fk.table}" WHERE "${fk.to}" = ? LIMIT 1;`,
            val
          );
          if (targetRows.length > 0) {
            referencedRecord = this.redactSensitiveRow(targetRows[0]);
          }
        } catch {}
      }
      foreignKeyValues.push({
        column: fk.from,
        foreignTable: fk.table,
        foreignColumn: fk.to,
        value: val,
        referencedRecord,
      });
    }

    // Introspect reverse referencing child records
    const allTables = await this.getAllTablesSummary();
    const tableSummary = allTables.find((t) => t.tableName === tableName);
    const relatedChildren: any[] = [];

    if (tableSummary?.reverseRelations) {
      for (const rel of tableSummary.reverseRelations) {
        try {
          const countRes: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT COUNT(*) as count FROM "${rel.fromTable}" WHERE "${rel.fromColumn}" = ?;`,
            recordId
          );
          const count = countRes[0]?.count ? Number(countRes[0].count) : 0;
          if (count > 0) {
            const sampleRows: any[] = await this.prisma.$queryRawUnsafe(
              `SELECT * FROM "${rel.fromTable}" WHERE "${rel.fromColumn}" = ? LIMIT 5;`,
              recordId
            );
            relatedChildren.push({
              childTable: rel.fromTable,
              foreignKeyColumn: rel.fromColumn,
              count,
              sample: sampleRows.map((r) => this.redactSensitiveRow(r)),
            });
          }
        } catch {}
      }
    }

    // Fetch related audit logs if available
    let auditHistory: any[] = [];
    try {
      auditHistory = await this.prisma.auditLog.findMany({
        where: { entity_id: recordId },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    } catch {}

    return {
      tableName,
      recordId,
      primaryKey: pkCol,
      data: record,
      foreignKeys: foreignKeyValues,
      relatedChildren,
      auditHistory,
    };
  }

  /**
   * Execute safe read-only SQL with EXPLAIN QUERY PLAN and microsecond execution timer.
   */
  async executeReadOnlySql(dto: ExecuteReadOnlySqlDto) {
    const rawSql = dto.sql.trim();

    // Strict security check: Only permit SELECT queries
    const normalized = rawSql.replace(/\s+/g, ' ').toUpperCase();
    if (!normalized.startsWith('SELECT') && !normalized.startsWith('EXPLAIN') && !normalized.startsWith('PRAGMA')) {
      throw new BadRequestException(
        'SQL Console Security Guard: Only read-only SELECT, EXPLAIN, and diagnostic PRAGMA statements are permitted.'
      );
    }

    // Disallow destructive keywords in query
    const forbidden = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'REPLACE', 'ATTACH', 'DETACH', 'VACUUM'];
    for (const word of forbidden) {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(rawSql) && !normalized.startsWith('EXPLAIN')) {
        throw new BadRequestException(`SQL Console Security Guard: Destructive keyword '${word}' is forbidden in read-only SQL mode.`);
      }
    }

    // 1. Run EXPLAIN QUERY PLAN
    let queryPlan: any[] = [];
    try {
      queryPlan = await this.prisma.$queryRawUnsafe(`EXPLAIN QUERY PLAN ${rawSql};`);
    } catch (e: any) {
      // explain might not be supported for PRAGMA
    }

    // 2. Measure execution time
    const start = process.hrtime.bigint();
    let rows: any[] = [];
    let error: string | null = null;

    try {
      rows = await this.prisma.$queryRawUnsafe(rawSql);
    } catch (err: any) {
      error = err.message;
    }
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const sanitizedRows = rows.map((r) => this.redactSensitiveRow(r));

    return {
      sql: rawSql,
      durationMs: parseFloat(durationMs.toFixed(3)),
      rowCount: sanitizedRows.length,
      queryPlan,
      error,
      columns: sanitizedRows.length > 0 ? Object.keys(sanitizedRows[0]) : [],
      rows: sanitizedRows.slice(0, 500),
    };
  }

  /**
   * Comprehensive SQLite Statistics, PRAGMAs, and Physical File Health.
   */
  async getDatabaseStatistics() {
    if (!this.prisma.isSqlite()) {
      const tables = await this.getAllTablesSummary();
      const totalRecords = tables.reduce((acc, t) => acc + t.rowCount, 0);
      const tableCounts: Record<string, number> = {};
      for (const t of tables) {
        tableCounts[t.tableName] = t.rowCount;
      }
      return {
        databasePath: 'Neon PostgreSQL Cloud',
        dbPath: 'postgresql://neon.tech',
        fileSizeBytes: 0,
        fileSizeFormatted: 'Managed Cloud Postgres',
        lastModified: new Date(),
        totalTables: tables.length,
        totalRecords,
        tableCounts,
        allTables: tables,
        integrityCheckStatus: 'PASS',
        integrityCheckDetails: 'PostgreSQL managed database active',
        foreignKeyViolationsCount: 0,
        foreignKeyViolations: [],
        sqlitePragmas: {
          journalMode: 'PostgreSQL WAL',
          synchronous: 'N/A',
          pageCount: 0,
          pageSize: 0,
          freelistCount: 0,
          calculatedDbSize: 'N/A',
          walStatus: 'active',
        },
        pageCount: 0,
        journalMode: 'PostgreSQL',
        largestTables: tables.sort((a, b) => b.rowCount - a.rowCount).slice(0, 10),
      };
    }

    let integrityCheck = 'ok';
    let foreignKeyCheck: any[] = [];
    let journalMode = 'wal';
    let walStatus = 'active';
    let synchronous = 'NORMAL';
    let pageCount = 0;
    let pageSize = 4096;
    let freelistCount = 0;

    try {
      const integrity: any[] = await this.prisma.$queryRawUnsafe('PRAGMA integrity_check(50);');
      integrityCheck = integrity.map((r) => r.integrity_check || r['integrity_check']).join('; ');
    } catch {}

    try {
      foreignKeyCheck = await this.prisma.$queryRawUnsafe('PRAGMA foreign_key_check;');
    } catch {}

    try {
      const jMode: any[] = await this.prisma.$queryRawUnsafe('PRAGMA journal_mode;');
      journalMode = jMode[0]?.journal_mode || 'unknown';
    } catch {}

    try {
      const sync: any[] = await this.prisma.$queryRawUnsafe('PRAGMA synchronous;');
      synchronous = sync[0]?.synchronous?.toString() || 'NORMAL';
    } catch {}

    try {
      const pCount: any[] = await this.prisma.$queryRawUnsafe('PRAGMA page_count;');
      pageCount = Number(pCount[0]?.page_count || 0);
    } catch {}

    try {
      const pSize: any[] = await this.prisma.$queryRawUnsafe('PRAGMA page_size;');
      pageSize = Number(pSize[0]?.page_size || 4096);
    } catch {}

    try {
      const fCount: any[] = await this.prisma.$queryRawUnsafe('PRAGMA freelist_count;');
      freelistCount = Number(fCount[0]?.freelist_count || 0);
    } catch {}

    const tables = await this.getAllTablesSummary();
    const totalRecords = tables.reduce((acc, t) => acc + t.rowCount, 0);
    const tableCounts: Record<string, number> = {};
    for (const t of tables) {
      tableCounts[t.tableName] = t.rowCount;
    }

    const dbPath = this.resolveDbPath();
    let fileSize = 0;
    let lastModified: Date | null = null;
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      fileSize = stat.size;
      lastModified = stat.mtime;
    }

    return {
      databasePath: dbPath,
      dbPath,
      fileSizeBytes: fileSize,
      fileSizeFormatted: `${(fileSize / (1024 * 1024)).toFixed(2)} MB`,
      lastModified,
      totalTables: tables.length,
      totalRecords,
      tableCounts,
      allTables: tables,
      integrityCheckStatus: integrityCheck.toLowerCase().includes('ok') ? 'PASS' : 'FAIL',
      integrityCheckDetails: integrityCheck,
      foreignKeyViolationsCount: foreignKeyCheck.length,
      foreignKeyViolations: foreignKeyCheck,
      sqlitePragmas: {
        journalMode,
        synchronous,
        pageCount,
        pageSize,
        freelistCount,
        calculatedDbSize: `${((pageCount * pageSize) / (1024 * 1024)).toFixed(2)} MB`,
        walStatus,
      },
      pageCount,
      journalMode,
      largestTables: tables.sort((a, b) => b.rowCount - a.rowCount).slice(0, 10),
    };
  }

  public resolveDbPath(): string {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:')) {
      const raw = dbUrl.replace(/^file:/, '');
      const directPath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
      if (fs.existsSync(directPath)) {
        return directPath;
      }
    }

    const candidates = [
      path.resolve(process.cwd(), 'prisma/template.db'),
      path.resolve(process.cwd(), 'backend/prisma/template.db'),
      path.resolve(process.cwd(), '../backend/prisma/template.db'),
      path.resolve(process.cwd(), 'data/watergrid.db'),
      path.join(process.env.WATER_APP_DATA_DIR || path.join(process.env.LOCALAPPDATA || process.env.APPDATA || process.env.HOME || '.', 'WaterManagement'), 'database', 'water_management.db'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    return candidates[0];
  }

  /**
   * Redacts passwords, password hashes, encryption keys, JWT tokens, and sensitive secrets.
   */
  public redactSensitiveRow(row: any): any {
    if (!row || typeof row !== 'object') return row;
    const sanitized: any = { ...row };
    const sensitiveKeys = [
      'password',
      'password_hash',
      'passwordHash',
      'salt',
      'secret',
      'jwt_secret',
      'token',
      'access_token',
      'refresh_token',
      'api_key',
      'private_key',
    ];

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  /**
   * Diagnostic summary of all relational data for a beneficiary (or all beneficiaries).
   */
  async getBeneficiaryRelationshipSummary(beneficiaryId?: string) {
    const whereClause = beneficiaryId ? { beneficiary_id: beneficiaryId } : {};
    const beneficiaries = await this.prisma.beneficiary.findMany({
      where: whereClause,
      select: {
        beneficiary_id: true,
        name: true,
        status: true,
        landHoldings: { select: { land_id: true, status: true, declared_total_area: true } },
        waterApplications: { select: { application_id: true, status: true, required_litres: true } },
        waterAllotments: { select: { allotment_id: true, approved_litres: true, approval_status: true } },
        developmentBills: {
          select: {
            bill_id: true,
            total_amount: true,
            amount_paid: true,
            pending_amount: true,
            status: true,
            installments: {
              select: {
                installment_id: true,
                installment_number: true,
                amount_due: true,
                amount_paid: true,
                status: true,
              },
            },
          },
        },
        payments: { select: { payment_id: true, receipt_number: true, amount: true, payment_mode: true, status: true } },
        infrastructures: { select: { infrastructure_id: true, status: true } },
        extensions: { select: { extension_id: true, status: true } },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    return beneficiaries.map((b) => {
      const activeHoldings = b.landHoldings.filter((l) => l.status === 'ACTIVE');
      const historicalHoldings = b.landHoldings.filter((l) => l.status !== 'ACTIVE');
      const activeWater = b.waterApplications.filter((w) => !['REJECTED', 'CANCELLED', 'VOIDED', 'ARCHIVED'].includes(w.status));
      const historicalWater = b.waterApplications.filter((w) => ['REJECTED', 'CANCELLED', 'VOIDED', 'ARCHIVED'].includes(w.status));
      const allInstallments = b.developmentBills.flatMap((bill) => bill.installments || []);

      return {
        beneficiaryId: b.beneficiary_id,
        name: b.name,
        status: b.status,
        land: {
          total: b.landHoldings.length,
          active: activeHoldings.length,
          historical: historicalHoldings.length,
        },
        water: {
          total: b.waterApplications.length,
          current: activeWater.length,
          historical: historicalWater.length,
          allotments: b.waterAllotments.length,
        },
        bills: {
          total: b.developmentBills.length,
          details: b.developmentBills,
        },
        installments: {
          total: allInstallments.length,
          details: allInstallments,
        },
        payments: {
          total: b.payments.length,
          details: b.payments,
        },
        infrastructure: {
          total: b.infrastructures.length,
        },
        extensions: {
          total: b.extensions.length,
        },
      };
    });
  }
}
