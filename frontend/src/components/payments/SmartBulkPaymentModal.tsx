'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  ArrowRight,
  Calculator,
  Sparkles,
  Loader2,
  DollarSign,
} from 'lucide-react';

interface SmartBulkPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  beneficiaryId: string;
  beneficiaryName: string;
  developmentBillId?: string;
  initialAmount?: string;
  queueMode?: boolean;
  onSaveAndNext?: () => void;
}

export function SmartBulkPaymentModal({
  isOpen,
  onClose,
  beneficiaryId,
  beneficiaryName,
  developmentBillId,
  initialAmount = '',
  queueMode = false,
  onSaveAndNext,
}: SmartBulkPaymentModalProps) {
  const queryClient = useQueryClient();

  const [paymentAmount, setPaymentAmount] = useState(initialAmount);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [step, setStep] = useState<'ENTRY' | 'CONFIRM' | 'SUCCESS'>('ENTRY');
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Focus input automatically on open
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && step === 'ENTRY') {
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [isOpen, step]);

  // Fetch billing & installments for live allocation calculation
  const { data: billingData, isLoading: loadingBilling } = useQuery({
    queryKey: ['beneficiary-billing-modal', beneficiaryId],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${beneficiaryId}/billing`);
      return res.data;
    },
    enabled: isOpen && !!beneficiaryId,
  });

  const developmentBills = billingData?.developmentBills || [];
  const targetBill = developmentBillId
    ? developmentBills.find((b: any) => b.bill_id === developmentBillId)
    : developmentBills.find((b: any) => parseFloat(b.pending_amount) > 0) || developmentBills[0];

  const installments = targetBill?.installments || [];
  const grandOutstanding = developmentBills.reduce(
    (acc: number, b: any) => acc + parseFloat(b.pending_amount || 0),
    0,
  );

  // Earliest unpaid installment for "Pay Next Installment"
  const earliestUnpaid = installments.find(
    (ins: any) => ins.status === 'PENDING' || ins.status === 'PARTIALLY_PAID' || ins.status === 'OVERDUE',
  );

  // Live backend preview query
  const numericAmount = parseFloat(paymentAmount) || 0;
  const { data: previewData } = useQuery({
    queryKey: ['payment-bulk-preview', beneficiaryId, targetBill?.bill_id, numericAmount],
    queryFn: async () => {
      const res = await apiClient.post('/payments/bulk-preview', {
        beneficiaryId,
        developmentBillId: targetBill?.bill_id,
        amount: numericAmount,
      });
      return res.data;
    },
    enabled: isOpen && numericAmount > 0 && !!targetBill?.bill_id,
  });

  // Calculate Cash Change
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeAmount = cashReceivedNum > numericAmount ? cashReceivedNum - numericAmount : 0;

  // Preset Handlers
  const handlePayFullOutstanding = () => {
    setPaymentAmount(grandOutstanding.toFixed(2));
    setError(null);
  };

  const handlePayNextInstallment = () => {
    if (earliestUnpaid) {
      setPaymentAmount(parseFloat(earliestUnpaid.pending_amount).toFixed(2));
      setError(null);
    }
  };

  // Submit Mutation
  const recordMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/payments/bulk-record', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setPaymentResult(data);
      setStep('SUCCESS');
      queryClient.invalidateQueries({ queryKey: ['beneficiary-billing'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-next-action'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['collection-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || err.message || 'Failed to record payment');
    },
  });

  const handleConfirmSubmit = () => {
    if (numericAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    recordMutation.mutate({
      beneficiaryId,
      developmentBillId: targetBill?.bill_id,
      amount: numericAmount,
      paymentMode,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Smart Payment Engine</h2>
              <p className="text-xs text-slate-400">Beneficiary: <span className="text-slate-200 font-semibold">{beneficiaryName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Step 1: ENTRY */}
        {step === 'ENTRY' && (
          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Presets Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handlePayFullOutstanding}
                className="px-3.5 py-2 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pay Full Outstanding ({formatCurrency(grandOutstanding)})</span>
              </button>

              {earliestUnpaid && (
                <button
                  type="button"
                  onClick={handlePayNextInstallment}
                  className="px-3.5 py-2 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Pay Next Installment ({formatCurrency(earliestUnpaid.pending_amount)})</span>
                </button>
              )}
            </div>

            {/* Payment Input Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment Amount (₹) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">₹</span>
                  <input
                    ref={amountInputRef}
                    type="number"
                    step="0.01"
                    min="1"
                    value={paymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter amount"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-4 py-2 text-white font-mono font-bold text-lg focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / NEFT / RTGS</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="UPI">UPI / Digital Gateway</option>
                </select>
              </div>
            </div>

            {/* Cash Change Calculator */}
            {paymentMode === 'CASH' && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Calculator className="w-4 h-4 text-cyan-400" />
                  <span>Cash Payment Change Calculator</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-1">Amount Due</span>
                    <span className="text-white font-mono font-bold text-base">{formatCurrency(numericAmount)}</span>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Cash Received</label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="e.g. 3000"
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-sm focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-1">Change to Return</span>
                    <span className={`font-mono font-bold text-base block pt-1 ${changeAmount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {formatCurrency(changeAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Allocation Preview Table */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Live Installment Allocation Preview</span>
                {numericAmount > 0 && <span className="text-cyan-400 font-mono">Allocating {formatCurrency(numericAmount)}</span>}
              </h3>

              <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800 uppercase font-mono">
                    <tr>
                      <th className="p-2.5">Installment</th>
                      <th className="p-2.5 text-right">Original</th>
                      <th className="p-2.5 text-right">Allocated</th>
                      <th className="p-2.5 text-right">Remaining</th>
                      <th className="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                    {previewData?.allocationPreview ? (
                      previewData.allocationPreview.map((item: any) => (
                        <tr key={item.installmentNumber} className={item.allocatedAmount > 0 ? 'bg-cyan-500/5' : ''}>
                          <td className="p-2.5 font-semibold">Installment #{item.installmentNumber}</td>
                          <td className="p-2.5 text-right text-slate-400">{formatCurrency(item.originalAmount)}</td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">{formatCurrency(item.allocatedAmount)}</td>
                          <td className="p-2.5 text-right text-slate-400">{formatCurrency(item.remainingAfter)}</td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase ${
                                item.newStatus === 'PAID'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                  : item.newStatus === 'PARTIALLY_PAID'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.newStatus}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      installments.map((ins: any) => (
                        <tr key={ins.installment_id}>
                          <td className="p-2.5 font-semibold">Installment #{ins.installment_number}</td>
                          <td className="p-2.5 text-right text-slate-400">{formatCurrency(ins.amount)}</td>
                          <td className="p-2.5 text-right text-slate-500">₹0.00</td>
                          <td className="p-2.5 text-right text-slate-400">{formatCurrency(ins.pending_amount)}</td>
                          <td className="p-2.5 text-center text-slate-500">{ins.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={numericAmount <= 0}
                onClick={() => setStep('CONFIRM')}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5"
              >
                <span>Review & Submit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Step 2: CONFIRM */}
        {step === 'CONFIRM' && (
          <div className="p-6 space-y-5">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Confirm Payment Submission
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block">Beneficiary</span>
                  <span className="text-white font-sans font-semibold text-sm">{beneficiaryName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Amount</span>
                  <span className="text-emerald-400 font-bold text-base">{formatCurrency(numericAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Mode</span>
                  <span className="text-slate-200">{paymentMode}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Installments Cleared</span>
                  <span className="text-cyan-400 font-bold">
                    {previewData?.summary?.installmentsFullyCleared || 0} Full / {previewData?.summary?.installmentsPartiallyPaid || 0} Partial
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStep('ENTRY')}
                className="px-4 py-2 text-slate-400 hover:text-white text-xs font-semibold rounded-lg"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={recordMutation.isPending}
                onClick={handleConfirmSubmit}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-lg transition-all flex items-center gap-2"
              >
                {recordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <span>Confirm & Authorize Payment</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Content Step 3: SUCCESS */}
        {step === 'SUCCESS' && (
          <div className="p-6 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">PAYMENT SUCCESSFUL</h2>
              <p className="text-sm text-emerald-400 font-mono font-bold mt-1">
                {formatCurrency(paymentResult?.totalPaidAmount || numericAmount)} received
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {paymentResult?.installmentsClearedCount || 0} installment(s) cleared. Remaining balance: {formatCurrency(paymentResult?.remainingBalance || 0)}.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg border border-slate-700 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt</span>
              </button>

              {queueMode && onSaveAndNext ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSaveAndNext();
                  }}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-lg shadow-md flex items-center gap-2"
                >
                  <span>Save & Next Beneficiary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg shadow-md"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
