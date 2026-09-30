'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ArrowRight, Receipt } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';

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

  const columns: ColumnDef<any>[] = [
    {
      header: 'Stage',
      cell: (inst) => (
        <span className="font-bold text-slate-900">
          Stage {inst.installment_number}
        </span>
      ),
    },
    {
      header: 'Beneficiary Farmer',
      cell: (inst) => (
        <div>
          <div className="font-semibold text-slate-900">{inst.bill?.beneficiary?.name}</div>
          <div className="text-slate-400 text-[11px]">
            {inst.bill?.beneficiary?.phone_number}
          </div>
        </div>
      ),
    },
    {
      header: 'Share (%)',
      align: 'right',
      cell: (inst) => <span className="font-semibold text-slate-700">{inst.percentage}%</span>,
    },
    {
      header: 'Due Date',
      cell: (inst) => <span className="text-xs text-slate-600">{formatDate(inst.due_date)}</span>,
    },
    {
      header: 'Amount Due',
      align: 'right',
      cell: (inst) => (
        <span className="font-bold text-slate-900 currency-value">{formatCurrency(inst.amount_due)}</span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      cell: (inst) => (
        <span className="font-semibold text-emerald-700 currency-value">{formatCurrency(inst.amount_paid)}</span>
      ),
    },
    {
      header: 'Pending Balance',
      align: 'right',
      cell: (inst) => (
        <span className="font-bold text-rose-600 currency-value">{formatCurrency(inst.pending_amount)}</span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (inst) => <StatusBadge status={inst.status} size="sm" />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (inst) => (
        <Link
          href={`/admin/beneficiaries/${inst.bill?.beneficiary?.beneficiary_id}?tab=billing`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          View <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="5-Stage Installments"
        description="Tracking Stage 1 (2.5%) through Stage 5 (27.5%) across all approved development commitments"
        actions={
          <Link
            href="/billing/development"
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
          >
            <Receipt className="w-3.5 h-3.5" /> Development Bills
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((st) => (
          <button
            key={st}
            onClick={() => {
              setStatusFilter(st);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              statusFilter === st
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st ? st.replace('_', ' ') : 'All Stages'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No installments found"
        emptyDescription="Installment records will appear once water applications are approved and development bills generated."
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
