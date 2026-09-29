'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { RotateCcw, X, Search, FileText } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';

export default function PaymentsMasterPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [receiptSearch, setReceiptSearch] = useState('');

  // Reversal Modal state
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reversalTargetPayment, setReversalTargetPayment] = useState<any>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  // Fetch payments
  const { data, isLoading } = useQuery({
    queryKey: ['master-payments', page, receiptSearch],
    queryFn: async () => {
      const res = await apiClient.get('/payments', {
        params: { page, limit: 20, receiptNumber: receiptSearch || undefined },
      });
      return res.data;
    },
  });

  // Reversal Mutation
  const reverseMutation = useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      const res = await apiClient.post(`/payments/${paymentId}/reverse`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowReverseModal(false);
      setReversalTargetPayment(null);
      setReversalReason('');
      setReversalError(null);
    },
    onError: (err: any) => {
      setReversalError(err.response?.data?.message || 'Failed to reverse payment transaction');
    },
  });

  const handleReverseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTargetPayment || !reversalReason.trim()) {
      setReversalError('Please provide a mandatory reason for payment reversal');
      return;
    }
    reverseMutation.mutate({
      paymentId: reversalTargetPayment.payment_id,
      reason: reversalReason.trim(),
    });
  };

  const handleDownloadReceipt = async (paymentId: string, receiptNumber: string) => {
    try {
      const res = await apiClient.get(`/payments/${paymentId}/receipt/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Payment_Receipt_${receiptNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download payment receipt PDF:', err);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      header: 'Receipt / Ref #',
      cell: (p) => (
        <div className="font-mono text-xs">
          <div className="font-bold text-slate-900">{p.receipt_number || p.payment_reference || 'REF-OFFLINE'}</div>
          <div className="text-slate-400 text-[11px]">{p.payment_id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      header: 'Beneficiary Farmer',
      cell: (p) => (
        <div>
          <div className="font-semibold text-slate-900">{p.beneficiary?.name}</div>
          <div className="text-slate-400 font-mono text-[11px]">{p.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Mode',
      cell: (p) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono">
          {p.payment_mode}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      cell: (p) => (
        <span className={`font-bold font-mono text-sm ${p.is_reversal ? 'text-rose-600 line-through' : 'text-emerald-700'}`}>
          {formatCurrency(p.amount)}
        </span>
      ),
    },
    {
      header: 'Recorded Date',
      cell: (p) => <span className="font-mono text-xs text-slate-600">{formatDate(p.payment_date || p.created_at)}</span>,
    },
    {
      header: 'Status',
      align: 'center',
      cell: (p) => (
        <StatusBadge
          status={p.is_reversal ? 'CANCELLED' : 'PAID'}
          label={p.is_reversal ? 'REVERSED' : 'SETTLED'}
          size="sm"
        />
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleDownloadReceipt(p.payment_id, p.receipt_number)}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition"
            title="Download PDF Receipt"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
          {!p.is_reversal && user?.role === 'ADMIN' && (
            <button
              onClick={() => {
                setReversalTargetPayment(p);
                setReversalReason('');
                setReversalError(null);
                setShowReverseModal(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition"
              title="Reverse Payment"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reverse
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments Ledger"
        description="Immutable transaction journal; payment adjustments handled exclusively via auditable reversal vouchers"
      />

      {/* Search Input Filter */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by receipt number (e.g. REC-2026-)..."
          value={receiptSearch}
          onChange={(e) => {
            setReceiptSearch(e.target.value);
            setPage(1);
          }}
          className="flex-1 text-xs bg-transparent border-none focus:outline-none focus:ring-0 text-slate-800 placeholder:text-slate-400 font-mono"
        />
        {receiptSearch && (
          <button
            onClick={() => setReceiptSearch('')}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-2 py-1 bg-slate-100 rounded-lg"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No payment records found"
        emptyDescription="No payment transactions match your query."
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />

      {/* Reversal Confirmation Modal */}
      {showReverseModal && reversalTargetPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Reverse Payment Voucher</h3>
              </div>
              <button
                onClick={() => setShowReverseModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 font-mono text-slate-700">
              <div>Receipt: <strong className="text-slate-900">{reversalTargetPayment.receipt_number}</strong></div>
              <div>Farmer: <strong className="text-slate-900">{reversalTargetPayment.beneficiary?.name}</strong></div>
              <div>Reversal Amount: <strong className="text-rose-600">{formatCurrency(reversalTargetPayment.amount)}</strong></div>
            </div>

            <div className="text-xs text-slate-500 leading-relaxed">
              This will create a negative offsetting journal entry and restore the installment due balance.
            </div>

            {reversalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {reversalError}
              </div>
            )}

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <textarea
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="State the exact verified administrative reason for this reversal..."
                  rows={3}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 focus:ring-rose-500 focus:border-rose-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reverseMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
