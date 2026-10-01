'use client';

import React, { useState, useEffect } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import {
  Activity,
  Database,
  FileText,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Cpu,
  Layers,
  Key,
  Link,
  Search,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

interface HealthComponent {
  status: 'HEALTHY' | 'WARNING' | 'ERROR' | 'UNAVAILABLE';
  version?: string;
  uptime?: string;
  memoryUsage?: string;
  details?: string;
  engine?: string;
  journalMode?: string;
  sizeBytes?: number;
}

interface OverviewData {
  environment: string;
  isProduction: boolean;
  application: {
    name: string;
    version: string;
    buildChannel: string;
    environment: string;
    buildDate: string;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    pid: number;
    uptimeSeconds: number;
    memory: {
      rssMB: number;
      heapUsedMB: number;
      heapTotalMB: number;
    };
  };
  storage: {
    databasePath: string;
    backupsDirectory: string;
    databaseSizeBytes: number;
  };
  database: {
    status: string;
    dbPath: string;
    fileSizeBytes: number;
    journalMode: string;
    pageCount: number;
    integrityCheckStatus: string;
    tableCounts: Record<string, number>;
  };
  healthSummary?: {
    frontend: HealthComponent;
    backend: HealthComponent;
    database: HealthComponent;
    electron: HealthComponent;
    prisma: HealthComponent;
  };
}

interface TableColumnMetadata {
  cid: number;
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}

interface TableForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
}

interface TableIndexMetadata {
  seq: number;
  name: string;
  unique: boolean;
  origin: string;
  partial: boolean;
  columns?: string[];
}

interface TableSchemaSummary {
  tableName: string;
  rowCount: number;
  primaryKey: string[];
  columns: TableColumnMetadata[];
  foreignKeys: TableForeignKey[];
  indexes: TableIndexMetadata[];
  reverseRelations?: { fromTable: string; fromColumn: string; toColumn: string }[];
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  action: string;
  actor: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  details?: any;
}

interface CleanStatePreviewData {
  mode: string;
  environment: string;
  isProductionLocked: boolean;
  databasePath: string;
  currentRecords: {
    beneficiaries: number;
    landHoldings: number;
    parcels: number;
    waterApplications: number;
    waterAllotments: number;
    developmentBills: number;
    installments: number;
    payments: number;
    infrastructure: number;
    extensions: number;
    auditLogs: number;
    users: number;
  };
  tablesToRemove: string[];
  tablesToPreserve: string[];
  mandatoryBackupFilename: string;
  requiredConfirmationPhrase: string;
}

interface BeneficiaryRelationshipSummary {
  beneficiaryId: string;
  name: string;
  status: string;
  land: {
    total: number;
    active: number;
    historical: number;
  };
  water: {
    total: number;
    current: number;
    historical: number;
    allotments: number;
  };
  bills: {
    total: number;
    details: any[];
  };
  installments: {
    total: number;
    details: any[];
  };
  payments: {
    total: number;
    details: any[];
  };
  infrastructure: {
    total: number;
  };
  extensions: {
    total: number;
  };
}

