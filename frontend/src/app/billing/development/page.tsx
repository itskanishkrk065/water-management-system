'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { Receipt, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DevelopmentBillsPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['development-bills', page, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/billing/development-bills', {
        params: { page, limit: 15, status: statusFilter || undefined },
      });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Development Cost Bills</h1>
          <p className="text-sm text-slate-500 mt-1">
            Capital expenditure billing for approved water allotments divided into 5 installments
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIALLY_PAID', 'PAID'].map((st) => (
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
            {st || 'All Bills'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Bill ID / Date</th>
                <th className="px-5 py-3.5">Beneficiary Farmer</th>
                <th className="px-5 py-3.5">Approved Litres</th>
                <th className="px-5 py-3.5">Total Amount</th>
                <th className="px-5 py-3.5">Amount Paid</th>
                <th className="px-5 py-3.5">Pending Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading development bills...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((b: any) => (
                  <tr key={b.bill_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-mono">
                      <div className="font-bold text-slate-800">{b.bill_id.slice(0, 8)}...</div>
                      <div className="text-slate-400 text-[11px]">{formatDate(b.created_at)}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{b.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{b.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-blue-700">
                      {formatLitres(b.approved_litres_snapshot)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">{formatCurrency(b.total_amount)}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{formatCurrency(b.amount_paid)}</td>
                    <td className="px-5 py-4 font-bold text-rose-600">{formatCurrency(b.pending_amount)}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/beneficiaries/${b.beneficiary_id}?tab=billing`}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-semibold transition"
                      >
                        Installments
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No development bills found.
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
