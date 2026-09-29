'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate } from '@/lib/utils';
import { Receipt, ArrowRight, Layers, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';

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

  const columns: ColumnDef<any>[] = [
    {
      header: 'Bill ID / Created',
      cell: (b) => (
        <div className="font-mono text-xs">
          <div className="font-bold text-slate-800">{b.bill_id.slice(0, 8)}...</div>
          <div className="text-slate-400 text-[11px]">{formatDate(b.created_at)}</div>
        </div>
      ),
    },
    {
      header: 'Beneficiary Farmer',
      cell: (b) => (
        <div>
          <div className="font-semibold text-slate-900">{b.beneficiary?.name}</div>
          <div className="text-slate-400 font-mono text-[11px]">{b.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Approved Litres',
      align: 'right',
      cell: (b) => (
        <span className="font-semibold text-sky-700 font-mono">
          {formatLitres(b.approved_litres_snapshot)}
        </span>
      ),
    },
    {
      header: 'Total Amount',
      align: 'right',
      cell: (b) => (
        <span className="font-bold text-slate-900 font-mono">
          {formatCurrency(b.total_amount)}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      cell: (b) => (
        <span className="font-semibold text-emerald-700 font-mono">
          {formatCurrency(b.amount_paid)}
        </span>
      ),
    },
    {
      header: 'Pending Balance',
      align: 'right',
      cell: (b) => (
        <span className="font-bold text-rose-600 font-mono">
          {formatCurrency(b.pending_amount)}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (b) => <StatusBadge status={b.status} size="sm" />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (b) => (
        <Link
          href={`/admin/beneficiaries/${b.beneficiary_id}?tab=billing`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          View Bill <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Development Cost Bills"
        description="Capital expenditure billing for approved water allotments divided into 5 installment stages"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/billing/installments"
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" /> 5-Stage Installments
            </Link>
            <Link
              href="/reports/find"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reports
            </Link>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIALLY_PAID', 'PAID'].map((st) => (
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
            {st ? st.replace('_', ' ') : 'All Bills'}
          </button>
        ))}
      </div>

      {/* Primary Data Table */}
      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No development bills yet"
        emptyDescription="Development bills will appear here automatically once an approved water application is generated."
        emptyActionLabel="View Water Applications"
        emptyActionHref="/water/applications"
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
