'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  History,
  Search,
  Filter,
  Eye,
  X,
  Copy,
  Check,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Database,
} from 'lucide-react';

interface AuditLog {
  audit_id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_values: any;
  new_values: any;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
  user?: {
    user_id: string;
    email: string;
    full_name: string;
    role: { name: string };
  };
}

export default function AuditTrailPage() {
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filters
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityIdFilter, setEntityIdFilter] = useState('');

  // Selected Log for Modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, entityTypeFilter, actionFilter, entityIdFilter],
    queryFn: async () => {
      const res = await apiClient.get('/audit', {
        params: {
          limit,
          offset: (page - 1) * limit,
          entityType: entityTypeFilter || undefined,
          action: actionFilter || undefined,
          entityId: entityIdFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const logs: AuditLog[] = data?.items || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'APPROVE':
        return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'REJECT':
      case 'DELETE':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'PAYMENT':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'REVERSAL':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'UPDATE':
      case 'OVERRIDE':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <History className="w-7 h-7 text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900">System Audit Trail</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Immutable log of all administrative actions, transactional state changes, and financial records.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Cryptographically consistent database audit sink</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex items-center space-x-2 text-sm text-slate-700 font-medium">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filters:</span>
        </div>

        {/* Entity Type */}
        <select
          value={entityTypeFilter}
          onChange={(e) => {
            setEntityTypeFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">All Entities</option>
          <option value="Beneficiary">Beneficiary</option>
          <option value="LandParcel">Land Parcel</option>
          <option value="WaterApplication">Water Application</option>
          <option value="WaterAllotment">Water Allotment</option>
          <option value="DevelopmentBill">Development Bill</option>
          <option value="Installment">Installment</option>
          <option value="Payment">Payment</option>
          <option value="InfrastructureStatus">Infrastructure Status</option>
          <option value="Extension">Extension</option>
          <option value="RateConfiguration">Rate Configuration</option>
        </select>

        {/* Action */}
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="PAYMENT">PAYMENT</option>
          <option value="REVERSAL">REVERSAL</option>
          <option value="DELETE">DELETE</option>
          <option value="OVERRIDE">OVERRIDE</option>
        </select>

        {/* Entity ID Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by exact Entity UUID..."
            value={entityIdFilter}
            onChange={(e) => {
              setEntityIdFilter(e.target.value.trim());
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {(entityTypeFilter || actionFilter || entityIdFilter) && (
          <button
            onClick={() => {
              setEntityTypeFilter('');
              setActionFilter('');
              setEntityIdFilter('');
              setPage(1);
            }}
            className="text-xs text-sky-600 hover:text-sky-700 font-medium underline"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading system audit records...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">No audit records found matching the filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Reason / Notes</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.audit_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-xs text-slate-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800">{log.entity_type}</span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-600">
                      <span title={log.entity_id}>
                        {log.entity_id.slice(0, 8)}...{log.entity_id.slice(-4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.user ? (
                        <div>
                          <div className="font-medium text-slate-800 text-xs">{log.user.full_name}</div>
                          <div className="text-[11px] text-slate-400">
                            {log.user.email} •{' '}
                            <span className="font-semibold text-slate-500">{log.user.role?.name}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">System Automation</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 max-w-xs truncate">
                      {log.reason || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-medium text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
          <div>
            Showing <span className="font-medium">{logs.length}</span> of{' '}
            <span className="font-medium">{total}</span> records
          </div>
          <div className="flex items-center space-x-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="p-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inspect Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center space-x-3">
                <Database className="w-5 h-5 text-sky-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Audit Inspection — {selectedLog.entity_type}
                  </h3>
                  <div className="text-xs text-slate-500 font-mono">
                    ID: {selectedLog.entity_id} • Action:{' '}
                    <span className="font-semibold text-slate-800">{selectedLog.action}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Meta details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase">Executed By</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {selectedLog.user ? (
                      <>
                        {selectedLog.user.full_name} ({selectedLog.user.role?.name})
                        <div className="text-slate-500 font-normal">{selectedLog.user.email}</div>
                      </>
                    ) : (
                      'Automated Engine'
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold uppercase">Timestamp</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {formatDate(selectedLog.created_at)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold uppercase">IP / Source</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {selectedLog.ip_address || 'Internal RPC / Service'}
                  </div>
                </div>

                {selectedLog.reason && (
                  <div className="md:col-span-3 pt-2 border-t border-slate-200">
                    <span className="text-slate-400 block font-semibold uppercase">Reason / Justification</span>
                    <div className="text-slate-700 mt-0.5">{selectedLog.reason}</div>
                  </div>
                )}
              </div>

              {/* JSON State Changes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Values */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Prior State (Old Values)
                    </span>
                    {selectedLog.old_values && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(selectedLog.old_values, null, 2),
                            'old'
                          )
                        }
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedKey === 'old' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <pre className="p-4 text-xs font-mono bg-slate-950 text-slate-200 overflow-x-auto max-h-96">
                    {selectedLog.old_values
                      ? JSON.stringify(selectedLog.old_values, null, 2)
                      : '// No prior state (initial creation)'}
                  </pre>
                </div>

                {/* New Values */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Resulting State (New Values)
                    </span>
                    {selectedLog.new_values && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            JSON.stringify(selectedLog.new_values, null, 2),
                            'new'
                          )
                        }
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedKey === 'new' ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-medium">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  <pre className="p-4 text-xs font-mono bg-slate-950 text-emerald-400 overflow-x-auto max-h-96">
                    {selectedLog.new_values
                      ? JSON.stringify(selectedLog.new_values, null, 2)
                      : '// Entity deleted or no new state payload'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
