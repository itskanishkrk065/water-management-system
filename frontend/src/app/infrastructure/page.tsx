'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate, getStatusBadgeClass } from '@/lib/utils';
import { Building2, CheckCircle2, ArrowRight, X, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function InfrastructureGridPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const canManage = ['ADMIN', 'FIELD_OFFICER', 'ACCOUNTS'].includes(user?.role || '');
  const [selectedInfra, setSelectedInfra] = useState<any>(null);
  const [nextStatus, setNextStatus] = useState('UNDER_CONSTRUCTION');
  const [milestoneDate, setMilestoneDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusRemarks, setStatusRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['infrastructure-list', page, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/infrastructure', {
        params: { page, limit: 15, status: statusFilter || undefined },
      });
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, date, remarks }: { id: string; status: string; date?: string; remarks: string }) => {
      const res = await apiClient.patch(`/infrastructure/${id}/status`, {
        status,
        date: date || undefined,
        remarks: remarks || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['infrastructure-list'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-infrastructure'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-running-bills'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-allotments'] });
      queryClient.invalidateQueries({ queryKey: ['allotments-for-running'] });
      setSelectedInfra(null);
      setStatusRemarks('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to update infrastructure status');
    },
  });

  const handleOpenStatusModal = (infra: any) => {
    setSelectedInfra(infra);
    if (infra.status === 'PLANNED') setNextStatus('UNDER_CONSTRUCTION');
    else if (infra.status === 'UNDER_CONSTRUCTION') setNextStatus('COMPLETED');
    else if (infra.status === 'COMPLETED') setNextStatus('COMMISSIONED');
    else setNextStatus('COMMISSIONED');
    setMilestoneDate(new Date().toISOString().split('T')[0]);
    setStatusRemarks(infra.remarks || '');
    setError(null);
  };

  const handleStatusSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInfra) return;
    updateMutation.mutate({
      id: selectedInfra.infrastructure_id,
      status: nextStatus,
      date: milestoneDate ? new Date(milestoneDate).toISOString() : undefined,
      remarks: statusRemarks,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Infrastructure Grid Operations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pipeline, metering valves, and canal distributary physical execution lifecycle
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'PLANNED', 'UNDER_CONSTRUCTION', 'COMPLETED', 'COMMISSIONED'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st || 'All States'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Farmer Beneficiary</th>
                <th className="px-5 py-3.5">Current Lifecycle</th>
                <th className="px-5 py-3.5">Planned Date</th>
                <th className="px-5 py-3.5">Start Date</th>
                <th className="px-5 py-3.5">Completion Date</th>
                <th className="px-5 py-3.5">Commissioned Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading infrastructure grid...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((infra: any) => (
                  <tr key={infra.infrastructure_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{infra.beneficiary?.name}</div>
                      <div className="text-slate-400 text-[11px]">{infra.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusBadgeClass(infra.status)}`}>
                        {infra.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(infra.planned_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(infra.construction_start_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(infra.completion_date)}</td>
                    <td className="px-5 py-4 font-bold text-emerald-700">
                      {formatDate(infra.commissioned_date)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {infra.status !== 'COMMISSIONED' ? (
                        canManage ? (
                          <button
                            onClick={() => handleOpenStatusModal(infra)}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition"
                          >
                            Advance Status &rarr;
                          </button>
                        ) : (
                          <span className="text-xs text-amber-700 font-semibold inline-flex items-center">
                            In Progress
                          </span>
                        )
                      ) : (
                        <span className="text-xs text-emerald-700 font-bold inline-flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No infrastructure records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPDATE STATUS MODAL */}
      {selectedInfra && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Advance Infrastructure Lifecycle</h3>
              <button onClick={() => setSelectedInfra(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Target Status *
                </label>
                <select
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                >
                  <option value="PLANNED">PLANNED (Alignment &amp; survey clearance)</option>
                  <option value="UNDER_CONSTRUCTION">UNDER_CONSTRUCTION (Pipes &amp; valves being laid)</option>
                  <option value="COMPLETED">COMPLETED (Physical installation finished)</option>
                  <option value="COMMISSIONED">COMMISSIONED (Tested &amp; flowing - unlocks running charges)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Milestone Date *
                </label>
                <input
                  type="date"
                  value={milestoneDate}
                  onChange={(e) => setMilestoneDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Engineer Inspection Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Sluice valve calibrated, flow pressure verified at 3.5 bar"
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedInfra(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
