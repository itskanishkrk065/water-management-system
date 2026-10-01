import { apiClient } from './api';

export interface DeveloperSystemInfo {
  os: {
    platform: string;
    release: string;
    type: string;
    arch: string;
    hostname: string;
    uptimeFormatted: string;
  };
  hardware: {
    cpuModel: string;
    cpuCores: number;
    totalMemoryBytes: number;
    totalMemoryFormatted: string;
    freeMemoryBytes: number;
    freeMemoryFormatted: string;
    memoryUsagePct: number;
  };
  runtime: {
    nodeVersion: string;
    nestJsVersion: string;
    nextJsVersion: string;
    prismaVersion: string;
    sqliteVersion: string;
    electronVersion: string;
    v8Version: string;
  };
  process: {
    backendPid: number;
    backendPpid: number;
    backendUptime: string;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
  };
}

export interface DeveloperOverview {
  environment: string;
  isProduction: boolean;
  system: DeveloperSystemInfo;
  database: {
    tableCount: number;
    totalRecordCount: number;
    databaseSizeBytes: number;
    databaseSizeFormatted: string;
    journalMode: string;
    walStatus: string;
    integrityStatus: string;
  };
  storage: {
    appDataDirectory: string;
    storagePaths: Record<string, string>;
    sizes: Record<string, any>;
  };
  healthSummary: {
    overallStatus: 'PASS' | 'WARNING' | 'ERROR';
    activeDistricts: number;
    activeProjects: number;
    orphanFiles: number;
    detectedDuplicateGroups: number;
  };
}

export interface TableSummary {
  tableName: string;
  rowCount: number;
  primaryKey: string;
  columns: {
    cid: number;
    name: string;
    type: string;
    notnull: number;
    dflt_value: any;
    pk: number;
  }[];
  indexes: {
    name: string;
    unique: boolean;
    columns: string[];
  }[];
  foreignKeys: {
    id: number;
    table: string;
    from: string;
    to: string;
  }[];
  reverseRelations?: {
    fromTable: string;
    fromColumn: string;
    toColumn: string;
  }[];
}

export interface TableDataResponse {
  tableName: string;
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  columns: string[];
  primaryKey: string;
  records: Record<string, any>[];
}

export interface RecordDetailResponse {
  tableName: string;
  recordId: string;
  primaryKey: string;
  data: Record<string, any>;
  foreignKeys: {
    column: string;
    targetTable: string;
    targetColumn: string;
    targetValue: any;
  }[];
  relatedChildren: {
    table: string;
    foreignKeyColumn: string;
    records: any[];
    count: number;
  }[];
  auditHistory: any[];
}

export interface CleanStatePreview {
  mode: string;
  environment: string;
  isProductionLocked: boolean;
  databasePath: string;
  currentRecords: Record<string, number>;
  databaseSizeBytes: number;
  databaseSizeFormatted: string;
  willPreserve: string[];
  willRemove: string[];
  safetyBackupNote: string;
}

export interface DuplicateGroup {
  category: string;
  description: string;
  count: number;
  items: any[];
  recommendedAction: string;
}

export const DeveloperApi = {
  getOverview: async (): Promise<DeveloperOverview> => {
    const { data } = await apiClient.get('/developer/overview');
    return data;
  },

  getSystemInfo: async (): Promise<DeveloperSystemInfo> => {
    const { data } = await apiClient.get('/developer/system-info');
    return data;
  },

  getStorageCenter: async () => {
    const { data } = await apiClient.get('/developer/storage');
    return data;
  },

  getDatabaseTables: async (): Promise<{ tables: TableSummary[]; totalTables: number; totalRecords: number }> => {
    const { data } = await apiClient.get('/developer/database/tables');
    return data;
  },

  getTableData: async (
    tableName: string,
    params: { page?: number; limit?: number; search?: string; sortBy?: string; sortDir?: 'asc' | 'desc' }
  ): Promise<TableDataResponse> => {
    const { data } = await apiClient.get(`/developer/database/tables/${tableName}/data`, { params });
    return data;
  },

  getRecordDetail: async (tableName: string, id: string): Promise<RecordDetailResponse> => {
    const { data } = await apiClient.get(`/developer/database/tables/${tableName}/records/${id}`);
    return data;
  },

  executeSql: async (sql: string, includeExplain: boolean = false) => {
    const { data } = await apiClient.post('/developer/database/sql/execute', { sql, includeExplain });
    return data;
  },

  getDatabasePragmaStats: async () => {
    const { data } = await apiClient.get('/developer/database/pragma-stats');
    return data;
  },

  getCleanStatePreview: async (mode: string, selectedModules?: string[]): Promise<CleanStatePreview> => {
    const { data } = await apiClient.post('/developer/clean-state/preview', { mode, selectedModules });
    return data;
  },

  executeCleanState: async (mode: string, confirmationPhrase: string, reason?: string, selectedModules?: string[]) => {
    const { data } = await apiClient.post('/developer/clean-state/execute', {
      mode,
      confirmationPhrase,
      reason,
      selectedModules,
    });
    return data;
  },

  verifyCleanState: async () => {
    const { data } = await apiClient.get('/developer/clean-state/verify');
    return data;
  },

  getCleanStateAuditLogs: async () => {
    const { data } = await apiClient.get('/developer/clean-state/audit-logs');
    return data;
  },

  setEnvironment: async (environment: string, confirmationPhrase: string) => {
    const { data } = await apiClient.post('/developer/environment/set', { environment, confirmationPhrase });
    return data;
  },

  scanDuplicates: async (): Promise<{ detectedGroupCount: number; duplicateGroups: DuplicateGroup[] }> => {
    const { data } = await apiClient.get('/developer/diagnostics/duplicates');
    return data;
  },

  detectOrphans: async () => {
    const { data } = await apiClient.get('/developer/diagnostics/orphans');
    return data;
  },

  testRbac: async (payload: { role: string; permission: string; resource?: string; action?: string }) => {
    const { data } = await apiClient.post('/developer/diagnostics/rbac-tester', payload);
    return data;
  },

  exportDiagnosticBundle: async () => {
    const { data } = await apiClient.get('/developer/diagnostics/export-bundle');
    return data;
  },

  generateTestData: async (payload: {
    count: number;
    includeHoldings?: boolean;
    includeWaterApplications?: boolean;
    includeApprovedAllotments?: boolean;
    includeBillingAndPayments?: boolean;
  }) => {
    const { data } = await apiClient.post('/developer/test-data/generate', payload);
    return data;
  },

  purgeTestData: async (confirmationPhrase: string) => {
    const { data } = await apiClient.post('/developer/test-data/purge', { confirmationPhrase });
    return data;
  },

  getLogs: async (limit: number = 50): Promise<{
    auditLogs: Array<{
      id: string;
      action: string;
      tableName: string;
      recordId: string;
      timestamp: string;
      ipAddress: string;
      user: string;
      role: string;
      oldValues: any;
      newValues: any;
    }>;
    physicalLogs: Array<{
      timestamp: string;
      level: string;
      source: string;
      message: string;
    }>;
    totalAuditEntries: number;
    logsDirectory: string;
  }> => {
    const { data } = await apiClient.get('/developer/logs', { params: { limit } });
    return data;
  },
};
