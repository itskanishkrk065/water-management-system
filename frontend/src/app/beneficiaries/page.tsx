'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import { Users, Search, Plus, ArrowRight, Phone, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function BeneficiariesListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['beneficiaries', search, page],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiaries', {
        params: { search: search || undefined, page, limit: 15 },
      });
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beneficiaries Directory</h1>
          <p className="text-sm text-slate-500 mt-1">
            Registered farmers with surveyed land holdings and allocated water quotas
          </p>
        </div>
        <Link
          href="/beneficiaries/new"
          className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4 mr-2" />
          Onboard Beneficiary
        </Link>
      </div>

      {/* Search Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center space-x-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search by farmer name or 10-digit phone number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full bg-transparent border-none text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {/* Beneficiaries Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Farmer Details</th>
                <th className="px-5 py-3.5">Phone Number</th>
                <th className="px-5 py-3.5">Location</th>
                <th className="px-5 py-3.5">Total Verified Land</th>
                <th className="px-5 py-3.5">Holdings / Applications</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading beneficiaries...
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((b: any) => (
                  <tr key={b.beneficiary_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      <Link href={`/beneficiaries/${b.beneficiary_id}`} className="hover:text-sky-600">
                        {b.name}
                      </Link>
                      <div className="text-xs text-slate-400 font-mono mt-0.5">
                        UUID: {b.beneficiary_id.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      <div className="flex items-center space-x-1.5 font-mono text-xs">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{b.phone_number}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{b.village?.name}, {b.district?.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">Direction: {b.location_direction}</span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">
                      {formatAcres(b.total_land_acres)}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      <div>{b._count?.landHoldings ?? 0} Holdings</div>
                      <div className="text-slate-400">{b._count?.waterApplications ?? 0} Applications</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(b.status)}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/beneficiaries/${b.beneficiary_id}`}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        Dossier
                        <ArrowRight className="w-3 h-3 ml-1 text-slate-400" />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No beneficiaries found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing Page {data.meta.page} of {data.meta.totalPages} ({data.meta.total} total)
            </div>
            <div className="flex space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
