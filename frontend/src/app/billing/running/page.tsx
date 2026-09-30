'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate } from '@/lib/utils';
import { Plus, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';

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

  const columns: ColumnDef<any>[] = [
    {
      header: 'Bill ID / Period',
      cell: (rb) => (
        <div className="text-xs">
          <div className="font-bold font-mono text-slate-800">{rb.running_bill_id.slice(0, 8)}...</div>
          <div className="text-sky-700 font-semibold">{rb.billing_period}</div>
        </div>
      ),
    },
    {
      header: 'Farmer Beneficiary',
      cell: (rb) => (
        <div>
          <div className="font-semibold text-slate-900">{rb.beneficiary?.name}</div>
          <div className="text-slate-400 text-[11px]">{rb.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Allotted Litres',
      align: 'right',
      cell: (rb) => (
        <span className="font-semibold text-sky-700 quantity-value">
          {formatLitres(rb.approved_litres_snapshot)}
        </span>
      ),
    },
    {
      header: 'Tariff Rate',
      align: 'right',
      cell: (rb) => (
        <span className="text-slate-600">
          ₹{Number(rb.running_cost_per_litre_snapshot).toFixed(2)} / L
        </span>
      ),
    },
    {
      header: 'Amount Due',
      align: 'right',
      cell: (rb) => (
        <span className="font-bold text-slate-900 currency-value">{formatCurrency(rb.amount_due)}</span>
      ),
    },
    {
      header: 'Due Date',
      cell: (rb) => <span className="text-xs text-slate-600">{formatDate(rb.due_date)}</span>,
    },
    {
      header: 'Status',
      align: 'center',
      cell: (rb) => <StatusBadge status={rb.status} size="sm" />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (rb) => (
        <Link
          href={`/admin/beneficiaries/${rb.beneficiary_id}?tab=running`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Running Charges"
        description="Operation & maintenance tariff billing (strictly enabled only after infrastructure commissioning)"
        badge="Recurring Tariff"
        actions={
          <button
            onClick={() => {
              setError(null);
              setShowGenerateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Generate Running Bill
          </button>
        }
      />

      {/* Engineering Gate Callout */}
      <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl text-xs text-sky-900 flex items-start space-x-3">
        <AlertCircle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Commissioning Gate Invariant:</span> Running charges are strictly gated by
          the infrastructure lifecycle. The backend enforces that no recurring bill can be generated for an allotment
          unless its pipeline network has reached the <span className="font-bold uppercase">COMMISSIONED</span> status.
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No running charges bills found"
        emptyDescription="Running charge records will appear once commissioned pipeline networks begin operation cycles."
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Generate Running Bill</h3>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleGenerateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Commissioned Water Allotment
                </label>
                <select
                  value={selectedAllotmentId}
                  onChange={(e) => setSelectedAllotmentId(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 focus:ring-sky-500 focus:border-sky-500"
                  required
                >
                  <option value="">Select an active allotment...</option>
                  {(allotments || []).map((a: any) => (
                    <option key={a.allotment_id} value={a.allotment_id}>
                      {a.beneficiary?.name} ({formatLitres(a.approved_litres)}) - Allotment #{a.allotment_id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Billing Period</label>
                <input
                  type="text"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                  placeholder="e.g. 2026-Q1 or 2026-05"
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 focus:ring-sky-500 focus:border-sky-500 font-mono"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {generateMutation.isPending ? 'Generating...' : 'Generate Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
