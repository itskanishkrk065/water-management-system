'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, formatDateTime, getStatusBadgeClass } from '@/lib/utils';
import {
  CreditCard,
  Receipt,
  Layers,
  CheckCircle2,
  Clock,
  Printer,
  X,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Download,
  AlertCircle,
} from 'lucide-react';

export default function BeneficiaryPaymentsPage() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [payingInstallment, setPayingInstallment] = useState<any | null>(null);

  // Fetch 5-Stage Installments
  const { data: installmentsData, isLoading: instLoading } = useQuery({
    queryKey: ['beneficiary-installments'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/installments');
      return res.data;
    },
  });

  // Fetch Payments History
  const { data: payments, isLoading: payLoading } = useQuery({
    queryKey: ['beneficiary-payments'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/payments');
      return res.data;
    },
  });

  // Fetch Selected Receipt
  const { data: receipt, isLoading: receiptLoading } = useQuery({
    queryKey: ['beneficiary-receipt', selectedPaymentId],
    queryFn: async () => {
      if (!selectedPaymentId) return null;
      const res = await apiClient.get(`/beneficiary/receipts/${selectedPaymentId}`);
      return res.data;
    },
    enabled: !!selectedPaymentId,
  });

  if (instLoading || payLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const installments = installmentsData?.installments || [];
  const totalCost = parseFloat(installmentsData?.totalDevelopmentCost || '0');
  const totalPaid = parseFloat(installmentsData?.totalPaid || '0');
  const pendingBalance = parseFloat(installmentsData?.pendingBalance || '0');
  const percentPaid = totalCost > 0 ? Math.min(100, Math.round((totalPaid / totalCost) * 100)) : 0;

  const milestoneDescriptions: Record<number, string> = {
    1: 'Application Approval & Preliminary Survey',
    2: 'Trenching, Excavation & Pipeline Laying',
    3: 'Distribution Sump & Storage Reservoir Construction',
    4: 'Pump Machinery & Electrical Substation Installation',
    5: 'Final System Commissioning & Field Water Release',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Development Billing &amp; 5-Stage Installments
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Structured 5-stage milestone capital contributions, ledger records, and official fiscal receipts
        </p>
      </div>

      {/* Financial Overview Card */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Development Bill
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              {formatCurrency(totalCost)}
            </div>
            <div className="text-xs text-slate-400 mt-1">Fixed 5-Stage Tranches (20% each)</div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Total Amount Paid
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-1">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-xs text-emerald-600 mt-1">{percentPaid}% Settled</div>
          </div>

          <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
            <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
              Remaining Balance Due
            </span>
            <div className="text-2xl sm:text-3xl font-bold text-rose-700 mt-1">
              {formatCurrency(pendingBalance)}
            </div>
            <div className="text-xs text-rose-600 mt-1">Payable by milestone completion</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5">
            <span>Overall Capital Contribution Progress</span>
            <span className="font-bold">{percentPaid}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                percentPaid === 100 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${percentPaid}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 5 Milestone Installments Section */}
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-900">5-Stage Milestone Schedule</h2>
        </div>

        {installments.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            No installments generated yet. Installments are created automatically when your water quota application is approved.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {installments.map((inst: any) => {
              const isPaid = inst.status === 'PAID';
              const isPartial = inst.status === 'PARTIALLY_PAID';

              return (
                <div
                  key={inst.installment_id}
                  className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                    isPaid
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : isPartial
                      ? 'bg-sky-50/40 border-sky-200'
                      : 'bg-white border-slate-200 hover:shadow-md'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="h-6 w-6 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                          {inst.installment_number}
                        </span>
                        <span className="text-xs font-bold text-slate-700">
                          Stage {inst.installment_number} ({inst.percentage}%)
                        </span>
                      </div>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                          inst.status
                        )}`}
                      >
                        {inst.status}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-900">
                      {milestoneDescriptions[inst.installment_number] || 'Engineering Phase'}
                    </div>

                    <div className="p-3 bg-white/70 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount Due:</span>
                        <span className="font-bold text-slate-900">{formatCurrency(inst.amount_due)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Amount Paid:</span>
                        <span className="font-bold text-emerald-700">{formatCurrency(inst.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100">
                        <span className="text-slate-500">Pending:</span>
                        <span className="font-bold text-rose-700 currency-value">
                          {formatCurrency(inst.pending_amount)}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Due by: {formatDate(inst.due_date)}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    {isPaid ? (
                      <div className="text-xs font-semibold text-emerald-700 flex items-center justify-center space-x-1.5 py-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Milestone Fully Settled</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPayingInstallment(inst)}
                        className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center justify-center space-x-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Pay Milestone / Challan</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Payments Ledger */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Payments Ledger &amp; Receipts</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {payments?.length || 0} Transactions
          </span>
        </div>

        {payments && payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50 font-sans">
                  <th className="py-3 px-4">Receipt Number</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Transaction Ref</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((pay: any) => (
                  <tr key={pay.payment_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {pay.receipt_number || `REC-${pay.payment_id.substring(0, 8).toUpperCase()}`}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDate(pay.payment_date)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-sans font-semibold">
                        {pay.payment_mode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {pay.payment_reference || 'DIRECT-COUNTER'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSelectedPaymentId(pay.payment_id)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-sans font-semibold border border-amber-200 transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>View Receipt</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No completed payments recorded on your ledger yet.
          </div>
        )}
      </div>

      {/* Official Government Printable Receipt Modal */}
      {selectedPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative space-y-6 animate-in fade-in zoom-in-95 my-8">
            <button
              onClick={() => setSelectedPaymentId(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>

            {receiptLoading || !receipt ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Loading official receipt details...
              </div>
            ) : (
              <div id="printable-receipt" className="space-y-6">
                {/* Official Receipt Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Government of Tamil Nadu &bull; Water Resources Department
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mt-1 uppercase tracking-tight">
                    Official Fiscal Payment Receipt
                  </h3>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Project: <span className="font-semibold">{receipt.project?.name || 'Kongu Basin Scheme'}</span> ({receipt.project?.code || 'WMP-2026'})
                  </div>
                </div>

                {/* Receipt Meta Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs font-mono border border-slate-200">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Receipt No</span>
                    <span className="font-bold text-slate-900">{receipt.receiptNumber}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Payment Date</span>
                    <span className="font-bold text-slate-900">{formatDate(receipt.paymentDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Payment Mode</span>
                    <span className="font-bold text-slate-900">{receipt.paymentMode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Txn Reference</span>
                    <span className="font-bold text-slate-900 truncate block">{receipt.paymentReference || 'COUNTER'}</span>
                  </div>
                </div>

                {/* Beneficiary Details */}
                <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1.5 border border-slate-200">
                  <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-1">
                    Beneficiary Particulars
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">Beneficiary Name:</span>{' '}
                      <span className="font-semibold text-slate-900">{receipt.beneficiary?.name}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Contact Phone:</span>{' '}
                      <span className="font-mono text-slate-900">{receipt.beneficiary?.phone}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Revenue Village:</span>{' '}
                      <span className="font-semibold text-slate-900">{receipt.beneficiary?.village}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">District:</span>{' '}
                      <span className="font-semibold text-slate-900">{receipt.beneficiary?.district}</span>
                    </div>
                  </div>
                </div>

                {/* Purpose & Amount */}
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-emerald-800 font-medium">Payment Purpose:</span>
                    <span className="font-bold text-emerald-950">{receipt.allocationInfo}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200">
                    <span className="text-sm font-bold text-emerald-900">Total Amount Received:</span>
                    <span className="text-2xl font-extrabold text-emerald-700 currency-value">
                      {formatCurrency(receipt.amount)}
                    </span>
                  </div>
                </div>

                {/* Official Signoff */}
                <div className="pt-4 flex justify-between items-end text-xs text-slate-500 border-t border-slate-200">
                  <div className="space-y-1">
                    <div className="text-[11px] text-emerald-700 font-semibold flex items-center space-x-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Tamper-proof Digital Ledger Entry</span>
                    </div>
                    <div className="text-[10px] text-slate-400">Generated automatically via WaterGrid V1 System</div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-[10px] text-slate-400">AUTH-SIGN-VERIFIED</div>
                    <div className="font-bold text-slate-800 mt-1">Accounts Officer</div>
                    <div className="text-[10px]">Water Resources Department</div>
                  </div>
                </div>

                {/* Print Button */}
                <div className="flex justify-end pt-4 space-x-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center space-x-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow transition"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Receipt (PDF)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Online Payment / Challan Modal */}
      {payingInstallment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Stage {payingInstallment.installment_number} Payment / Challan
                </h3>
              </div>
              <button
                onClick={() => setPayingInstallment(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs text-slate-500 uppercase font-semibold">Installment Balance Due</div>
              <div className="text-2xl font-bold text-slate-900 mt-1 currency-value">
                {formatCurrency(payingInstallment.pending_amount)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Milestone: {milestoneDescriptions[payingInstallment.installment_number]}
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4 text-amber-700" />
                  <span>Authorized Payment Methods</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Payments may be deposited at any District Water Treasury counter or online via NEFT / UPI to the Department Escrow Account.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div><span className="text-slate-400">Account Name:</span> WRD Irrigation Escrow</div>
                <div><span className="text-slate-400">Account No:</span> 004510200039281</div>
                <div><span className="text-slate-400">IFSC Code:</span> SBIN0001048</div>
                <div><span className="text-slate-400">Challan Ref:</span> INST-{payingInstallment.installment_id.substring(0, 8).toUpperCase()}</div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPayingInstallment(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
