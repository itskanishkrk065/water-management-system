'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  formatCurrency,
  formatLitres,
  formatAcres,
  formatDate,
} from '@/lib/utils';
import {
  Users,
  Layers,
  Droplets,
  Receipt,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import StatusBadge from '@/components/ui/StatusBadge';
import KPICard from '@/components/ui/KPICard';
import PageHeader from '@/components/ui/PageHeader';
import DataTable, { ColumnDef } from '@/components/ui/DataTable';

export default function DashboardPage() {
  const { user } = useAuth();
  const isFieldOfficer = user?.role === 'FIELD_OFFICER';

  // Filters State
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Dropdown Metadata Queries
  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
  });

  const { data: villages = [] } = useQuery({
    queryKey: ['villages', selectedDistrict],
    queryFn: async () => {
      const res = await apiClient.get('/locations/villages');
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-active'],
    queryFn: async () => {
      const res = await apiClient.get('/projects/active');
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
  });

  // Authoritative Dashboard Stats Query
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useQuery({
    queryKey: [
      'dashboard-stats',
      selectedDistrict,
      selectedVillage,
      selectedProject,
      selectedStatus,
      dateFrom,
      dateTo,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/stats', {
        params: {
          districtId: selectedDistrict || undefined,
          villageId: selectedVillage || undefined,
          projectId: selectedProject || undefined,
          status: selectedStatus || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      return res.data;
    },
  });

  // Recent Activity & Operations Query
  const { data: recentActivity, isLoading: activityLoading } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/recent-activity');
      return res.data;
    },
  });

  const handleResetFilters = () => {
    setSelectedDistrict('');
    setSelectedVillage('');
    setSelectedProject('');
    setSelectedStatus('');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = Boolean(
    selectedDistrict || selectedVillage || selectedProject || selectedStatus || dateFrom || dateTo,
  );

  // Table Columns Definition
  const pendingApprovalColumns: ColumnDef<any>[] = [
    {
      header: 'Beneficiary Farmer',
      cell: (app) => (
        <div>
          <div className="font-semibold text-slate-900">{app.beneficiary?.name}</div>
          <div className="text-[11px] font-mono text-slate-400">{app.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Location / Scheme',
      cell: (app) => (
        <div className="text-xs">
          <div className="text-slate-700 font-medium">{app.beneficiary?.village?.name || 'Village'}</div>
          <div className="text-[11px] text-slate-400">{app.project?.project_name || 'Scheme'}</div>
        </div>
      ),
    },
    {
      header: 'Requested Volume',
      align: 'right',
      cell: (app) => (
        <span className="font-semibold text-sky-700 font-mono text-xs">
          {formatLitres(app.required_litres)}
        </span>
      ),
    },
    {
      header: 'Status',
      align: 'center',
      cell: (app) => <StatusBadge status={app.status} size="sm" />,
    },
    {
      header: 'Submitted',
      align: 'right',
      cell: (app) => (
        <span className="font-mono text-[11px] text-slate-500">
          {formatDate(app.application_date || app.created_at)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (app) => (
        <Link
          href={`/water/applications`}
          className="text-xs font-semibold text-sky-600 hover:text-sky-800 transition"
        >
          Inspect →
        </Link>
      ),
    },
  ];

  const paymentColumns: ColumnDef<any>[] = [
    {
      header: 'Receipt & Beneficiary',
      cell: (p) => (
        <div>
          <div className="font-mono font-semibold text-slate-900 text-xs">{p.receipt_number || 'REC-PENDING'}</div>
          <div className="text-[11px] text-slate-500">{p.developmentBill?.beneficiary?.name || 'Farmer'}</div>
        </div>
      ),
    },
    {
      header: 'Installment',
      cell: (p) => (
        <span className="text-xs font-medium text-slate-700">
          {p.installment ? `Stage ${p.installment.installment_number}` : 'Standard Payment'}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      cell: (p) => (
        <span className="font-mono font-bold text-emerald-700 text-xs">
          {formatCurrency(p.amount)}
        </span>
      ),
    },
    {
      header: 'Mode',
      align: 'center',
      cell: (p) => (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
          {p.payment_mode || 'OFFLINE'}
        </span>
      ),
    },
    {
      header: 'Date',
      align: 'right',
      cell: (p) => (
        <span className="font-mono text-[11px] text-slate-500">
          {formatDate(p.payment_date || p.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Page Header */}
      <PageHeader
        title="Dashboard"
        description="Overview of beneficiaries, water allocation, billing and collections."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/beneficiaries/new"
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Beneficiary
            </Link>
            <Link
              href="/water/applications/new"
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Water Application
            </Link>
            {!isFieldOfficer && (
              <Link
                href="/payments"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" /> Record Payment
              </Link>
            )}
            <Link
              href="/reports/find"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Reports
            </Link>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white p-3 sm:p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-sky-600" /> Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-semibold">
                Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All Districts</option>
              {(Array.isArray(districts) ? districts : []).map((d: any) => (
                <option key={d.district_id} value={d.district_id}>
                  {d.district_name || d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Village</label>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All Villages</option>
              {(Array.isArray(villages) ? villages : []).map((v: any) => (
                <option key={v.village_id} value={v.village_id}>
                  {v.village_name || v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Project Scheme</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All Schemes</option>
              {(Array.isArray(projects) ? projects : []).map((p: any) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_name} ({p.project_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-0.5">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-200 bg-slate-50 py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Beneficiaries"
          value={statsLoading ? '...' : (stats?.beneficiaries?.total ?? stats?.total_beneficiaries ?? 0)}
          subtitle={`Active: ${stats?.beneficiaries?.active ?? stats?.total_beneficiaries ?? 0}`}
          icon={Users}
          iconVariant="sky"
        />

        <KPICard
          title="Land Holdings"
          value={statsLoading ? '...' : formatAcres(stats?.land?.total_active_acres ?? stats?.total_land_acres)}
          subtitle={`${stats?.land?.active_holdings ?? 0} active holdings`}
          icon={Layers}
          iconVariant="emerald"
        />

        <KPICard
          title="Water Allotted"
          value={statsLoading ? '...' : formatLitres(stats?.water?.total_approved_litres ?? stats?.total_approved_litres)}
          subtitle={`Approved apps: ${stats?.water?.approved_applications ?? 0}`}
          icon={Droplets}
          iconVariant="indigo"
        />

        <KPICard
          title="Development Billing"
          value={
            isFieldOfficer
              ? 'Restricted'
              : statsLoading
              ? '...'
              : formatCurrency(stats?.financial?.total_development_billing ?? stats?.total_development_billing)
          }
          subtitle={
            isFieldOfficer
              ? 'Financial Role Required'
              : `Collected ${formatCurrency(stats?.financial?.total_collected ?? 0)} • Pending ${formatCurrency(stats?.financial?.total_pending ?? 0)}`
          }
          icon={Receipt}
          iconVariant="amber"
        />
      </div>

      {/* Secondary Operational Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Collections */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Collections</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                <CheckCircle className="w-3.5 h-3.5" />
              </div>
            </div>
            {isFieldOfficer ? (
              <p className="mt-2 text-xs text-slate-400 italic">Financial data restricted under RBAC</p>
            ) : (
              <>
                <div className="mt-1 text-xl font-bold font-mono text-slate-900">
                  {formatCurrency(stats?.financial?.total_collected ?? stats?.total_collected)}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Verified receipts recorded</p>
              </>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] flex justify-between items-center text-slate-600">
            <span>Pending Balance:</span>
            <strong className="text-rose-600 font-mono">
              {isFieldOfficer ? '---' : formatCurrency(stats?.financial?.total_pending ?? stats?.total_pending)}
            </strong>
          </div>
        </div>

        {/* Installments */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Installments</span>
              <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            {isFieldOfficer ? (
              <p className="mt-2 text-xs text-slate-400 italic">Financial data restricted under RBAC</p>
            ) : (
              <>
                <div className="mt-1 text-xl font-bold font-mono text-slate-900">
                  {stats?.financial?.pending_installments_count ?? 0} Pending
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Overdue: <strong className="text-rose-600 font-mono">{stats?.financial?.overdue_installments_count ?? 0}</strong>
                </p>
              </>
            )}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] flex justify-between items-center">
            <Link href="/billing/installments" className="text-sky-600 hover:text-sky-800 flex items-center gap-1 font-semibold">
              View Schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Data Integrity */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Data Integrity</span>
              {stats?.data_quality?.status === 'PASS' ? (
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                  <ShieldAlert className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={stats?.data_quality?.status || 'PASS'} size="sm" />
              <span className="text-[11px] text-slate-500">
                {stats?.data_quality?.errorChecks ?? 0} errors • {stats?.data_quality?.warningChecks ?? 0} warnings
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Database relations &amp; financial balances verified
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <Link
              href="/admin/integrity"
              className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
            >
              Run Audit <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Action Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Water Applications</h2>
              <p className="text-[11px] text-slate-500">Submitted applications requiring review</p>
            </div>
            <Link
              href="/water/approvals"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              Review All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <DataTable
            columns={pendingApprovalColumns}
            data={recentActivity?.recent_applications || []}
            isLoading={activityLoading}
            emptyTitle="No applications awaiting decision"
            emptyDescription="Submitted water applications will appear here."
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Recent Payment Ledger Activity</h2>
              <p className="text-[11px] text-slate-500">Collection transactions recorded</p>
            </div>
            <Link
              href="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              Full Ledger <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <DataTable
            columns={paymentColumns}
            data={isFieldOfficer ? [] : recentActivity?.recent_payments || []}
            isLoading={activityLoading}
            emptyTitle={isFieldOfficer ? 'Payment Ledger Restricted' : 'No recent payments'}
            emptyDescription={
              isFieldOfficer
                ? 'Field Officer role cannot inspect payment records.'
                : 'Payment collections will appear here.'
            }
          />
        </div>
      </div>
    </div>
  );
}