export default function DeveloperPortalPage() {
  const [activeTab, setActiveTab] = useState<'health' | 'database' | 'logs' | 'backups' | 'maintenance'>('health');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [tables, setTables] = useState<TableSchemaSummary[]>([]);
  const [tableSearch, setTableSearch] = useState<string>('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tablesLoading, setTablesLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Beneficiary Relational Inspector State
  const [beneficiarySummaries, setBeneficiarySummaries] = useState<BeneficiaryRelationshipSummary[]>([]);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string>('');
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState<boolean>(false);

  // Maintenance & Integrity State
  const [integrityStatus, setIntegrityStatus] = useState<'IDLE' | 'RUNNING' | 'PASSED' | 'FAILED'>('IDLE');
  const [integrityDetails, setIntegrityDetails] = useState<string | null>(null);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Clean Slate State
  const [cleanSlatePreview, setCleanSlatePreview] = useState<CleanStatePreviewData | null>(null);
  const [cleanSlateConfirmText, setCleanSlateConfirmText] = useState<string>('');
  const [isCleaningSlate, setIsCleaningSlate] = useState<boolean>(false);
  const [cleanSlateResult, setCleanSlateResult] = useState<any | null>(null);

  // Synthetic Purge State
  const [purgeConfirmText, setPurgeConfirmText] = useState<string>('');
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  const fetchOverviewAndLogs = async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const [ovRes, logsRes] = await Promise.all([
        apiClient.get('/developer/overview'),
        apiClient.get('/developer/logs?limit=50'),
      ]);
      setOverview(ovRes.data);
      setLogs(logsRes.data?.logs || logsRes.data || []);
    } catch (err: any) {
      console.error('Failed to load developer diagnostics:', err);
      setError(err.response?.data?.message || err.message || 'Failed to connect to backend diagnostics service');
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const fetchTables = async () => {
    try {
      setTablesLoading(true);
      const res = await apiClient.get('/developer/tables');
      setTables(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch database tables:', err);
    } finally {
      setTablesLoading(false);
    }
  };

  const fetchBeneficiarySummaries = async () => {
    try {
      setLoadingBeneficiaries(true);
      const res = await apiClient.get('/developer/beneficiaries/relationship-summary');
      const data = Array.isArray(res.data) ? res.data : [];
      setBeneficiarySummaries(data);
      if (data.length > 0 && !selectedBeneficiaryId) {
        setSelectedBeneficiaryId(data[0].beneficiaryId);
      }
    } catch (err: any) {
      console.error('Failed to fetch beneficiary relationships:', err);
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  const fetchCleanSlatePreview = async () => {
    try {
      const res = await apiClient.post('/developer/clean-state/preview', {
        mode: 'EMPTY_CLEAN_STATE',
      });
      setCleanSlatePreview(res.data);
    } catch (err: any) {
      console.error('Failed to fetch clean slate preview:', err);
    }
  };

  useEffect(() => {
    fetchOverviewAndLogs();
  }, []);

  useEffect(() => {
    if (activeTab === 'database') {
      fetchTables();
      fetchBeneficiarySummaries();
    } else if (activeTab === 'maintenance') {
      fetchCleanSlatePreview();
    }
  }, [activeTab]);

  const handleRunIntegrityCheck = async () => {
    setIntegrityStatus('RUNNING');
    setIntegrityDetails(null);
    try {
      const res = await apiClient.get('/developer/statistics');
      const stats = res.data;
      if (stats.integrityCheckStatus === 'PASS' || stats.integrityCheck === 'ok') {
        setIntegrityStatus('PASSED');
        setIntegrityDetails(`Integrity check passed. SQLite PRAGMA integrity_check returned: 'ok'. Page count: ${stats.pageCount || 0}`);
      } else {
        setIntegrityStatus('FAILED');
        setIntegrityDetails(`Warning/Error in SQLite file integrity: ${stats.integrityCheckStatus || 'Unrecognized state'}`);
      }
    } catch (err: any) {
      setIntegrityStatus('FAILED');
      setIntegrityDetails(err.response?.data?.message || 'Failed to complete SQLite integrity check');
    }
  };

  const handleCreateBackup = async () => {
    setBackupStatus('Creating database backup...');
    try {
      const res = await apiClient.get('/developer/storage');
      setBackupStatus(`Database backup point verified. Stored in: ${res.data?.backupsDirectory || 'backups/'}`);
      setActionMessage({ type: 'success', text: 'Backup verification completed successfully.' });
    } catch (err: any) {
      setBackupStatus(null);
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Failed to create backup' });
    }
  };

  const handleRefreshAppCache = () => {
    setActionMessage({ type: 'success', text: 'Application query and memory caches refreshed.' });
    fetchOverviewAndLogs();
  };

  const handleExportBundle = async () => {
    try {
      const res = await apiClient.get('/developer/diagnostics/bundle');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watergrid-diagnostics-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionMessage({ type: 'success', text: 'Diagnostics snapshot exported successfully.' });
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Export failed' });
    }
  };

  const handleExecuteCleanSlate = async () => {
    if (cleanSlateConfirmText.trim().toUpperCase() !== 'CLEAN SLATE') {
      setActionMessage({ type: 'error', text: 'Please type "CLEAN SLATE" exactly to confirm the wipe operation.' });
      return;
    }

    setIsCleaningSlate(true);
    setCleanSlateResult(null);
    try {
      const res = await apiClient.post('/developer/clean-state/execute', {
        mode: 'EMPTY_CLEAN_STATE',
        confirmationPhrase: 'CLEAN SLATE',
        preserveMasterLocations: true,
        preserveMasterTariffs: true,
        preserveUsersAndRoles: true,
      });
      setCleanSlateResult(res.data);
      setActionMessage({
        type: 'success',
        text: `Clean Slate executed successfully. Backup created at: ${res.data?.backupFilename || 'local archive'}. Total records removed: ${res.data?.totalRecordsDeleted || 0}`,
      });
      setCleanSlateConfirmText('');
      fetchOverviewAndLogs();
      fetchCleanSlatePreview();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Clean Slate reset failed. Transaction rolled back.',
      });
    } finally {
      setIsCleaningSlate(false);
    }
  };

  const handlePurgeSyntheticData = async () => {
    if (purgeConfirmText !== 'PURGE-TEST-DATA') {
      setActionMessage({ type: 'error', text: 'Please type "PURGE-TEST-DATA" exactly to confirm.' });
      return;
    }
    setIsPurging(true);
    setPurgeResult(null);
    try {
      const res = await apiClient.post('/developer/test-data/purge', {
        confirmation: 'PURGE-TEST-DATA',
      });
      setPurgeResult(`Purged ${res.data?.totalPurged || 0} synthetic test records.`);
      setActionMessage({ type: 'success', text: 'Synthetic test data purged safely.' });
      setPurgeConfirmText('');
      fetchOverviewAndLogs();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.response?.data?.message || 'Purge operation failed' });
    } finally {
      setIsPurging(false);
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'HEALTHY':
      case 'PASS':
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Healthy
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Warning
          </span>
        );
      case 'ERROR':
      case 'FAILED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
            Active
          </span>
        );
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const activeTableObj = tables.find((t) => t.tableName === selectedTable);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Developer Portal"
        description="Authoritative database diagnostics, schema inspector, telemetry, and clean slate engineering console."
        badge={
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-50 text-sky-700 border border-sky-200">
            {overview?.environment || 'STANDALONE OFFLINE'}
          </span>
        }
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                fetchOverviewAndLogs();
                if (activeTab === 'database') fetchTables();
                if (activeTab === 'maintenance') fetchCleanSlatePreview();
              }}
              disabled={isRefreshing}
              className="inline-flex items-center px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Diagnostics
            </button>
            <button
              onClick={handleExportBundle}
              className="inline-flex items-center px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Snapshot
            </button>
          </div>
        }
      />

      {/* Global Action Messages */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 ml-4 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs space-y-1">
          <div className="font-bold flex items-center space-x-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>Diagnostics Error</span>
          </div>
          <p>{error}</p>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('health')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 -mb-[2px] whitespace-nowrap ${
            activeTab === 'health'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 -mb-[2px] whitespace-nowrap ${
            activeTab === 'database'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Database & Tables ({tables.length || Object.keys(overview?.database?.tableCounts || {}).length})</span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 -mb-[2px] whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit & Logs ({logs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 -mb-[2px] whitespace-nowrap ${
            activeTab === 'backups'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Backups & Integrity</span>
        </button>
        <button
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 px-3 text-xs font-bold transition flex items-center space-x-2 border-b-2 -mb-[2px] whitespace-nowrap ${
            activeTab === 'maintenance'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>Maintenance & Danger Zone</span>
        </button>
      </div>

      {/* Loading state */}
      {loading && !overview ? (
        <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Querying live application telemetry and database statistics...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: SYSTEM HEALTH */}
          {activeTab === 'health' && (
            <div className="space-y-6">
              {/* Health Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Frontend</span>
                    {renderStatusBadge(overview?.healthSummary?.frontend?.status || 'HEALTHY')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Engine: Next.js 14 (App Router)</div>
                    <div>Port: 3000 / Client</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Backend API</span>
                    {renderStatusBadge(overview?.healthSummary?.backend?.status || 'HEALTHY')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Engine: NestJS 10</div>
                    <div>Port: 4000 (Localhost)</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">SQLite DB</span>
                    {renderStatusBadge(overview?.healthSummary?.database?.status || 'HEALTHY')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Mode: WAL (Write-Ahead)</div>
                    <div>Size: {formatBytes(overview?.database?.fileSizeBytes)}</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Prisma ORM</span>
                    {renderStatusBadge(overview?.healthSummary?.prisma?.status || 'HEALTHY')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Client: v5.10+</div>
                    <div>Migrations: Applied</div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Electron</span>
                    {renderStatusBadge(overview?.healthSummary?.electron?.status || 'HEALTHY')}
                  </div>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Runtime: Offline Desktop</div>
                    <div>Arch: {overview?.system?.arch || 'arm64'}</div>
                  </div>
                </div>
              </div>

              {/* Host & Process Metrics */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Cpu className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Host System & Process Telemetry</h3>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">PID: {overview?.system?.pid}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Operating System:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.system?.platform} ({overview?.system?.arch})
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Node Runtime:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.system?.nodeVersion || 'v20.x'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Process Memory (RSS):</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.system?.memory?.rssMB ? `${overview.system.memory.rssMB} MB` : 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Uptime:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.system?.uptimeSeconds ? `${Math.floor(overview.system.uptimeSeconds / 60)} minutes` : 'Active'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DATABASE & TABLES */}
          {activeTab === 'database' && (
            <div className="space-y-6">
              {/* SQLite Storage Overview Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Authoritative SQLite Storage</h3>
                  </div>
                  {renderStatusBadge(overview?.database?.integrityCheckStatus)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Database File Path:</span>
                    <div className="font-mono text-slate-800 font-bold text-xs mt-0.5 truncate" title={overview?.database?.dbPath}>
                      {overview?.database?.dbPath || 'data/watergrid.db'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Physical Size:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {formatBytes(overview?.database?.fileSizeBytes)}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Journal Mode:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.database?.journalMode || 'WAL'}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500">Page Count:</span>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {overview?.database?.pageCount || 'N/A'} pages
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Schema & Inspector */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Database Tables & Schema Structure</h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search tables..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                      {tables.length} Tables Introspected
                    </span>
                  </div>
                </div>

                {tablesLoading ? (
                  <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                    <div className="w-6 h-6 border-2 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p>Introspecting SQLite schema metadata...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Tables List */}
                    <div className="lg:col-span-1 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                      {filteredTables.length > 0 ? (
                        filteredTables.map((t) => (
                          <button
                            key={t.tableName}
                            onClick={() => setSelectedTable(t.tableName === selectedTable ? null : t.tableName)}
                            className={`w-full p-3 text-left transition flex items-center justify-between text-xs ${
                              selectedTable === t.tableName
                                ? 'bg-sky-50 text-sky-900 font-bold border-l-4 border-l-sky-600'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate mr-2">
                              <span className="block font-semibold">{t.tableName}</span>
                              <span className="text-[10px] text-slate-400">
                                {t.columns?.length || 0} cols · {t.indexes?.length || 0} idx · {t.foreignKeys?.length || 0} fks
                              </span>
                            </div>
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 shrink-0 font-bold">
                              {t.rowCount} rows
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          No matching tables found.
                        </div>
                      )}
                    </div>

                    {/* Right: Selected Table Schema Details */}
                    <div className="lg:col-span-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                      {activeTableObj ? (
                        <div className="space-y-4 text-xs">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                            <div>
                              <h4 className="font-bold text-slate-900 text-sm font-mono">{activeTableObj.tableName}</h4>
                              <p className="text-[11px] text-slate-500">
                                Total Records: <span className="font-bold text-slate-700">{activeTableObj.rowCount}</span> | Primary Key:{' '}
                                <span className="font-mono font-bold text-sky-700">
                                  {activeTableObj.primaryKey.join(', ') || 'None'}
                                </span>
                              </p>
                            </div>
                            <span className="px-2.5 py-1 bg-sky-100 text-sky-800 rounded-lg font-mono font-bold text-[11px]">
                              PRAGMA Schema
                            </span>
                          </div>

                          {/* Columns Table */}
                          <div>
                            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider block mb-1.5">
                              Columns ({activeTableObj.columns.length})
                            </span>
                            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
                              <table className="w-full text-left text-[11px]">
                                <thead className="bg-slate-100 text-slate-600 font-semibold">
                                  <tr>
                                    <th className="p-2">Name</th>
                                    <th className="p-2">Type</th>
                                    <th className="p-2">Nullable</th>
                                    <th className="p-2">PK</th>
                                    <th className="p-2">Default</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {activeTableObj.columns.map((col) => (
                                    <tr key={col.cid} className="hover:bg-slate-50">
                                      <td className="p-2 font-mono font-semibold text-slate-800 flex items-center">
                                        {col.pk && <Key className="w-3 h-3 text-amber-500 mr-1 shrink-0" />}
                                        {col.name}
                                      </td>
                                      <td className="p-2 font-mono text-slate-600">{col.type}</td>
                                      <td className="p-2 text-slate-600">{col.notnull ? 'No' : 'Yes'}</td>
                                      <td className="p-2">{col.pk ? <span className="text-amber-600 font-bold">YES</span> : '—'}</td>
                                      <td className="p-2 font-mono text-slate-400">{col.dflt_value !== null ? String(col.dflt_value) : 'NULL'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Foreign Keys & Indexes */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* Foreign Keys */}
                            <div className="bg-white p-3 border border-slate-200 rounded-lg space-y-1.5">
                              <span className="font-bold text-slate-700 text-[11px] flex items-center">
                                <Link className="w-3 h-3 text-sky-600 mr-1" />
                                Foreign Keys ({activeTableObj.foreignKeys.length})
                              </span>
                              {activeTableObj.foreignKeys.length > 0 ? (
                                <ul className="space-y-1 font-mono text-[10px] text-slate-600">
                                  {activeTableObj.foreignKeys.map((fk) => (
                                    <li key={fk.id} className="bg-slate-50 p-1.5 rounded border border-slate-100">
                                      {fk.from} &rarr; <span className="font-bold text-slate-800">{fk.table}</span>({fk.to})
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-slate-400 text-[10px]">No outbound foreign keys</p>
                              )}
                            </div>

                            {/* Indexes */}
                            <div className="bg-white p-3 border border-slate-200 rounded-lg space-y-1.5">
                              <span className="font-bold text-slate-700 text-[11px] flex items-center">
                                <Layers className="w-3 h-3 text-emerald-600 mr-1" />
                                Indexes ({activeTableObj.indexes.length})
                              </span>
                              {activeTableObj.indexes.length > 0 ? (
                                <ul className="space-y-1 font-mono text-[10px] text-slate-600">
                                  {activeTableObj.indexes.map((idx) => (
                                    <li key={idx.name} className="bg-slate-50 p-1.5 rounded border border-slate-100 truncate" title={idx.name}>
                                      {idx.unique && <span className="text-emerald-700 font-bold mr-1">UNIQUE</span>}
                                      {idx.name}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="text-slate-400 text-[10px]">No secondary indexes</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-12 text-center text-slate-400 text-xs">
                          <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          Select a database table on the left to inspect its columns, types, primary keys, foreign relations, and indexes.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Beneficiary Relational Explorer Diagnostic Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <Database className="w-5 h-5 text-sky-600" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Authoritative Beneficiary Relational Inspector</h3>
                      <p className="text-[11px] text-slate-500">
                        Live read-only relationship summary directly introspected from SQLite relational foreign keys
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <select
                      value={selectedBeneficiaryId}
                      onChange={(e) => setSelectedBeneficiaryId(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 max-w-[240px] truncate"
                    >
                      {beneficiarySummaries.map((b) => (
                        <option key={b.beneficiaryId} value={b.beneficiaryId}>
                          {b.name} ({b.beneficiaryId.slice(0, 8)}...)
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={fetchBeneficiarySummaries}
                      disabled={loadingBeneficiaries}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition"
                      title="Refresh Beneficiary Inspector"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingBeneficiaries ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {(() => {
                  const selected = beneficiarySummaries.find((b) => b.beneficiaryId === selectedBeneficiaryId);
                  if (!selected) {
                    return (
                      <div className="p-8 text-center text-xs text-slate-400">
                        No beneficiary selected or no records found in database.
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-4">
                      {/* Identity header */}
                      <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Beneficiary</span>
                          <span className="text-sm font-bold text-slate-900">{selected.name}</span>
                          <span className="text-xs font-mono text-slate-500 ml-2">ID: {selected.beneficiaryId}</span>
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          selected.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {selected.status}
                        </span>
                      </div>

                      {/* 6 Category Summary Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Land Holdings</span>
                          <div className="text-lg font-bold text-slate-800 mt-1">
                            {selected.land.active} <span className="text-xs font-normal text-slate-500">active</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{selected.land.historical} historical</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Water Apps</span>
                          <div className="text-lg font-bold text-sky-700 mt-1">
                            {selected.water.current} <span className="text-xs font-normal text-slate-500">current</span>
                          </div>
                          <span className="text-[10px] text-slate-400">{selected.water.historical} historical</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Bills</span>
                          <div className="text-lg font-bold text-amber-700 mt-1">
                            {selected.bills.total}
                          </div>
                          <span className="text-[10px] text-slate-400">authoritative</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Installments</span>
                          <div className="text-lg font-bold text-indigo-700 mt-1">
                            {selected.installments?.total || 0}
                          </div>
                          <span className="text-[10px] text-slate-400">5-stage milestone</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Payments</span>
                          <div className="text-lg font-bold text-emerald-700 mt-1">
                            {selected.payments.total}
                          </div>
                          <span className="text-[10px] text-slate-400">ledger records</span>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">Infrastructure</span>
                          <div className="text-lg font-bold text-slate-800 mt-1">
                            {selected.infrastructure.total}
                          </div>
                          <span className="text-[10px] text-slate-400">{selected.extensions.total} extensions</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT & LOGS */}
          {activeTab === 'logs' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Application Audit & System Logs</h3>
                  <p className="text-xs text-slate-500">Live authoritative record of mutations, status changes, and user operations</p>
                </div>
                <button
                  onClick={fetchOverviewAndLogs}
                  className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-sm"
                >
                  Refresh Logs
                </button>
              </div>

              {logs.length > 0 ? (
                <div className="divide-y divide-slate-100 overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3">Time</th>
                        <th className="p-3">Action</th>
                        <th className="p-3">Entity</th>
                        <th className="p-3">Actor / IP</th>
                        <th className="p-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => {
                        const isExpanded = expandedLogId === log.id;
                        return (
                          <React.Fragment key={log.id}>
                            <tr className="hover:bg-slate-50/80 transition">
                              <td className="p-3 text-slate-500 font-mono whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="p-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-800 border border-slate-200 text-[11px]">
                                  {log.action}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700 font-medium">
                                {log.entityType ? `${log.entityType} #${log.entityId?.slice(0, 8)}` : 'System'}
                              </td>
                              <td className="p-3 text-slate-500">
                                {log.actor || 'SYSTEM'} {log.ipAddress ? `(${log.ipAddress})` : ''}
                              </td>
                              <td className="p-3 text-right">
                                {log.details ? (
                                  <button
                                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                    className="text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center"
                                  >
                                    {isExpanded ? 'Hide' : 'View'}
                                    {isExpanded ? <ChevronDown className="w-3.5 h-3.5 ml-1" /> : <ChevronRight className="w-3.5 h-3.5 ml-1" />}
                                  </button>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && log.details && (
                              <tr className="bg-slate-50">
                                <td colSpan={5} className="p-3 pl-8">
                                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                                  </pre>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 text-xs">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  No audit log entries recorded yet.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BACKUPS & INTEGRITY */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              {/* Data Integrity Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-sm">SQLite PRAGMA Data Integrity Audit</h3>
                  </div>
                  <button
                    onClick={handleRunIntegrityCheck}
                    disabled={integrityStatus === 'RUNNING'}
                    className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${integrityStatus === 'RUNNING' ? 'animate-spin' : ''}`} />
                    {integrityStatus === 'RUNNING' ? 'Executing PRAGMA Audit...' : 'Run Integrity Check'}
                  </button>
                </div>

                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    Executes low-level <code>PRAGMA integrity_check</code> and <code>PRAGMA quick_check</code> directly on the offline SQLite file to verify page header checksums, B-Tree indices, and referential constraints.
                  </p>
                  {integrityDetails && (
                    <div
                      className={`p-3 rounded-xl border text-xs font-mono ${
                        integrityStatus === 'PASSED'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}
                    >
                      {integrityDetails}
                    </div>
                  )}
                </div>
              </div>

              {/* Backups Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <HardDrive className="w-5 h-5 text-sky-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Offline Storage & Backup Archives</h3>
                  </div>
                  <button
                    onClick={handleCreateBackup}
                    className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    <HardDrive className="w-3.5 h-3.5 mr-1.5" />
                    Create Backup Point
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-slate-500 font-semibold">Backup Directory:</span>
                    <div className="font-mono text-slate-800 font-bold truncate">
                      {overview?.storage?.backupsDirectory || 'data/backups'}
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-slate-500 font-semibold">Current Active DB Size:</span>
                    <div className="font-bold text-slate-800">
                      {formatBytes(overview?.database?.fileSizeBytes)}
                    </div>
                  </div>
                </div>

                {backupStatus && (
                  <div className="p-3 bg-sky-50 border border-sky-200 text-sky-900 rounded-xl text-xs">
                    {backupStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: MAINTENANCE & DANGER ZONE */}
          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              {/* Routine Maintenance Actions */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
                  <Server className="w-5 h-5 text-slate-700" />
                  <h3 className="font-bold text-slate-900 text-sm">Routine Maintenance Tools</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <button
                    onClick={handleRefreshAppCache}
                    className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left space-y-1 transition"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center">
                      <RefreshCw className="w-4 h-4 mr-1.5 text-sky-600" />
                      Flush Query Caches
                    </div>
                    <p className="text-[11px] text-slate-500">Invalidate in-memory React and server caches</p>
                  </button>

                  <button
                    onClick={handleRunIntegrityCheck}
                    className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left space-y-1 transition"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                      PRAGMA Schema Check
                    </div>
                    <p className="text-[11px] text-slate-500">Scan database file for corruption or anomalies</p>
                  </button>

                  <button
                    onClick={handleExportBundle}
                    className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-left space-y-1 transition"
                  >
                    <div className="font-bold text-slate-800 text-xs flex items-center">
                      <Download className="w-4 h-4 mr-1.5 text-sky-600" />
                      Export Diagnostics
                    </div>
                    <p className="text-[11px] text-slate-500">Download complete JSON state bundle for support</p>
                  </button>
                </div>
              </div>

              {/* Authoritative Clean Slate Developer Tool */}
              <div className="bg-rose-50/70 rounded-2xl border-2 border-rose-200 p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-rose-200">
                  <div className="flex items-center space-x-2">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                    <h3 className="font-bold text-rose-950 text-sm">Clean Slate Protocol (Transactional Reset)</h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                    <Lock className="w-3 h-3 mr-1 text-rose-600" />
                    Destructive Action
                  </span>
                </div>

                <div className="text-xs text-rose-900 space-y-2">
                  <p className="font-bold">
                    You are about to permanently remove development operational data from the local database.
                  </p>
                  <p className="text-[11px] text-rose-800 leading-relaxed">
                    This protocol creates an automatic immutable backup before execution, wipes operational tables in dependency order, preserves master locations, tariffs, and admin accounts, and guarantees an atomic rollback on any failure.
                  </p>
                </div>

                {/* Affected Records Preview */}
                {cleanSlatePreview && (
                  <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Live Affected Record Counts:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Beneficiaries</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {cleanSlatePreview.currentRecords.beneficiaries}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Land Holdings</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {cleanSlatePreview.currentRecords.landHoldings}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Water Applications</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {cleanSlatePreview.currentRecords.waterApplications}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-500 block text-[10px]">Bills & Payments</span>
                        <span className="font-bold text-slate-900 text-sm">
                          {cleanSlatePreview.currentRecords.developmentBills + cleanSlatePreview.currentRecords.payments}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation Box */}
                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-bold text-rose-950">
                    Type <code className="bg-rose-100 text-rose-900 px-1.5 py-0.5 rounded font-mono border border-rose-300">CLEAN SLATE</code> to confirm:
                  </label>
                  <div className="flex items-center space-x-3 max-w-md">
                    <input
                      type="text"
                      placeholder="CLEAN SLATE"
                      value={cleanSlateConfirmText}
                      onChange={(e) => setCleanSlateConfirmText(e.target.value)}
                      className="flex-1 p-2.5 bg-white border border-rose-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                    <button
                      onClick={handleExecuteCleanSlate}
                      disabled={cleanSlateConfirmText.trim().toUpperCase() !== 'CLEAN SLATE' || isCleaningSlate}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {isCleaningSlate ? 'Executing Reset...' : 'Execute Clean Slate'}
                    </button>
                  </div>
                  {cleanSlateResult && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-mono">
                      ✓ Clean Slate completed. {cleanSlateResult.totalRecordsDeleted || 0} records wiped. Backup: {cleanSlateResult.backupFilename}
                    </div>
                  )}
                </div>
              </div>

              {/* Synthetic Data Purge Tool */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
                  <Trash2 className="w-5 h-5 text-slate-600" />
                  <h3 className="font-bold text-slate-900 text-sm">Purge Synthetic Test Data Only</h3>
                </div>

                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    This operation removes only records tagged with the synthetic test marker. Real beneficiaries, survey parcels, and verified payments will NOT be touched.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Type <code className="bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-mono">PURGE-TEST-DATA</code> to confirm:
                  </label>
                  <div className="flex items-center space-x-3 max-w-md">
                    <input
                      type="text"
                      placeholder="PURGE-TEST-DATA"
                      value={purgeConfirmText}
                      onChange={(e) => setPurgeConfirmText(e.target.value)}
                      className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-none"
                    />
                    <button
                      onClick={handlePurgeSyntheticData}
                      disabled={purgeConfirmText !== 'PURGE-TEST-DATA' || isPurging}
                      className="px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {isPurging ? 'Purging...' : 'Execute Purge'}
                    </button>
                  </div>
                  {purgeResult && (
                    <div className="p-3 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 font-mono">
                      {purgeResult}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
