'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
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
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/stats');
      return res.data;
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/pending-approvals');
      return res.data;
    },
  });

  const { data: infraQueue } = useQuery({
    queryKey: ['infrastructure-queue'],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/infrastructure-queue');
      return res.data;
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time telemetry, water distribution metrics, and financial audit reconciliation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/beneficiaries/new"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Onboard Beneficiary
          </Link>
          <Link
            href="/water/applications/new"
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-sm font-semibold rounded-lg shadow-sm transition"
          >
            + Water Application
          </Link>
          <Link
            href="/payments"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Record Payment
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Beneficiaries
            </span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : stats?.total_beneficiaries ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">Farmers enrolled in project</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Active Land
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : formatAcres(stats?.total_land_acres)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Sum of verified SF parcels</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Approved Litres
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Droplet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : formatLitres(stats?.total_approved_litres)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Allotted water quota</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Development Billing
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {statsLoading ? '...' : formatCurrency(stats?.total_development_billing)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Total capital infrastructure cost</div>
        </div>
      </div>

      {/* Financial Recovery & Queue Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Collected
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-emerald-600">
            {statsLoading ? '...' : formatCurrency(stats?.total_collected)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Verified payment ledger sum</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Collections
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-rose-600">
            {statsLoading ? '...' : formatCurrency(stats?.total_pending)}
          </div>
          <div className="mt-1 text-xs text-slate-500">Uncollected installment dues</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-amber-600">
            {statsLoading ? '...' : stats?.pending_approvals_count ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <Link href="/water/approvals" className="text-sky-600 hover:underline">
              Review applications &rarr;
            </Link>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Awaiting Commissioning
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-purple-600">
            {statsLoading ? '...' : stats?.infrastructure_awaiting_commissioning_count ?? 0}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            <Link href="/infrastructure" className="text-sky-600 hover:underline">
              Pipeline grid &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Action Queues Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Approvals Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Water Applications Awaiting Approval</h2>
              <p className="text-xs text-slate-500">Submitted by field officers requiring administrator decision</p>
            </div>
            <Link href="/water/approvals" className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Beneficiary</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingApprovals && pendingApprovals.length > 0 ? (
                  pendingApprovals.map((app: any) => (
                    <tr key={app.application_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{app.beneficiary?.name}</div>
                        <div className="text-xs text-slate-500">{app.beneficiary?.phone_number}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {app.beneficiary?.village?.name}, {app.beneficiary?.district?.name}
                      </td>
                      <td className="px-4 py-3 font-semibold text-sky-700">
                        {formatLitres(app.required_litres)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/water/approvals`}
                          className="px-3 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded text-xs font-semibold transition"
                        >
                          Approve
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
                      No applications currently awaiting approval
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Infrastructure Queue */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Infrastructure Lifecycle Queue</h2>
              <p className="text-xs text-slate-500">Pipeline execution required before running charges can activate</p>
            </div>
            <Link href="/infrastructure" className="text-xs font-semibold text-sky-600 hover:text-sky-800 flex items-center">
              View Grid <ArrowRight className="w-3 h-3 ml-1" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Beneficiary</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {infraQueue && infraQueue.length > 0 ? (
                  infraQueue.map((item: any) => (
                    <tr key={item.infrastructure_id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{item.beneficiary?.name}</div>
                        <div className="text-xs text-slate-500">{item.beneficiary?.phone_number}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClass(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/infrastructure`}
                          className="px-3 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded text-xs font-semibold transition"
                        >
                          Update Status
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                      All infrastructure commissioned
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
