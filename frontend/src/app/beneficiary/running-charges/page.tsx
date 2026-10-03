'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  CalendarDays,
  ShieldAlert,
  CheckCircle2,
  Building2,
  ArrowRight,
  Receipt,
  Droplets,
  AlertTriangle,
  CreditCard,
  History,
  X,
  Clock,
  IndianRupee,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryRunningChargesPage() {
  const queryClient = useQueryClient();
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMode, setPayMode] = useState<string>('CASH');
  const [payRef, setPayRef] = useState<string>('');
  const [payRemarks, setPayRemarks] = useState<string>('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['beneficiary-running-bills'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/running-bills');
      return res.data;
    },
  });

  const payMutation = useMutation({
    mutationFn: async (payload: {
      billId: string;
      amount: number;
      paymentMode: string;
      paymentReference?: string;
      remarks?: string;
    }) => {
      const res = await apiClient.post(`/beneficiary/running-bills/${payload.billId}/pay`, {
        amount: payload.amount,
        paymentMode: payload.paymentMode,
        paymentReference: payload.paymentReference,
        remarks: payload.remarks,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-running-bills'] });
      setSelectedBillForPayment(null);
      setPayAmount('');
      setPayRemarks('');
      setPayRef('');
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const isCommissioned = data?.isInfrastructureCommissioned || false;
  const infraStatus = data?.infrastructureStatus || 'NOT_PLANNED';
  const commissionedAt = data?.commissionedAt;
  const runningStartDate = data?.runningChargeStartDate;
  const bills = data?.bills || [];
  const usageRecords = data?.usageRecords || [];

  // Identify latest bill
  const latestBill = bills.length > 0 ? bills[0] : null;
  const latestPending = latestBill ? Number(latestBill.pending_amount ?? (Number(latestBill.amount_due) - Number(latestBill.amount_paid || 0))) : 0;

  const handleOpenPay = (bill: any) => {
    setSelectedBillForPayment(bill);
    const pending = Number(bill.pending_amount ?? (Number(bill.amount_due) - Number(bill.amount_paid || 0)));
    setPayAmount(pending > 0 ? pending.toString() : '');
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBillForPayment) return;
    const amountNum = parseFloat(payAmount);
    if (!amountNum || amountNum <= 0) return;

    payMutation.mutate({
      billId: selectedBillForPayment.running_bill_id,
      amount: amountNum,
      paymentMode: payMode,
      paymentReference: payRef,
      remarks: payRemarks,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Running Water Charges &amp; Operations
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Actual monthly water consumption billing, verified meter collection, and offline payment ledger
        </p>
      </div>

      {/* Commissioning Status Banner */}
      {!isCommissioned ? (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-amber-100 rounded-xl text-amber-800 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-amber-950">
                  Commissioning Gate Notice &bull; Charges Inactive
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-200 text-amber-900">
                  STATUS: {infraStatus}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed max-w-3xl">
                Running charges are not active yet. In accordance with Tamil Nadu irrigation management bylaws, recurring monthly water and pipeline maintenance fees will only commence once your dedicated pipeline infrastructure is officially <strong>COMMISSIONED</strong> by the field engineering authority.
              </p>
              <div className="pt-2">
                <Link
                  href="/beneficiary/infrastructure"
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  <Building2 className="w-4 h-4" />
                  <span>Check Infrastructure Grid Status</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-emerald-950 flex items-center space-x-2">
                <span>Infrastructure Commissioned &bull; Running Charges Active</span>
                <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full font-medium">
                  {infraStatus}
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1">
                Field delivery is commissioned. Running charges apply from{' '}
                <strong>{formatDate(runningStartDate || commissionedAt)}</strong> based on recorded actual water usage.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-emerald-900 bg-emerald-100/70 px-4 py-2.5 rounded-xl">
            <div>
              <span className="text-emerald-700 block text-[10px] uppercase">Commissioned</span>
              {formatDate(commissionedAt)}
            </div>
            <div className="border-l border-emerald-300 h-6"></div>
            <div>
              <span className="text-emerald-700 block text-[10px] uppercase">Charges Start</span>
              {formatDate(runningStartDate || commissionedAt)}
            </div>
          </div>
        </div>
      )}

      {/* Latest Billing Period Highlight Card */}
      {latestBill && (
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-8 -mr-8 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-semibold uppercase tracking-wider">
                  Latest Period: {latestBill.billing_period || latestBill.billing_period_rel?.period_code || 'Current Cycle'}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(latestBill.status)}`}>
                  {latestBill.status}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                Bill #{latestBill.bill_number}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1">
                <div>
                  <span className="text-slate-400 block">Actual Usage</span>
                  <span className="text-sm font-bold text-cyan-300">
                    {formatLitres(latestBill.actual_usage_litres || latestBill.usage_record?.actual_usage_litres || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Running Rate</span>
                  <span className="text-sm font-bold text-slate-200">
                    ₹{Number(latestBill.running_rate_per_litre || latestBill.rate?.running_cost_per_litre || 0).toFixed(2)}/L
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Amount Due</span>
                  <span className="text-sm font-bold text-white">
                    {formatCurrency(latestBill.amount_due)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Due Date</span>
                  <span className="text-sm font-bold text-amber-300">
                    {formatDate(latestBill.due_date)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/15 flex flex-col justify-between min-w-[240px] text-right">
              <div>
                <span className="text-xs text-slate-300 block">Remaining Pending</span>
                <div className="text-3xl font-extrabold text-emerald-400 tracking-tight mt-1">
                  {formatCurrency(latestPending)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Paid: {formatCurrency(latestBill.amount_paid || 0)} / {formatCurrency(latestBill.amount_due)}
                </div>
              </div>
              {latestPending > 0 && (
                <button
                  onClick={() => handleOpenPay(latestBill)}
                  className="mt-4 w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-xs transition flex items-center justify-center space-x-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Pay {formatCurrency(latestPending)}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage & Billing History */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900">Billing &amp; Actual Usage History</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {bills.length} Invoices Recorded
          </span>
        </div>

        {bills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Period / Bill #</th>
                  <th className="py-3 px-4">Actual Usage</th>
                  <th className="py-3 px-4">Rate</th>
                  <th className="py-3 px-4 text-right">Amount Due</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Pending</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill: any) => {
                  const billPending = Number(bill.pending_amount ?? (Number(bill.amount_due) - Number(bill.amount_paid || 0)));
                  return (
                    <tr key={bill.running_bill_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                        <div>{bill.billing_period || bill.billing_period_rel?.period_code || 'Monthly Cycle'}</div>
                        <div className="text-[10px] text-slate-400 font-normal">#{bill.bill_number}</div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {formatLitres(bill.actual_usage_litres || bill.usage_record?.actual_usage_litres || 0)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-mono">
                        ₹{Number(bill.running_rate_per_litre || bill.rate?.running_cost_per_litre || 0).toFixed(2)}/L
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(bill.amount_due)}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-600">
                        {formatCurrency(bill.amount_paid || 0)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-600">
                        {formatCurrency(billPending)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-sans">
                        {formatDate(bill.due_date)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold font-sans border ${getStatusBadgeClass(
                            bill.status
                          )}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {billPending > 0 ? (
                          <button
                            onClick={() => handleOpenPay(bill)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Pay
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium">Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            {isCommissioned
              ? 'No monthly invoices generated yet for the current cycle.'
              : 'Monthly bills will appear here once infrastructure is commissioned.'}
          </div>
        )}
      </div>

      {/* Unbilled Usage Visits (if any) */}
      {usageRecords.filter((u: any) => !u.running_bill).length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Droplets className="w-5 h-5 text-cyan-600" />
            <h2 className="text-base font-bold text-slate-900">Recent Field Usage Recordings (Awaiting Invoice)</h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {usageRecords
              .filter((u: any) => !u.running_bill)
              .map((u: any) => (
                <div key={u.usage_id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{formatDate(u.collection_date)}</span> &bull;{' '}
                    <span className="text-slate-600">{u.billing_period?.period_code || 'Current Period'}</span>
                    <div className="text-[11px] text-slate-400">
                      Period: {formatDate(u.usage_period_start)} &rarr; {formatDate(u.usage_period_end)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-cyan-700 text-sm">{formatLitres(u.actual_usage_litres)}</span>
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                      {u.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Pay Modal */}
      {selectedBillForPayment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Receipt className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Record Bill Payment</h3>
                  <p className="text-xs text-slate-500">Bill #{selectedBillForPayment.bill_number}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBillForPayment(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Period:</span>
                <span className="font-semibold text-slate-800">
                  {selectedBillForPayment.billing_period || selectedBillForPayment.billing_period_rel?.period_code || 'Monthly Cycle'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actual Usage:</span>
                <span className="font-semibold text-slate-800">
                  {formatLitres(selectedBillForPayment.actual_usage_litres || selectedBillForPayment.usage_record?.actual_usage_litres || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Running Rate:</span>
                <span className="font-mono text-slate-800">
                  ₹{Number(selectedBillForPayment.running_rate_per_litre || selectedBillForPayment.rate?.running_cost_per_litre || 0).toFixed(2)}/L
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold">
                <span className="text-slate-700">Total Billed:</span>
                <span className="text-slate-900">{formatCurrency(selectedBillForPayment.amount_due)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Already Paid:</span>
                <span>{formatCurrency(selectedBillForPayment.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-bold text-sm border-t border-slate-200 pt-1">
                <span>Remaining Pending:</span>
                <span>
                  {formatCurrency(
                    Number(selectedBillForPayment.pending_amount ?? (Number(selectedBillForPayment.amount_due) - Number(selectedBillForPayment.amount_paid || 0)))
                  )}
                </span>
              </div>
            </div>

            {/* Payment Form */}
            <form onSubmit={handleConfirmPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) *
                </label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={Number(selectedBillForPayment.pending_amount ?? (Number(selectedBillForPayment.amount_due) - Number(selectedBillForPayment.amount_paid || 0)))}
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="CASH">Cash Payment</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI / Digital</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt / Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="Optional reference"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional collection remarks"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {payMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                  {(payMutation.error as any)?.response?.data?.message || 'Payment recording failed.'}
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedBillForPayment(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payMutation.isPending || !payAmount || parseFloat(payAmount) <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center space-x-1.5"
                >
                  {payMutation.isPending ? (
                    <span>Processing...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Payment</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
