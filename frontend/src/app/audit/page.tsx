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
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

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
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'APPROVE':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'REJECT':
      case 'DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'PAYMENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'REVERSAL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'UPDATE':
      case 'OVERRIDE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Audit Trail"
        description="Immutable log of all administrative actions, transactional state changes, and financial records."
        breadcrumbs={[
          { label: 'System & Audit', href: '/dashboard' },
          { label: 'Audit Trail' },
        ]}
        badge={
          <div className="flex items-center space-x-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold">Cryptographically Consistent</span>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap gap-3 items-center">
        <div className="flex items-center space-x-2 text-xs text-slate-700 font-semibold">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Filter By:</span>
        </div>

        {/* Entity Type */}
        <select
          value={entityTypeFilter}
          onChange={(e) => {
            setEntityTypeFilter(e.target.value);
            setPage(1);
          }}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-700"
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
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-700"
        >
          <option value="">All Actions</option>
          <option value="CREATE">CREATE</option>
          <option value="UPDATE">UPDATE</option>
          <option value="APPROVE">APPROVE</option>
          <option value="REJECT">REJECT</option>
          <option value="PAYMENT">PAYMENT</option>
          <option value="REVERSAL">REVERSAL</option>
          <option value="OVERRIDE">OVERRIDE</option>
          <option value="DELETE">DELETE</option>
        </select>

        {/* Entity ID Search */}
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search specific Entity UUID..."
            value={entityIdFilter}
            onChange={(e) => {
              setEntityIdFilter(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-700 placeholder:font-sans"
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
            className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 bg-rose-50 rounded-lg border border-rose-200 transition"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={6} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={History}
            title="No audit records found"
            description="No system logs matching the current filter criteria were found in the immutable audit log."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Timestamp</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Entity</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Entity ID</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actor</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Reason / Notes</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.audit_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border ${getActionBadge(
                          log.action,
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-semibold text-slate-800">
                      {log.entity_type}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      <span title={log.entity_id}>
                        {log.entity_id.slice(0, 8)}...{log.entity_id.slice(-4)}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {log.user ? (
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{log.user.full_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {log.user.email} •{' '}
                            <span className="font-semibold text-slate-600">{log.user.role?.name}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">System Engine</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate text-[11px]">
                      {log.reason || '—'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition"
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
        {total > 0 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Showing <span className="font-semibold text-slate-900">{logs.length}</span> of{' '}
              <span className="font-semibold text-slate-900">{total}</span> records
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-100 transition bg-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium">
                Page {page} of {Math.max(1, totalPages)}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 border border-slate-200 rounded-md disabled:opacity-40 hover:bg-slate-100 transition bg-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Inspect Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
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
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Meta details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Executed By</span>
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
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Timestamp</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {formatDate(selectedLog.created_at)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Reason / Notes</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {selectedLog.reason || 'No specific rationale supplied'}
                  </div>
                </div>
              </div>

              {/* JSON Diff State Panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Previous State */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Previous State (old_values)
                    </span>
                    {selectedLog.old_values && (
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(selectedLog.old_values, null, 2), 'old')
                        }
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
                      >
                        {copiedKey === 'old' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'old' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-200 text-xs font-mono overflow-auto max-h-72">
                    {selectedLog.old_values
                      ? JSON.stringify(selectedLog.old_values, null, 2)
                      : '// No prior state (Entity Created or Unset)'}
                  </pre>
                </div>

                {/* New State */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      New State (new_values)
                    </span>
                    {selectedLog.new_values && (
                      <button
                        onClick={() =>
                          copyToClipboard(JSON.stringify(selectedLog.new_values, null, 2), 'new')
                        }
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1"
                      >
                        {copiedKey === 'new' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'new' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <pre className="p-4 bg-slate-900 text-slate-200 text-xs font-mono overflow-auto max-h-72">
                    {selectedLog.new_values
                      ? JSON.stringify(selectedLog.new_values, null, 2)
                      : '// No new state (Entity Deleted)'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold transition"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
