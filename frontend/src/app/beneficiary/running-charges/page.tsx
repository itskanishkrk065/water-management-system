'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryRunningChargesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['beneficiary-running-bills'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/running-bills');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const isCommissioned = data?.isInfrastructureCommissioned || false;
  const infraStatus = data?.infrastructureStatus || 'NOT_PLANNED';
  const commissionedAt = data?.commissionedAt;
  const bills = data?.bills || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Monthly Running Charges &amp; Maintenance
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Recurring operational billing for ongoing water release, network maintenance, and canal upkeep
        </p>
      </div>

      {/* Strict Commissioning Gate Check */}
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
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 flex items-start space-x-4">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-800 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold text-emerald-950 flex items-center space-x-2">
              <span>Infrastructure Commissioned &bull; Running Charges Active</span>
              <span className="text-xs bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                {formatDate(commissionedAt)}
              </span>
            </div>
            <p className="text-xs text-emerald-800 mt-1">
              Your field pipeline is active and commissioned. Monthly recurring invoices are generated at the end of each billing cycle.
            </p>
          </div>
        </div>
      )}

      {/* Running Bills Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-bold text-slate-900">Monthly Billing Cycles</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {bills.length} Invoices
          </span>
        </div>

        {bills.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Billing Period</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((bill: any) => (
                  <tr key={bill.running_bill_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 font-sans">
                      {bill.billing_period || 'Monthly Cycle'}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDate(bill.bill_date || bill.created_at)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDate(bill.due_date)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(bill.amount_due)}
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
                  </tr>
                ))}
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
    </div>
  );
}
