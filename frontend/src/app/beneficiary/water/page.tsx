'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  Droplets,
  PlusCircle,
  FileCheck2,
  Layers,
  History,
  Info,
  Building2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryWaterPage() {
  const { data: allotments, isLoading: allotLoading } = useQuery({
    queryKey: ['beneficiary-allotments'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/allotments');
      return res.data;
    },
  });

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['beneficiary-water-applications'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/water/applications');
      return res.data;
    },
  });

  if (allotLoading || appsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const activeAllotment = allotments && allotments.length > 0 ? allotments[0] : null;

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Water Allocation &amp; Entitlements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track your approved water volume, historical rate tariff snapshot, and formal application requests
          </p>
        </div>
        <Link
          href="/beneficiary/water/apply"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow transition shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Apply for Water Quota</span>
        </Link>
      </div>

      {/* Active Allotment Section */}
      {activeAllotment ? (
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-sky-50 text-sky-700 rounded-xl">
                <Droplets className="w-6 h-6" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>Approved Root Water Allotment</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    APPROVED &amp; ACTIVE
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  Allotment ID: {activeAllotment.allotment_id} &bull; Approved on {formatDate(activeAllotment.approved_at)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-semibold text-slate-500 uppercase">Approved Quota</span>
              <div className="text-3xl font-extrabold text-sky-700">
                {formatLitres(activeAllotment.approved_litres)}
              </div>
            </div>
          </div>

          {/* Rate Tariff Snapshot & Financials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Historical Tariff Snapshot</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                ₹{activeAllotment.rate?.development_cost_per_litre ?? '2.00'} / Litre
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Development rate locked at time of approval. Future tariff increases will not affect this rate.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Total Development Cost</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {formatCurrency(activeAllotment.developmentBill?.total_amount ?? 0)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Structured into 5 milestone installment tranches
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="text-slate-500 font-semibold uppercase tracking-wider">Infrastructure Commissioning</div>
              <div className="text-sm font-bold text-slate-900 mt-1">
                {activeAllotment.infrastructure?.status || 'PLANNED'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {activeAllotment.infrastructure?.commissioned_date
                  ? `Commissioned on ${formatDate(activeAllotment.infrastructure.commissioned_date)}`
                  : activeAllotment.infrastructure?.construction_start_date
                  ? `Construction started on ${formatDate(activeAllotment.infrastructure.construction_start_date)}`
                  : 'Pending final engineering commissioning'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Link
              href="/beneficiary/payments"
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 inline-flex items-center space-x-1"
            >
              <span>View 5-Stage Installment Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
          <Droplets className="w-12 h-12 text-slate-300 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No Approved Allotment Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Once you submit a water application and it is reviewed by the irrigation department, your official approved quota and rate snapshot will appear here.
          </p>
          <Link
            href="/beneficiary/water/apply"
            className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Apply for Allocation</span>
          </Link>
        </div>
      )}

      {/* Applications History Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="w-5 h-5 text-sky-600" />
            <h2 className="text-base font-bold text-slate-900">Application Requests History</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {applications?.length || 0} Total Requests
          </span>
        </div>

        {applications && applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Application ID</th>
                  <th className="py-3 px-4">Submission Date</th>
                  <th className="py-3 px-4">Requested Volume</th>
                  <th className="py-3 px-4">Scheme Project</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {applications.map((app: any) => (
                  <tr key={app.application_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      APP-{app.application_id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDate(app.application_date || app.created_at)}
                    </td>
                    <td className="py-3 px-4 font-bold text-sky-700">
                      {formatLitres(app.required_litres)}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {app.project?.name || 'Kongu Basin Scheme'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold font-sans border ${getStatusBadgeClass(
                          app.status
                        )}`}
                      >
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No water applications submitted yet.
          </div>
        )}
      </div>
    </div>
  );
}
