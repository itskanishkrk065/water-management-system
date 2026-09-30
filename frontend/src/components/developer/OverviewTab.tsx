'use client';

import React, { useState } from 'react';
import { DeveloperOverview, DeveloperApi } from '@/lib/developer-api';
import {
  Cpu,
  Database,
  HardDrive,
  Activity,
  Server,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  FileCode,
  Zap,
} from 'lucide-react';

interface OverviewTabProps {
  overview: DeveloperOverview | null;
  onNavigateTab: (tabKey: string) => void;
  onRefresh: () => void;
}

export function OverviewTab({ overview, onNavigateTab, onRefresh }: OverviewTabProps) {
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!overview) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400 font-mono">
        <Activity className="w-5 h-5 animate-spin mr-3 text-emerald-400" />
        Loading system telemetry and database health...
      </div>
    );
  }

  const { system, database, storage, healthSummary } = overview;

  const handleExportDiagnosticBundle = async () => {
    try {
      setExporting(true);
      const bundle = await DeveloperApi.exportDiagnosticBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watergrid-diagnostic-bundle-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('Diagnostic bundle exported successfully (all secrets redacted).');
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Action & Health Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* System Health */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase">System Integrity</span>
            {healthSummary.overallStatus === 'PASS' ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                PASS
              </span>
            ) : healthSummary.overallStatus === 'WARNING' ? (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800">
                WARNING
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950/80 text-rose-300 border border-rose-800">
                ERROR
              </span>
            )}
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{database.tableCount}</span>
            <span className="text-xs text-slate-400 font-mono">tables registered</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {database.totalRecordCount.toLocaleString()} total active records
          </p>
        </div>

        {/* Database Size & Engine */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase">SQLite Database</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
              {database.journalMode.toUpperCase()}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-cyan-400">{database.databaseSizeFormatted}</span>
            <span className="text-xs text-slate-400 font-mono">disk footprint</span>
          </div>
          <p className="text-xs text-slate-400 mt-1 font-mono">SQLite v{system.runtime.sqliteVersion}</p>
        </div>

        {/* Memory Usage */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-medium text-slate-400 uppercase">RAM Utilization</span>
            <span className="text-xs font-mono text-slate-400">{system.hardware.memoryUsagePct}%</span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{system.hardware.freeMemoryFormatted}</span>
            <span className="text-xs text-slate-400 font-mono">free of {system.hardware.totalMemoryFormatted}</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${system.hardware.memoryUsagePct}%` }}
            />
          </div>
        </div>

        {/* Diagnostic Snapshot Action */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-900/50 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-medium text-indigo-300 uppercase">Engineering Bundle</span>
              <Download className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              1-Click offline sanitized diagnostic bundle (JSON)
            </p>
          </div>
          <button
            onClick={handleExportDiagnosticBundle}
            disabled={exporting}
            className="mt-3 w-full py-1.5 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            {exporting ? 'Generating Bundle...' : 'Export Diagnostics'}
          </button>
        </div>
      </div>

      {exportSuccess && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-lg text-xs font-mono text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {exportSuccess}
        </div>
      )}

      {/* Grid: System Telemetry & Storage Center */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Runtime & Process Telemetry */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              PROCESS & RUNTIME TELEMETRY
            </h3>
            <span className="text-xs font-mono text-slate-400">PID: {system.process.backendPid}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">Host Platform</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.os.platform} ({system.os.arch})</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">System Uptime</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.os.uptimeFormatted}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">Node.js Engine</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.runtime.nodeVersion}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">Electron Runtime</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.runtime.electronVersion}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">NestJS Core</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.runtime.nestJsVersion}</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800/80">
              <span className="text-slate-500 block">Next.js Renderer</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">{system.runtime.nextJsVersion}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-slate-400">Node Process Heap</span>
              <span className="text-emerald-400 font-bold">
                {(system.process.memoryUsage.heapUsed / (1024 * 1024)).toFixed(1)} MB / {(system.process.memoryUsage.heapTotal / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyan-500 h-full rounded-full"
                style={{
                  width: `${Math.min(100, (system.process.memoryUsage.heapUsed / system.process.memoryUsage.heapTotal) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Local Storage Center */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              STORAGE BREAKDOWN & PATHS
            </h3>
            <span className="text-xs font-mono text-slate-400">{storage.sizes.totalAppSizeFormatted} TOTAL</span>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400">SQLite Database (.db)</span>
              <span className="text-cyan-400 font-bold">{storage.sizes.databaseFormatted}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Documents Directory</span>
              <span className="text-slate-300 font-medium">{storage.sizes.documentsFormatted}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Receipts Directory</span>
              <span className="text-slate-300 font-medium">{storage.sizes.receiptsFormatted}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400">System Backups (.wmbak)</span>
              <span className="text-emerald-400 font-bold">{storage.sizes.backupsFormatted}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800">
              <span className="text-slate-400">Application Logs (.log)</span>
              <span className="text-slate-300 font-medium">{storage.sizes.logsFormatted}</span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
            <span className="text-slate-500 block">Root AppData Directory:</span>
            <span className="text-slate-300 select-all">{storage.appDataDirectory}</span>
          </div>
        </div>
      </div>

      {/* Developer Command Shortcuts */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-mono font-bold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          DEVELOPER COMMAND CENTER — QUICK SHORTCUTS
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('database')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <Database className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-white mt-2">Tables</span>
            <span className="text-[11px] font-mono text-slate-400">Browse records</span>
          </button>

          <button
            onClick={() => onNavigateTab('sql')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <FileCode className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-white mt-2">SQL Console</span>
            <span className="text-[11px] font-mono text-slate-400">EXPLAIN & queries</span>
          </button>

          <button
            onClick={() => onNavigateTab('clean-state')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-rose-950/40 border border-rose-900/40 text-left transition group"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-rose-300 mt-2">Clean State</span>
            <span className="text-[11px] font-mono text-slate-400">4 Reset modes</span>
          </button>

          <button
            onClick={() => onNavigateTab('integrity')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <Activity className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-white mt-2">Integrity</span>
            <span className="text-[11px] font-mono text-slate-400">Audit & repair</span>
          </button>

          <button
            onClick={() => onNavigateTab('duplicates')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <Layers className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-white mt-2">Duplicates</span>
            <span className="text-[11px] font-mono text-slate-400">Deep scanner</span>
          </button>

          <button
            onClick={() => onNavigateTab('test-data')}
            className="p-3 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition group"
          >
            <Server className="w-4 h-4 text-violet-400 group-hover:scale-110 transition" />
            <span className="block text-xs font-mono font-bold text-white mt-2">Test Data</span>
            <span className="text-[11px] font-mono text-slate-400">Generate / Purge</span>
          </button>
        </div>
      </div>
    </div>
  );
}
