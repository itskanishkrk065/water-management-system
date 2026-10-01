'use client';

import React, { useState, useEffect } from 'react';
import { DeveloperApi } from '@/lib/developer-api';
import {
  FileText,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Shield,
  Clock,
  Terminal,
  AlertCircle,
  Info,
} from 'lucide-react';

export function LogsTab() {
  const [logsData, setLogsData] = useState<{
    auditLogs: any[];
    physicalLogs: any[];
    totalAuditEntries: number;
    logsDirectory: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [activeLogType, setActiveLogType] = useState<'AUDIT' | 'PROCESS'>('AUDIT');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await DeveloperApi.getLogs(100);
      setLogsData(data);
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const auditLogs = logsData?.auditLogs || [];
  const physicalLogs = logsData?.physicalLogs || [];

  const filteredAuditLogs = auditLogs.filter((log) => {
    const matchesSearch =
      searchTerm === '' ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tableName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.recordId && log.recordId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesAction = selectedAction === 'ALL' || log.action === selectedAction;

    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(auditLogs.map((l) => l.action)));

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Application & Audit Logs</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time backend audit events, administrative mutations, and runtime diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sub Tab Toggle */}
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center">
            <button
              onClick={() => setActiveLogType('AUDIT')}
              className={`px-3 py-1 text-xs font-mono rounded-md transition ${
                activeLogType === 'AUDIT'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Audit Trail ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveLogType('PROCESS')}
              className={`px-3 py-1 text-xs font-mono rounded-md transition ${
                activeLogType === 'PROCESS'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Process Logs ({physicalLogs.length})
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-2 border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {activeLogType === 'AUDIT' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by action, table, user, or record ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">All Actions ({auditLogs.length})</option>
                {uniqueActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table of Audit Logs */}
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="p-3 w-8"></th>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Table / Entity</th>
                  <th className="p-3">User & Role</th>
                  <th className="p-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      {loading ? 'Loading audit records...' : 'No audit log records found matching the filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const isDangerous =
                      log.action.includes('DELETE') ||
                      log.action.includes('CLEAN') ||
                      log.action.includes('RESET') ||
                      log.action.includes('PURGE');
                    const isWrite = log.action.includes('CREATE') || log.action.includes('UPDATE') || log.action.includes('POST');

                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="hover:bg-slate-800/50 cursor-pointer transition"
                        >
                          <td className="p-3 text-slate-500">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </td>
                          <td className="p-3 text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                isDangerous
                                  ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                                  : isWrite
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                                  : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-slate-300 font-semibold">{log.tableName}</td>
                          <td className="p-3 text-slate-300">
                            <div className="flex items-center gap-1">
                              <Shield className="w-3 h-3 text-indigo-400" />
                              <span>{log.user}</span>
                              <span className="text-[10px] text-slate-500">({log.role})</span>
                            </div>
                          </td>
                          <td className="p-3 text-slate-400">{log.ipAddress || '127.0.0.1'}</td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-950/60">
                            <td colSpan={6} className="p-4 border-t border-slate-800/60">
                              <div className="space-y-3 text-xs font-mono">
                                <div>
                                  <span className="text-slate-400">Record ID: </span>
                                  <span className="text-emerald-400 select-all">{log.recordId || 'N/A'}</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <div className="text-slate-400 mb-1">Previous Values:</div>
                                    <pre className="p-3 bg-slate-900 border border-slate-800 rounded text-slate-300 text-[11px] overflow-x-auto max-h-48">
                                      {log.oldValues ? JSON.stringify(log.oldValues, null, 2) : 'null'}
                                    </pre>
                                  </div>
                                  <div>
                                    <div className="text-slate-400 mb-1">New / Applied Values:</div>
                                    <pre className="p-3 bg-slate-900 border border-slate-800 rounded text-emerald-300 text-[11px] overflow-x-auto max-h-48">
                                      {log.newValues ? JSON.stringify(log.newValues, null, 2) : 'null'}
                                    </pre>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Log Directory: {logsData?.logsDirectory}</span>
            <span>Total process entries: {physicalLogs.length}</span>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs max-h-[500px] overflow-y-auto space-y-2">
            {physicalLogs.length === 0 ? (
              <div className="text-slate-500 text-center py-6">
                No active physical process log files currently found in the runtime log directory.
              </div>
            ) : (
              physicalLogs.map((pLog, idx) => (
                <div key={idx} className="flex items-start gap-2 border-b border-slate-900 pb-2">
                  <span className="text-slate-500 whitespace-nowrap">{pLog.timestamp.slice(11, 19)}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      pLog.level === 'ERROR'
                        ? 'bg-rose-950 text-rose-300'
                        : pLog.level === 'WARN'
                        ? 'bg-amber-950 text-amber-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {pLog.level}
                  </span>
                  <span className="text-indigo-400 text-[11px]">[{pLog.source}]</span>
                  <span className="text-slate-200 break-all">{pLog.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
