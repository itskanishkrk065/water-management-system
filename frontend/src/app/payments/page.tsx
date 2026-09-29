'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { CreditCard, Plus, RotateCcw, AlertCircle, X, Search, FileText } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payments &amp; Financial Ledger</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable transaction journal; payment corrections handled exclusively via verified reversals
          </p>
        </div>
      </div>

      {/* Search by receipt */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by receipt number (e.g. REC-2026-)..."
          value={receiptSearch}
          onChange={(e) => {
            setReceiptSearch(e.target.value);
            setPage(1);
          }}
          className="w-full bg-transparent border-none text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Receipt Number</th>
                <th className="px-5 py-3.5">Payment Date</th>
                <th className="px-5 py-3.5">Beneficiary</th>
                <th className="px-5 py-3.5">Target Allocation</th>
                <th className="px-5 py-3.5">Payment Mode</th>
                <th className="px-5 py-3.5">Amount (INR)</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Officer</th>
                <th className="px-5 py-3.5 text-right">Ledger Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    Loading payments ledger...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((p: any) => (
                  <tr key={p.payment_id} className={`hover:bg-slate-50/50 transition ${p.is_reversal ? 'bg-amber-50/30' : ''}`}>
                    <td className="px-5 py-4 font-mono font-bold text-sky-700">{p.receipt_number}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(p.payment_date)}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{p.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{p.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {p.installment_id
                        ? `Installment #${p.installment?.installment_number}`
                        : p.running_bill_id
                        ? `Running Bill (${p.runningBill?.billing_period})`
                        : 'Extension'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{p.payment_mode}</td>
                    <td className={`px-5 py-4 font-bold text-sm ${Number(p.amount) < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500 truncate max-w-[120px]">{p.recorded_by}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDownloadReceipt(p.payment_id, p.receipt_number)}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded text-xs font-semibold inline-flex items-center space-x-1"
                          title="Download Official PDF Receipt"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                        {p.status === 'COMPLETED' && !p.is_reversal && (user?.role === 'ACCOUNTS' || user?.role === 'ADMIN') && (
                          <button
                            onClick={() => {
                              setReversalTargetPayment(p);
                              setReversalReason('');
                              setReversalError(null);
                              setShowReverseModal(true);
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded text-xs font-semibold inline-flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reverse</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    No payment transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVERSAL CONFIRMATION MODAL */}
      {showReverseModal && reversalTargetPayment && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Reverse Payment Transaction</h3>
              <button onClick={() => setShowReverseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reversalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {reversalError}
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
              <div className="font-bold">Transaction to be Reversed:</div>
              <div>Receipt: <span className="font-mono">{reversalTargetPayment.receipt_number}</span></div>
              <div>Amount: <span className="font-bold">{formatCurrency(reversalTargetPayment.amount)}</span></div>
              <div className="text-[11px] text-amber-800 pt-1 border-t border-amber-200">
                Reversing will create an offsetting negative transaction record and restore the pending amount on the associated installment or bill.
              </div>
            </div>

            <form onSubmit={handleReverseSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Mandatory Reversal Audit Reason *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Bank cheque bounced / Bank transfer reference duplicated"
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reverseMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {reverseMutation.isPending ? 'Reversing...' : 'Execute Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
