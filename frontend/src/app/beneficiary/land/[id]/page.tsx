'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  Map,
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertCircle,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function LandHoldingDetailPage() {
  const params = useParams();
  const landId = params.id as string;

  const { data: holding, isLoading, error } = useQuery({
    queryKey: ['beneficiary-land-detail', landId],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiary/land/${landId}`);
      return res.data;
    },
    enabled: !!landId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (error || !holding) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-800">Land Holding Not Found</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          The requested land holding does not exist or you do not have permission to view it.
        </p>
        <Link
          href="/beneficiary/land"
          className="inline-flex items-center space-x-1 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Land Holdings</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/beneficiary/land"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Land Title Record
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            ID: {holding.land_id}
          </p>
        </div>
      </div>

      {/* Immutability Banner */}
      {holding.isLocked && (
        <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 flex items-start space-x-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-semibold text-white">Immutable Record Status &bull; Active Water Allotment</div>
            <p className="text-slate-400 mt-0.5">
              This land title and its underlying survey parcels are officially bound to an active government water allocation quota. To maintain administrative integrity, parcels cannot be modified or unlinked without formal administrative review.
            </p>
          </div>
        </div>
      )}

      {/* Holding Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Map className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Title Particulars</h2>
          </div>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
              holding.status
            )}`}
          >
            {holding.status}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-medium">Declared Extent</span>
            <div className="text-base font-bold text-slate-900 mt-1">
              {formatAcres(holding.declared_total_area)}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-medium">Area Unit</span>
            <div className="text-base font-bold text-slate-900 mt-1">
              {holding.area_unit}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-medium">Parcels Count</span>
            <div className="text-base font-bold text-slate-900 mt-1">
              {holding.parcels?.length || 0}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl">
            <span className="text-slate-500 font-medium">Registration Date</span>
            <div className="text-base font-bold text-slate-900 mt-1">
              {formatDate(holding.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* SF Parcels Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <Layers className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-900">Survey (SF) &amp; Subdivision Parcels</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Survey Number (SF)</th>
                <th className="py-3 px-4">Subdivision</th>
                <th className="py-3 px-4 text-right">Extent Area</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holding.parcels?.map((p: any, idx: number) => (
                <tr key={p.parcel_id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">SF {p.survey_number}</td>
                  <td className="py-3 px-4 text-slate-600">
                    {p.subdivision_number || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-amber-800">
                    {formatAcres(p.area)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-[11px] font-sans">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
