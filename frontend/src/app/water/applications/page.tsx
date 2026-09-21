'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatLitres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { FileCheck2, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function WaterApplicationsPage() {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Water Requirement Applications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Volumetric irrigation requests submitted by farmers and field officers
          </p>
        </div>
        <Link
          href="/water/applications/new"
          className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Submit Application
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((st) => (
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
            {st || 'All Applications'}
          </button>
        ))}
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Submission Date</th>
                <th className="px-5 py-3.5">Beneficiary Farmer</th>
                <th className="px-5 py-3.5">Project Scope</th>
                <th className="px-5 py-3.5">Required Litres (Request)</th>
                <th className="px-5 py-3.5">Approved Litres</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading applications...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((app: any) => (
                  <tr key={app.application_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-mono text-slate-600">{formatDate(app.application_date)}</td>
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <div>{app.beneficiary?.name}</div>
                      <div className="text-slate-400 font-mono text-[11px]">{app.beneficiary?.phone_number}</div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{app.project?.project_name}</td>
                    <td className="px-5 py-4 font-bold text-sky-700">{formatLitres(app.required_litres)}</td>
                    <td className="px-5 py-4 font-bold text-blue-800">
                      {app.allotment ? formatLitres(app.allotment.approved_litres) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border ${getStatusBadgeClass(app.status)}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {app.status === 'SUBMITTED' ? (
                        <Link
                          href="/water/approvals"
                          className="inline-flex items-center px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition"
                        >
                          Review &amp; Approve
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Link>
                      ) : (
                        <Link
                          href={`/beneficiaries/${app.beneficiary_id}?tab=water`}
                          className="text-slate-500 hover:text-slate-800"
                        >
                          View Dossier
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No water applications found.
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
