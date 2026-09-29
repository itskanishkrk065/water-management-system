'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  formatCurrency,
  formatLitres,
  formatAcres,
  formatDate,
  getStatusBadgeClass,
} from '@/lib/utils';
import {
  Users,
  Layers,
  Droplet,
  Receipt,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  FileSpreadsheet,
  FileCheck,
  ArrowUpRight,
  ExternalLink,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

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

  return (
    <div className="space-y-6">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              Live Registry
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Authoritative operational metrics, water distribution accounting, and financial integrity reconciliation
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === 'ADMIN' && (
            <Link
              href="/admin/project-schemes"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" /> Project Schemes
            </Link>
          )}
          <Link
            href="/beneficiaries/new"
            className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Onboard Beneficiary
          </Link>
          <Link
            href="/water/applications/new"
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Water Application
          </Link>
          {!isFieldOfficer && (
            <Link
              href="/payments"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
            >
              <Receipt className="w-3.5 h-3.5" /> Record Payment
            </Link>
          )}
          <Link
            href="/reports/find"
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Canonical Reports
          </Link>
        </div>
      </div>

      {/* Dynamic Operational Filter Bar */}
      <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-sky-600" /> Operational Scoping Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-semibold">
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
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
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
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
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
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
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
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
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
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full text-xs rounded-lg border-slate-300 bg-white py-1.5 px-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Beneficiaries Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Beneficiaries</span>
              <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">
              {statsLoading ? '...' : (stats?.beneficiaries?.total ?? stats?.total_beneficiaries ?? 0)}
            </div>
            <div className="mt-1 text-xs text-slate-500">Farmers in project scope</div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-emerald-600 font-semibold">
              Active: {stats?.beneficiaries?.active ?? stats?.total_beneficiaries ?? 0}
            </span>
            <span className="text-slate-400">
              Inactive: {stats?.beneficiaries?.inactive ?? 0}
            </span>
          </div>
        </div>

        {/* Land Holdings Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Land Registered</span>
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">
              {statsLoading ? '...' : formatAcres(stats?.land?.total_active_acres ?? stats?.total_land_acres)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {stats?.land?.active_holdings ?? 0} active SF parcels
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Total Holdings: {stats?.land?.total_holdings ?? 0}
            </span>
            <span className="text-slate-400">
              Gross: {formatAcres(stats?.land?.total_land_acres)}
            </span>
          </div>
        </div>

        {/* Water Allocation Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Water Allotted</span>
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                <Droplet className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900">
              {statsLoading ? '...' : formatLitres(stats?.water?.total_approved_litres ?? stats?.total_approved_litres)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Requested: {formatLitres(stats?.water?.total_required_litres)}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-blue-700 font-semibold">
              Approved Apps: {stats?.water?.approved_applications ?? 0}
            </span>
            <span className="text-amber-600 font-medium">
              Pending: {stats?.water?.submitted_applications ?? 0}
            </span>
          </div>
        </div>

        {/* Financial / Billing Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Development Billing</span>
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            {isFieldOfficer ? (
              <div className="mt-3 py-2 text-xs font-medium text-slate-400 italic">
                Restricted for Field Officers
              </div>
            ) : (
              <>
                <div className="mt-3 text-3xl font-extrabold text-slate-900">
                  {statsLoading ? '...' : formatCurrency(stats?.financial?.total_development_billing ?? stats?.total_development_billing)}
                </div>
                <div className="mt-1 text-xs text-slate-500">Total capital infrastructure cost</div>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {isFieldOfficer ? (
              <span className="text-slate-400">Financial Role Required</span>
            ) : (
              <>
                <span className="text-emerald-600 font-semibold">
                  Paid: {formatCurrency(stats?.financial?.total_collected ?? stats?.total_collected)}
                </span>
                <span className="text-rose-600 font-semibold">
                  Pending: {formatCurrency(stats?.financial?.total_pending ?? stats?.total_pending)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Financial Health & Data Quality Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Collections Overview */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">Collections Realized</span>
              <TrendingUp className="w-5 h-5 text-emerald-200" />
            </div>
            {isFieldOfficer ? (
              <p className="mt-3 text-sm text-emerald-100 italic">Financials hidden under RBAC</p>
            ) : (
              <>
                <div className="mt-2 text-2xl font-black">
                  {formatCurrency(stats?.financial?.total_collected ?? stats?.total_collected)}
                </div>
                <p className="text-xs text-emerald-100 mt-1">Verified offline receipts deposited</p>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-400/40 text-xs flex justify-between items-center">
            <span>Pending Collections:</span>
            <strong>{isFieldOfficer ? '---' : formatCurrency(stats?.financial?.total_pending ?? stats?.total_pending)}</strong>
          </div>
        </div>

        {/* Installments Due Overview */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-5 rounded-2xl text-white shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-100">Installment Schedule</span>
              <Clock className="w-5 h-5 text-amber-200" />
            </div>
            {isFieldOfficer ? (
              <p className="mt-3 text-sm text-amber-100 italic">Financials hidden under RBAC</p>
            ) : (
              <>
                <div className="mt-2 text-2xl font-black">
                  {stats?.financial?.pending_installments_count ?? 0} Pending
                </div>
                <p className="text-xs text-amber-100 mt-1">
                  Overdue installments: <strong className="text-white">{stats?.financial?.overdue_installments_count ?? 0}</strong>
                </p>
              </>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-amber-400/40 text-xs flex justify-between items-center">
            <Link href="/payments" className="hover:underline flex items-center gap-1 font-semibold">
              Open Payment Ledger <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Data Quality & Integrity Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Data Integrity Health</span>
              {stats?.data_quality?.status === 'PASS' ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`text-lg font-bold px-2.5 py-0.5 rounded-lg border ${
                  stats?.data_quality?.status === 'PASS'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {stats?.data_quality?.status || 'PASS'}
              </span>
              <span className="text-xs text-slate-500">
                {stats?.data_quality?.errorChecks ?? 0} errors • {stats?.data_quality?.warningChecks ?? 0} warnings
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              All 1-to-1 holding invariants &amp; payment checksums authoritative
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              href="/admin/integrity"
              className="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1"
            >
              Run Integrity Check <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Action Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Water Applications Awaiting Decision</h2>
              <p className="text-xs text-slate-500">Submitted by field officers requiring administrator approval</p>
            </div>
            <Link
              href="/water/approvals"
              className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1"
            >
              Review All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Beneficiary</th>
                  <th className="px-4 py-3">Location / Scheme</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentActivity?.recent_applications?.length > 0 ? (
                  recentActivity.recent_applications.map((app: any) => (
                    <tr key={app.application_id || app.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{app.beneficiary?.name}</div>
                        <div className="text-xs text-slate-400 font-normal">{app.beneficiary?.phone_number}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <div>{app.beneficiary?.village?.name || 'Village'}</div>
                        <div className="text-[11px] text-slate-400">{app.project?.name || 'Scheme'}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-sky-700">
                        {formatLitres(app.required_litres)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/water/approvals`}
                          className="px-2.5 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-lg text-xs font-semibold transition"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                      No applications currently awaiting approval
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Payments & Collections Stream */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Payment Ledger Activity</h2>
              <p className="text-xs text-slate-500">Authoritative collection ledger transactions</p>
            </div>
            <Link
              href="/payments"
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center gap-1"
            >
              Full Ledger <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Beneficiary</th>
                  <th className="px-4 py-3">Receipt / Ref</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isFieldOfficer ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400 italic">
                      Payment history is restricted for Field Officers
                    </td>
                  </tr>
                ) : recentActivity?.recent_payments?.length > 0 ? (
                  recentActivity.recent_payments.map((p: any) => (
                    <tr key={p.payment_id || p.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{p.beneficiary?.name}</div>
                        <div className="text-xs text-slate-400 font-normal">{p.beneficiary?.phone_number}</div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600">
                        {p.receipt_number || p.payment_reference || 'REF-PAY'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-500">
                        {formatDate(p.payment_date || p.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                      No recent payment transactions recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
