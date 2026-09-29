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
  Droplet,
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
        <span className="font-semibold text-sky-700 font-mono">
          {formatLitres(app.required_litres)}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (app) => (
        <Link
          href="/water/approvals"
          className="inline-flex items-center gap-1 px-3 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition"
        >
          Review <ArrowRight className="w-3 h-3" />
        </Link>
      ),
    },
  ];

  const paymentColumns: ColumnDef<any>[] = [
    {
      header: 'Beneficiary',
      cell: (p) => (
        <div>
          <div className="font-semibold text-slate-900">{p.beneficiary?.name}</div>
          <div className="text-[11px] font-mono text-slate-400">{p.beneficiary?.phone_number}</div>
        </div>
      ),
    },
    {
      header: 'Receipt / Ref',
      cell: (p) => (
        <span className="font-mono text-xs text-slate-600">
          {p.receipt_number || p.payment_reference || 'REF-PAY'}
        </span>
      ),
    },
    {
      header: 'Amount Paid',
      align: 'right',
      cell: (p) => (
        <span className="font-bold text-emerald-700 font-mono">
          {formatCurrency(p.amount)}
        </span>
      ),
    },
    {
      header: 'Date',
      align: 'right',
      cell: (p) => (
        <span className="text-xs text-slate-500 font-mono">
          {formatDate(p.payment_date || p.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader
        title="Executive Dashboard"
        description="Authoritative operational metrics, quota allocation accounting, and data integrity reconciliation"
        badge="Live Registry"
        badgeVariant="info"
        actions={
          <>
            {user?.role === 'ADMIN' && (
              <Link
                href="/admin/project-schemes"
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" /> Project Schemes
              </Link>
            )}
            <Link
              href="/beneficiaries/new"
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Onboard Beneficiary
            </Link>
            <Link
              href="/water/applications/new"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Water Application
            </Link>
            {!isFieldOfficer && (
              <Link
                href="/payments"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" /> Record Payment
              </Link>
            )}
            <Link
              href="/reports/find"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Canonical Reports
            </Link>
          </>
        }
      />

      {/* Operational Filter Ribbon */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-sky-600" /> Operational Scoping Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-semibold">
                Filters Active
              </span>
            )}
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Village</label>
            <select
              value={selectedVillage}
              onChange={(e) => setSelectedVillage(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Project Scheme</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Application Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
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
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-2.5 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPICard
          title="Beneficiaries"
          value={statsLoading ? '...' : (stats?.beneficiaries?.total ?? stats?.total_beneficiaries ?? 0)}
          subtitle={`Active: ${stats?.beneficiaries?.active ?? stats?.total_beneficiaries ?? 0}`}
          contextBadge={<StatusBadge status="ACTIVE" size="sm" showIcon={false} />}
          icon={Users}
          iconVariant="sky"
        />

        <KPICard
          title="Land Registered"
          value={statsLoading ? '...' : formatAcres(stats?.land?.total_active_acres ?? stats?.total_land_acres)}
          subtitle={`${stats?.land?.active_holdings ?? 0} active SF parcels`}
          contextBadge={<span className="text-[11px] font-mono text-slate-500">Gross: {formatAcres(stats?.land?.total_land_acres)}</span>}
          icon={Layers}
          iconVariant="emerald"
        />

        <KPICard
          title="Water Allotted"
          value={statsLoading ? '...' : formatLitres(stats?.water?.total_approved_litres ?? stats?.total_approved_litres)}
          subtitle={`Approved Apps: ${stats?.water?.approved_applications ?? 0}`}
          contextBadge={<span className="text-[11px] font-mono text-slate-500">Req: {formatLitres(stats?.water?.total_required_litres)}</span>}
          icon={Droplet}
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
              : `Collected: ${formatCurrency(stats?.financial?.total_collected ?? stats?.total_collected)}`
          }
          contextBadge={
            !isFieldOfficer && (
              <span className="text-[11px] font-mono text-rose-600 font-semibold">
                Pending: {formatCurrency(stats?.financial?.total_pending ?? stats?.total_pending)}
              </span>
            )
          }
          icon={Receipt}
          iconVariant="amber"
        />
      </div>

      {/* Operational Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {/* Collections Overview */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Collections Realized</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            {isFieldOfficer ? (
              <p className="mt-3 text-sm text-slate-400 italic">Financial data restricted under RBAC</p>
            ) : (
              <>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCurrency(stats?.financial?.total_collected ?? stats?.total_collected)}
                </div>
                <p className="text-xs text-slate-500 mt-1">Verified offline receipts deposited</p>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex justify-between items-center text-slate-600">
            <span>Pending Balance:</span>
            <strong className="text-rose-600 font-mono">
              {isFieldOfficer ? '---' : formatCurrency(stats?.financial?.total_pending ?? stats?.total_pending)}
            </strong>
          </div>
        </div>

        {/* Installment Schedule */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Installment Ledger</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            {isFieldOfficer ? (
              <p className="mt-3 text-sm text-slate-400 italic">Financial data restricted under RBAC</p>
            ) : (
              <>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {stats?.financial?.pending_installments_count ?? 0} Pending
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Overdue installments: <strong className="text-rose-600 font-mono">{stats?.financial?.overdue_installments_count ?? 0}</strong>
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs flex justify-between items-center">
            <Link href="/billing/installments" className="text-sky-600 hover:text-sky-800 flex items-center gap-1 font-semibold">
              View Schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Data Quality & Integrity Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Data Integrity Health</span>
              {stats?.data_quality?.status === 'PASS' ? (
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              ) : (
                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                  <ShieldAlert className="w-4 h-4" />
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={stats?.data_quality?.status || 'PASS'} />
              <span className="text-xs text-slate-500">
                {stats?.data_quality?.errorChecks ?? 0} errors • {stats?.data_quality?.warningChecks ?? 0} warnings
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              All 1-to-1 holding invariants &amp; payment checksums authoritative
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/admin/integrity"
              className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
            >
              Run Diagnostic Audit <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Action Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Water Applications Awaiting Decision</h2>
              <p className="text-xs text-slate-500">Submitted by field staff requiring approval</p>
            </div>
            <Link
              href="/water/approvals"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              Review All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <DataTable
            columns={pendingApprovalColumns}
            data={recentActivity?.recent_applications || []}
            isLoading={activityLoading}
            emptyTitle="No applications awaiting decision"
            emptyDescription="All submitted water applications have been processed and approved."
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Payment Ledger Activity</h2>
              <p className="text-xs text-slate-500">Authoritative collection ledger transactions</p>
            </div>
            <Link
              href="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              Full Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <DataTable
            columns={paymentColumns}
            data={isFieldOfficer ? [] : recentActivity?.recent_payments || []}
            isLoading={activityLoading}
            emptyTitle={isFieldOfficer ? 'Payment Ledger Restricted' : 'No payment transactions'}
            emptyDescription={
              isFieldOfficer
                ? 'Field Officer role cannot inspect financial payment records.'
                : 'No recent payment collections recorded in the database.'
            }
          />
        </div>
      </div>
    </div>
  );
}
