'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  MapPin,
  Droplets,
  CreditCard,
  Building2,
  CalendarDays,
  ArrowRight,
  CheckCircle2,
  Clock,
  PlusCircle,
  FileCheck2,
  AlertCircle,
  Layers,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryDashboardPage() {
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['beneficiary-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/dashboard');
      return res.data;
    },
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['beneficiary-me'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/me');
      return res.data;
    },
  });

  if (dashLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const metrics = dashboard?.metrics;
  const b = dashboard?.beneficiary;
  const latestApp = dashboard?.latestApplication;
  const activeAllotment = dashboard?.activeAllotment;
  const nextInst = dashboard?.nextInstallment;
  const infra = dashboard?.infrastructure;
  const running = dashboard?.runningCharges;
  const completion = profile?.completionPercent ?? 100;
  const checklist = profile?.checklist || [];

  return (
    <div className="space-y-8">
      {/* Welcome Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white rounded-2xl p-6 sm:p-8 shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Beneficiary Portal &bull; Live Quota &amp; Billing</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Vanakkam, {b?.name || 'Beneficiary'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Village: <span className="font-semibold text-white">{b?.village || 'Not specified'}</span> &bull; Mobile: <span className="text-white font-medium">{b?.phone || '—'}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href="/beneficiary/land/new"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs sm:text-sm rounded-xl shadow transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Land</span>
            </Link>
            <Link
              href="/beneficiary/water/apply"
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm rounded-xl border border-white/20 backdrop-blur-sm transition"
            >
              <Droplets className="w-4 h-4" />
              <span>Apply for Water</span>
            </Link>
          </div>
        </div>

        {/* Profile Completion Checklist Strip */}
        <div className="mt-6 pt-6 border-t border-slate-700/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
              <span>Onboarding &amp; Profile Completion</span>
              <span className="text-amber-400 font-bold">{completion}%</span>
            </div>
            {completion < 100 && (
              <Link
                href="/beneficiary/profile"
                className="text-xs text-amber-400 hover:text-amber-300 font-medium inline-flex items-center"
              >
                Complete Remaining Steps &rarr;
              </Link>
            )}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden mb-3">
            <div
              className={`h-full transition-all duration-500 ${
                completion === 100 ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${completion}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {checklist.map((item: any) => (
              <div
                key={item.id}
                className={`p-2 rounded-lg border flex items-center space-x-2 ${
                  item.completed
                    ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                    : 'bg-slate-800/50 border-slate-700 text-slate-400'
                }`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 shrink-0 ${
                    item.completed ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6 Key Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Metric 1: Total Land */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Land Holding
            </span>
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatAcres(metrics?.totalLandAcres)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center space-x-2">
              <span>{metrics?.holdingsCount || 0} Holdings</span>
              <span>&bull;</span>
              <span>{metrics?.parcelsCount || 0} Survey Parcels</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/land"
              className="text-xs text-amber-700 hover:text-amber-800 font-semibold inline-flex items-center"
            >
              View Holdings &rarr;
            </Link>
          </div>
        </div>

        {/* Metric 2: Water Entitlement */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Approved Water Quota
            </span>
            <div className="p-2 bg-sky-50 text-sky-700 rounded-xl">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {metrics?.approvedLitres ? formatLitres(metrics.approvedLitres) : 'Pending Approval'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {metrics?.requiredLitres
                ? `Requested Quota: ${formatLitres(metrics.requiredLitres)}`
                : 'No active application'}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/water"
              className="text-xs text-sky-700 hover:text-sky-800 font-semibold inline-flex items-center"
            >
              Water Details &rarr;
            </Link>
          </div>
        </div>

        {/* Metric 3: Total Development Cost */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Development Bill
            </span>
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics?.totalDevelopmentCost)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Fixed 5-Stage Milestone Installments
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/payments"
              className="text-xs text-indigo-700 hover:text-indigo-800 font-semibold inline-flex items-center"
            >
              Milestone Schedule &rarr;
            </Link>
          </div>
        </div>

        {/* Metric 4: Total Paid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Paid Amount
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">
              {formatCurrency(metrics?.totalPaid)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Verified Receipts Available
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/payments"
              className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold inline-flex items-center"
            >
              View Receipts &rarr;
            </Link>
          </div>
        </div>

        {/* Metric 5: Pending Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Balance
            </span>
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(metrics?.pendingBalance)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Due across remaining milestones
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/payments"
              className="text-xs text-rose-700 hover:text-rose-800 font-semibold inline-flex items-center"
            >
              Pay Installment &rarr;
            </Link>
          </div>
        </div>

        {/* Metric 6: Infrastructure Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pipeline Grid Status
            </span>
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadgeClass(
                  infra?.status || 'PLANNED'
                )}`}
              >
                {infra?.status || 'NOT INITIATED'}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {infra?.commissionedAt
                ? `Commissioned on ${formatDate(infra.commissionedAt)}`
                : infra?.completedAt
                ? `Works completed on ${formatDate(infra.completedAt)}`
                : infra?.constructionStartedAt
                ? `Construction started on ${formatDate(infra.constructionStartedAt)}`
                : infra?.plannedAt
                ? `Planned on ${formatDate(infra.plannedAt)}`
                : 'Subject to engineering execution'}
            </div>
            {infra?.remarks && (
              <p className="text-[11px] text-slate-400 italic mt-1 truncate">
                &ldquo;{infra.remarks}&rdquo;
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link
              href="/beneficiary/infrastructure"
              className="text-xs text-purple-700 hover:text-purple-800 font-semibold inline-flex items-center"
            >
              Track Pipeline &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Action-Oriented Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Next Due Installment Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                <CreditCard className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Next Due Installment</h2>
            </div>
            {nextInst && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                  nextInst.status
                )}`}
              >
                {nextInst.status}
              </span>
            )}
          </div>

          {nextInst ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 uppercase">
                      Milestone {nextInst.number} ({nextInst.percentage}%)
                    </div>
                    <div className="text-xl font-bold text-slate-900 mt-1">
                      {formatCurrency(nextInst.pendingAmount)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-medium text-slate-500">Due Date</div>
                    <div className="text-xs font-semibold text-slate-800 mt-0.5">
                      {formatDate(nextInst.dueDate)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  Total Milestone Amount: {formatCurrency(nextInst.amount)}
                </span>
                <Link
                  href="/beneficiary/payments"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition inline-flex items-center space-x-1.5"
                >
                  <span>Pay Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800">All Installments Clear</div>
              <p className="text-xs text-slate-500 mt-1">
                You have no pending development milestone payments at this time.
              </p>
            </div>
          )}
        </div>

        {/* Active Application or Quota Summary Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-sky-50 text-sky-700 rounded-lg">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Application &amp; Allotment</h2>
            </div>
            {latestApp && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                  latestApp.status
                )}`}
              >
                {latestApp.status}
              </span>
            )}
          </div>

          {latestApp ? (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Requested Quantity:</span>
                  <span className="font-semibold text-slate-800">
                    {formatLitres(latestApp.requiredLitres)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Submission Date:</span>
                  <span className="font-semibold text-slate-800">
                    {formatDate(latestApp.createdAt)}
                  </span>
                </div>
                {activeAllotment && (
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                    <span className="text-slate-500 font-semibold text-emerald-700">
                      Approved Quota:
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatLitres(activeAllotment.approvedLitres)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-500">
                  {latestApp.status === 'APPROVED'
                    ? 'Allotment verified and active'
                    : 'Under review by Department Engineers'}
                </span>
                <Link
                  href="/beneficiary/water"
                  className="text-xs text-sky-700 hover:text-sky-800 font-semibold inline-flex items-center"
                >
                  <span>Track Application</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Droplets className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <div className="text-sm font-semibold text-slate-800">No Water Application Yet</div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once your land parcels are registered, you can apply for your computed water allotment quota.
              </p>
              <Link
                href="/beneficiary/water/apply"
                className="mt-4 inline-flex items-center space-x-1 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <span>Apply for Water</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Running Charges Banner (Strict Commissioning Gate) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl shrink-0 mt-0.5">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <span>Monthly Recurring Running Charges</span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                    running?.isInfrastructureCommissioned
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {running?.isInfrastructureCommissioned ? 'ACTIVE (COMMISSIONED)' : 'LOCKED (PRE-COMMISSIONING)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                {running?.isInfrastructureCommissioned
                  ? 'Infrastructure is commissioned. Monthly water consumption and maintenance invoices are generated at the end of each billing cycle.'
                  : 'Running charges are not active yet. In accordance with system safety policies, recurring monthly water charges will only begin after your dedicated pipeline is fully COMMISSIONED by the field engineering team.'}
              </p>
            </div>
          </div>

          <Link
            href="/beneficiary/running-charges"
            className="shrink-0 px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1"
          >
            <span>View Running Bills</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
