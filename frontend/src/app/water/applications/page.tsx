'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatLitres, formatDate } from '@/lib/utils';
import { Plus, ArrowRight, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { useAuth } from '@/lib/auth-context';

export default function WaterApplicationsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['water-applications', page, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/water/applications', {
        params: { page, limit: 15, status: statusFilter || undefined },
      });
      return res.data;
    },
  });

  const columns: ColumnDef<any>[] = [
    {
      header: 'Submitted Date',
      cell: (app) => (
        <div className="font-mono text-xs">
          <div className="text-slate-900 font-semibold">{formatDate(app.application_date)}</div>
          <div className="text-slate-400 text-[11px]">{app.application_id.slice(0, 8)}...</div>
        </div>
      ),
    },
    {
      header: 'Beneficiary Farmer',
      cell: (app) => (
        <div>
          <div className="font-semibold text-slate-900">{app.beneficiary?.name}</div>
          <div className="text-slate-400 font-mono text-[11px]">{app.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Project Scheme',
      cell: (app) => (
        <span className="text-xs text-slate-700 font-medium">{app.project?.project_name || 'Standard Scheme'}</span>
      ),
    },
    {
      header: 'Required Litres',
      align: 'right',
      cell: (app) => (
        <span className="font-bold text-sky-700 font-mono">
          {formatLitres(app.required_litres)}
        </span>
      ),
    },
    {
      header: 'Approved Litres',
      align: 'right',
      cell: (app) => (
        <span className="font-bold text-indigo-700 font-mono">
          {app.allotment ? formatLitres(app.allotment.approved_litres) : '—'}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (app) => <StatusBadge status={app.status} size="sm" />,
    },
    {
      header: 'Action',
      align: 'right',
      cell: (app) => (
        <Link
          href={`/admin/beneficiaries/${app.beneficiary_id}?tab=water`}
          className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
        >
          View <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Water Requirement Applications"
        description="Volumetric irrigation requests submitted by farmers and field officers across registered land holdings"
        badge="Allocation Registry"
        actions={
          <div className="flex items-center gap-2">
            {user?.role === 'ADMIN' && (
              <Link
                href="/water/approvals"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approvals Queue
              </Link>
            )}
            <Link
              href="/water/applications/new"
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Submit Application
            </Link>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'].map((st) => (
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
            {st ? st.replace('_', ' ') : 'All Applications'}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={data?.items || []}
        isLoading={isLoading}
        emptyTitle="No water applications found"
        emptyDescription="Submit a water allocation application for an active land holding to begin the verification workflow."
        emptyActionLabel="Submit New Application"
        emptyActionHref="/water/applications/new"
        page={page}
        totalPages={data?.meta?.totalPages || 1}
        totalRecords={data?.meta?.total}
        onPageChange={(p) => setPage(p)}
      />
    </div>
  );
}
