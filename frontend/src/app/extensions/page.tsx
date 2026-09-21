'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatAcres, formatLitres, formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { ArrowUpRight, CheckCircle2, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

export default function ExtensionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedExt, setSelectedExt] = useState<any>(null);
  const [approvedArea, setApprovedArea] = useState('');
  const [approvedLitres, setApprovedLitres] = useState('');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['extensions-list', page],
    queryFn: async () => {
      const res = await apiClient.get('/extensions', {
        params: { page, limit: 15 },
      });
      return res.data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/extensions/${selectedExt.extension_id}/approve`, {
        approvedAdditionalArea: parseFloat(approvedArea),
        approvedAdditionalLitres: parseFloat(approvedLitres),
        remarks: remarks || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['extensions-list'] });
      setSelectedExt(null);
      setApprovedArea('');
      setApprovedLitres('');
      setRemarks('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to approve extension');
    },
  });

  const handleOpenApprove = (ext: any) => {
    setSelectedExt(ext);
    setApprovedArea(ext.requested_additional_area);
    setApprovedLitres(ext.requested_additional_litres);
    setRemarks('Approved per additional survey parcel review');
    setError(null);
  };

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExt) return;
    approveMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Land &amp; Water Extensions</h1>
        <p className="text-sm text-slate-500 mt-1">
          Supplemental allocation requests. Handled as independent transactions without modifying root allotments.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Requested Date</th>
                <th className="px-5 py-3.5">Farmer Beneficiary</th>
                <th className="px-5 py-3.5">Original Allotment</th>
                <th className="px-5 py-3.5">Requested Additional</th>
                <th className="px-5 py-3.5">Approved Additional</th>
                <th className="px-5 py-3.5">Extension Cost</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading extensions...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((ext: any) => (
                  <tr key={ext.extension_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-mono text-slate-600">{formatDate(ext.requested_at)}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{ext.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{ext.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600">
                      {ext.originalAllotment ? `${ext.originalAllotment.allotment_id.slice(0, 8)}... (${formatLitres(ext.originalAllotment.approved_litres)})` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-800">{formatAcres(ext.requested_additional_area)}</div>
                      <div className="text-sky-700 font-bold">{formatLitres(ext.requested_additional_litres)}</div>
                    </td>
                    <td className="px-5 py-4">
                      {ext.approved_additional_area ? (
                        <>
                          <div className="font-semibold text-emerald-700">{formatAcres(ext.approved_additional_area)}</div>
                          <div className="text-blue-700 font-bold">{formatLitres(ext.approved_additional_litres)}</div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      {ext.extension_cost ? formatCurrency(ext.extension_cost) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(ext.status)}`}>
                        {ext.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {ext.status === 'REQUESTED' && user?.role === 'ADMIN' ? (
                        <button
                          onClick={() => handleOpenApprove(ext)}
                          className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold"
                        >
                          Approve &rarr;
                        </button>
                      ) : (
                        <Link
                          href={`/beneficiaries/${ext.beneficiary_id}?tab=extensions`}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          Dossier
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No extension requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVE EXTENSION MODAL */}
      {selectedExt && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Approve Water Extension</h3>
              <button onClick={() => setSelectedExt(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900">
              <span className="font-bold">Principle of Isolation:</span> Approving this extension creates a distinct
              extension cost bill and does not alter the original approved baseline allotment.
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Approved Additional Area (Acres) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={approvedArea}
                  onChange={(e) => setApprovedArea(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Approved Additional Litres *
                </label>
                <input
                  type="number"
                  required
                  value={approvedLitres}
                  onChange={(e) => setApprovedLitres(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Approval Remarks
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedExt(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Processing...' : 'Approve Extension'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
