'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatLitres, formatDate } from '@/lib/utils';
import { Plus, ArrowRight, CheckCircle, Ban, History, Layers, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { useAuth } from '@/lib/auth-context';

export default function WaterApplicationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<'CURRENT' | 'HISTORY' | 'ALL'>('CURRENT');
  const [statusFilter, setStatusFilter] = useState('');

  // Cancel Modal State
  const [selectedAppToCancel, setSelectedAppToCancel] = useState<any>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['water-applications', page, scope, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/water/applications', {
        params: {
          page,
          limit: 15,
          scope,
          status: statusFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ appId, reason }: { appId: string; reason: string }) => {
      const res = await apiClient.post(`/water/applications/${appId}/cancel`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setSelectedAppToCancel(null);
      setCancelReason('');
      setCancelError(null);
    },
    onError: (err: any) => {
      setCancelError(err.response?.data?.message || 'Failed to cancel water application');
    },
  });

  const handleCancelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppToCancel || !cancelReason.trim()) {
      setCancelError('Please provide a valid cancellation reason.');
      return;
    }
    cancelMutation.mutate({
      appId: selectedAppToCancel.application_id,
      reason: cancelReason.trim(),
    });
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Submitted Date',
      cell: (app) => (
        <div className="text-xs">
          <div className="text-slate-900 font-semibold">{formatDate(app.application_date || app.created_at)}</div>
          <div className="text-slate-400 text-[11px] font-mono">{app.application_id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      header: 'Beneficiary Farmer',
      cell: (app) => (
        <div>
          <div className="font-semibold text-slate-900">{app.beneficiary?.name}</div>
          <div className="text-slate-400 text-[11px]">{app.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Land Holding',
      cell: (app) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">
            {app.landHolding?.declared_total_area ? `${app.landHolding.declared_total_area} Acres` : 'Holding'}
          </div>
          <div className="text-slate-400 text-[10px] font-mono">
            {app.land_id ? `#${app.land_id.slice(0, 8)}` : '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Project Scheme',
      cell: (app) => (
        <span className="text-xs text-slate-700 font-medium">{app.project?.project_name || 'Standard Scheme'}</span>
      ),
    },
    {
      header: 'Required Litres',
      align: 'right',
      cell: (app) => (
        <span className="font-bold text-sky-700 quantity-value">
          {formatLitres(app.required_litres)}
        </span>
      ),
    },
    {
      header: 'Approved Litres',
      align: 'right',
      cell: (app) => (
        <span className="font-bold text-indigo-700 quantity-value">
          {app.allotment ? formatLitres(app.allotment.approved_litres) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (app) => <StatusBadge status={app.status} size="sm" />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (app) => {
        const canCancel = (user?.role === 'ADMIN' || user?.role === 'FIELD_OFFICER') &&
          ['SUBMITTED', 'UNDER_REVIEW', 'DRAFT'].includes(app.status);

        return (
          <div className="flex items-center justify-end gap-1.5">
            {canCancel && (
              <button
                onClick={() => {
                  setSelectedAppToCancel(app);
                  setCancelReason('');
                  setCancelError(null);
                }}
                className="inline-flex items-center px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
                title="Cancel water application"
              >
                <Ban className="w-3 h-3 mr-1" /> Cancel
              </button>
            )}
            <Link
              href={`/admin/beneficiaries/${app.beneficiary_id}?tab=water`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              View <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Water Requirement Applications"
        description="Volumetric irrigation requests submitted by farmers and field officers across registered land holdings"
        badge="Allocation Registry"
        actions={
          <div className="flex items-center gap-2">
            {user?.role === 'ADMIN' && (
              <Link
                href="/water/approvals"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approvals Queue
              </Link>
            )}
            <Link
              href="/water/applications/new"
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Submit Application
            </Link>
          </div>
        }
      />

      {/* Scope Selector Tabs (Current vs History vs All) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setScope('CURRENT');
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              scope === 'CURRENT'
                ? 'bg-white text-sky-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-sky-600" />
            Current Operational Queue
          </button>
          <button
            onClick={() => {
              setScope('HISTORY');
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              scope === 'HISTORY'
                ? 'bg-white text-amber-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-amber-600" />
            Historical & Terminal Archive
          </button>
          <button
            onClick={() => {
              setScope('ALL');
              setStatusFilter('');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              scope === 'ALL'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Records
          </button>
        </div>

        {/* Sub Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {scope === 'CURRENT' && (
            <>
              {['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st ? st.replace('_', ' ') : 'All Current'}
                </button>
              ))}
            </>
          )}

          {scope === 'HISTORY' && (
            <>
              {['', 'CANCELLED', 'REJECTED', 'VOIDED'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    statusFilter === st
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st || 'All History'}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle={scope === 'HISTORY' ? 'No historical water applications' : 'No current operational water applications'}
        emptyDescription={
          scope === 'HISTORY'
            ? 'Cancelled, rejected, or voided water applications will appear here.'
            : 'Submit a water allocation application for an active land holding to begin the verification workflow.'
        }
        emptyActionLabel="Submit New Application"
        emptyActionHref="/water/applications/new"
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />

      {/* MODAL: CANCEL WATER APPLICATION */}
      {selectedAppToCancel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Cancel Water Application</h3>
              </div>
              <button
                onClick={() => setSelectedAppToCancel(null)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCancelSubmit} className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Are you sure you want to cancel Water Application{' '}
                <strong>#{selectedAppToCancel.application_id.slice(0, 8)}</strong> for{' '}
                <strong>{selectedAppToCancel.beneficiary?.name}</strong>?
              </p>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
                <strong>Lifecycle Notice:</strong> The application will be moved to{' '}
                <strong>Water History / Archive</strong> with status <code>CANCELLED</code>.
                The land holding will be immediately released for new applications.
              </div>

              {cancelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {cancelError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cancellation Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Farmer withdrew request / Land parcel boundaries updated"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedAppToCancel(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Keep Application
                </button>
                <button
                  type="submit"
                  disabled={cancelMutation.isPending}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

