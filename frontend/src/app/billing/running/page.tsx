'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { CalendarDays, Plus, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function RunningBillsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedAllotmentId, setSelectedAllotmentId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState('2026-Q1');
  const [error, setError] = useState<string | null>(null);

  // Fetch running bills
  const { data, isLoading } = useQuery({
    queryKey: ['running-bills', page],
    queryFn: async () => {
      const res = await apiClient.get('/billing/running-bills', {
        params: { page, limit: 15 },
      });
      return res.data;
    },
  });

  // Fetch allotments for modal dropdown
  const { data: allotments } = useQuery({
    queryKey: ['allotments-for-running'],
    queryFn: async () => {
      const res = await apiClient.get('/water/allotments', { params: { limit: 50 } });
      return res.data?.items || [];
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/running-bills/generate', {
        allotmentId: selectedAllotmentId,
        billingPeriod,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running-bills'] });
      setShowGenerateModal(false);
      setSelectedAllotmentId('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to generate running charges bill');
    },
  });

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAllotmentId) {
      setError('Please select an allotment');
      return;
    }
    setError(null);
    generateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recurring Running Charges</h1>
          <p className="text-sm text-slate-500 mt-1">
            Operation &amp; maintenance tariff billing (strictly enabled only after infrastructure commissioning)
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setShowGenerateModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate Running Bill
        </button>
      </div>

      {/* Critical System Gate Info Alert */}
      <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Critical Engineering Gate Rule:</span> Running charges are strictly gated by
          the infrastructure lifecycle. The backend enforces that no running bill can be generated for an allotment
          unless its pipeline network has reached the <span className="font-bold uppercase">COMMISSIONED</span> status.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Billing Period</th>
                <th className="px-5 py-3.5">Farmer Beneficiary</th>
                <th className="px-5 py-3.5">Approved Litres</th>
                <th className="px-5 py-3.5">Running Rate / L</th>
                <th className="px-5 py-3.5">Amount Due</th>
                <th className="px-5 py-3.5">Paid</th>
                <th className="px-5 py-3.5">Pending</th>
                <th className="px-5 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading running bills...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((rb: any) => (
                  <tr key={rb.running_bill_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-bold text-slate-900">{rb.billing_period}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{rb.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{rb.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-blue-700">
                      {formatLitres(rb.approved_litres_snapshot)}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-600">
                      ₹{Number(rb.running_cost_per_litre_snapshot).toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(rb.amount_due)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{formatCurrency(rb.amount_paid)}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">{formatCurrency(rb.pending_amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(rb.status)}`}>
                        {rb.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No running charge bills generated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GENERATE MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Generate Running Bill</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Select Water Allotment *
                </label>
                <select
                  required
                  value={selectedAllotmentId}
                  onChange={(e) => setSelectedAllotmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="">Select an approved allotment</option>
                  {allotments?.map((a: any) => (
                    <option key={a.allotment_id} value={a.allotment_id}>
                      {a.beneficiary?.name} ({formatLitres(a.approved_litres)}) - Infra: {a.infrastructure?.status || 'None'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Only allotments where infrastructure is COMMISSIONED will be approved.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Billing Period *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2026-Q1 or 2026-10"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {generateMutation.isPending ? 'Validating Commissioning...' : 'Generate Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
