'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  Map,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Layers,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryLandPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['beneficiary-land'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/land');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const holdings = data?.holdings || [];
  const totalActiveAcres = data?.totalActiveAcres || '0.0000';

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Registered Land Holdings &amp; Parcels
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your agricultural land holdings, survey numbers (SF), subdivisions, and extent verification
          </p>
        </div>
        <Link
          href="/beneficiary/land/new"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow transition shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Register Land Holding</span>
        </Link>
      </div>

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Verified Active Extent
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {formatAcres(totalActiveAcres)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aggregated sum of all verified SF subdivision parcels
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Active Holdings
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {holdings.length}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Total land titles registered under your beneficiary ID
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Total Survey Parcels
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">
            {holdings.reduce((sum: number, h: any) => sum + (h.parcels?.length || 0), 0)}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Individual survey and subdivision records
          </p>
        </div>
      </div>

      {/* Holdings Listing */}
      {holdings.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm">
          <Map className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Land Holdings Registered</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You have not registered any agricultural land holdings yet. Add your land holding and SF survey parcels to become eligible for water quotas.
          </p>
          <Link
            href="/beneficiary/land/new"
            className="mt-4 inline-flex items-center space-x-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add First Land Holding</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {holdings.map((h: any) => (
            <div
              key={h.land_id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-900 flex items-center space-x-2">
                      <span>Holding #{h.land_id.substring(0, 8)}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                          h.status
                        )}`}
                      >
                        {h.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Registered on {formatDate(h.created_at)} &bull; Unit: {h.area_unit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Declared Area</div>
                    <div className="text-base font-bold text-slate-900">
                      {formatAcres(h.declared_total_area)}
                    </div>
                  </div>
                  <Link
                    href={`/beneficiary/land/${h.land_id}`}
                    className="p-2 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                    title="View Parcel Details"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>

              {/* Parcels Snippet */}
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Survey Parcels ({h.parcels?.length || 0})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {h.parcels?.map((p: any) => (
                    <div
                      key={p.parcel_id}
                      className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800">
                          SF {p.survey_number}
                        </span>
                        {p.subdivision_number && (
                          <span className="text-slate-500 ml-1">/ {p.subdivision_number}</span>
                        )}
                      </div>
                      <span className="font-mono font-bold text-amber-800">
                        {formatAcres(p.area)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
