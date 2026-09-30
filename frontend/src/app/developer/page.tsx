'use client';

import React, { useState, useEffect } from 'react';
import { DeveloperHeader, DeveloperMode } from '@/components/developer/DeveloperHeader';
import { OverviewTab } from '@/components/developer/OverviewTab';
import { DatabaseExplorerTab } from '@/components/developer/DatabaseExplorerTab';
import { VisualSchemaTab } from '@/components/developer/VisualSchemaTab';
import { SqlConsoleTab } from '@/components/developer/SqlConsoleTab';
import { CleanStateTab } from '@/components/developer/CleanStateTab';
import { DuplicatesTab } from '@/components/developer/DuplicatesTab';
import { CacheDiagnosticsTab } from '@/components/developer/CacheDiagnosticsTab';
import { TestDataTab } from '@/components/developer/TestDataTab';
import { StorageBackupTab } from '@/components/developer/StorageBackupTab';
import { SecurityRbacTab } from '@/components/developer/SecurityRbacTab';
import { DeveloperOverview, TableSummary, DeveloperApi } from '@/lib/developer-api';
import {
  Activity,
  Database,
  Network,
  FileCode,
  ShieldAlert,
  Layers,
  RefreshCw,
  Server,
  HardDrive,
  Shield,
} from 'lucide-react';

export default function DeveloperConsolePage() {
  const [currentMode, setCurrentMode] = useState<DeveloperMode>('READ_ONLY');
  const [activeTab, setActiveTab] = useState<string>('overview');

  // Telemetry & Tables state
  const [overview, setOverview] = useState<DeveloperOverview | null>(null);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [loadingTables, setLoadingTables] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchTelemetryAndTables = async () => {
    try {
      setIsRefreshing(true);
      const [ov, tbl] = await Promise.all([
        DeveloperApi.getOverview(),
        DeveloperApi.getDatabaseTables(),
      ]);
      setOverview(ov);
      setTables(tbl.tables || []);
    } catch (err) {
      console.error('Failed to fetch developer telemetry:', err);
    } finally {
      setIsRefreshing(false);
      setLoadingTables(false);
    }
  };

  useEffect(() => {
    fetchTelemetryAndTables();
  }, []);

  const navTabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'database', label: 'DB Explorer', icon: Database, badge: tables.length },
    { key: 'schema', label: 'Visual Schema', icon: Network },
    { key: 'sql', label: 'SQL Console', icon: FileCode },
    { key: 'clean-state', label: 'Clean State Protocol', icon: ShieldAlert, highlight: true },
    { key: 'duplicates', label: 'Duplicate Detector', icon: Layers },
    { key: 'cache', label: 'Cache & Refresh', icon: RefreshCw },
    { key: 'test-data', label: 'Test Data', icon: Server },
    { key: 'storage-backup', label: 'Storage & Backup', icon: HardDrive },
    { key: 'security', label: 'Security & RBAC', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Protected Console Bar */}
      <DeveloperHeader
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        environment={overview?.environment || 'DEVELOPMENT'}
        isProduction={overview?.isProduction || false}
        onRefreshAll={fetchTelemetryAndTables}
        isRefreshing={isRefreshing}
      />

      {/* Navigation Sub-header Tabs */}
      <div className="bg-[#0B101E] border-b border-slate-800/80 px-6 overflow-x-auto custom-scrollbar">
        <div className="flex items-center space-x-1 py-2">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3.5 py-2 rounded-lg text-xs font-mono font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? tab.highlight
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-800 shadow'
                      : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? (tab.highlight ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Panels Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {activeTab === 'overview' && (
          <OverviewTab
            overview={overview}
            onNavigateTab={setActiveTab}
            onRefresh={fetchTelemetryAndTables}
          />
        )}

        {activeTab === 'database' && (
          <DatabaseExplorerTab
            tables={tables}
            loadingTables={loadingTables}
            onRefreshTables={fetchTelemetryAndTables}
          />
        )}

        {activeTab === 'schema' && <VisualSchemaTab tables={tables} />}

        {activeTab === 'sql' && <SqlConsoleTab tables={tables} />}

        {activeTab === 'clean-state' && (
          <CleanStateTab
            environment={overview?.environment || 'DEVELOPMENT'}
            isProduction={overview?.isProduction || false}
            onRefreshTelemetry={fetchTelemetryAndTables}
          />
        )}

        {activeTab === 'duplicates' && <DuplicatesTab />}

        {activeTab === 'cache' && <CacheDiagnosticsTab />}

        {activeTab === 'test-data' && (
          <TestDataTab onRefreshTelemetry={fetchTelemetryAndTables} />
        )}

        {activeTab === 'storage-backup' && <StorageBackupTab />}

        {activeTab === 'security' && (
          <SecurityRbacTab
            currentEnvironment={overview?.environment || 'DEVELOPMENT'}
            onRefreshTelemetry={fetchTelemetryAndTables}
          />
        )}
      </main>

      {/* Footer Status Line */}
      <footer className="bg-[#090D18] border-t border-slate-900 px-6 py-3 text-[11px] font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
          <span>WaterGrid Offline Runtime • All database operations executed against local SQLite</span>
        </div>
        <div className="text-slate-400">
          Mode: <span className="text-emerald-400 font-bold">{currentMode}</span> • Secrets Redacted: <span className="text-emerald-400">TRUE</span>
        </div>
      </footer>
    </div>
  );
}
