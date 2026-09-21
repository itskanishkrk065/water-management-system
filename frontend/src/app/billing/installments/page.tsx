'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { Layers, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function InstallmentsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['all-installments', page, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/billing/installments', {
        params: { page, limit: 20, status: statusFilter || undefined },
      });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">5-Stage Installment Ledger</h1>
        <p className="text-sm text-slate-500 mt-1">
          Tracking Stage 1 (2.5%) through Stage 5 (27.5%) across all approved development commitments
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st || 'All Stages'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Stage</th>
                <th className="px-5 py-3.5">Farmer Beneficiary</th>
                <th className="px-5 py-3.5">Share (%)</th>
                <th className="px-5 py-3.5">Due Date</th>
                <th className="px-5 py-3.5">Amount Due</th>
                <th className="px-5 py-3.5">Amount Paid</th>
                <th className="px-5 py-3.5">Pending Balance</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-slate-400">
                    Loading installments...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((inst: any) => (
                  <tr key={inst.installment_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      Installment #{inst.installment_number}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{inst.bill?.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">
                        {inst.bill?.beneficiary?.phone_number}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{inst.percentage}%</td>
                    <td className="px-5 py-4 font-mono text-slate-600">{formatDate(inst.due_date)}</td>
                    <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(inst.amount_due)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{formatCurrency(inst.amount_paid)}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">{formatCurrency(inst.pending_amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(inst.status)}`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/beneficiaries/${inst.bill?.beneficiary?.beneficiary_id}?tab=billing`}
                        className="inline-flex items-center px-3 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded text-xs font-semibold transition"
                      >
                        Details
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                    No installments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
