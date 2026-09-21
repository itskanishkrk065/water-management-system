'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatAcres, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  ArrowUpRight,
  PlusCircle,
  ShieldCheck,
  Layers,
  Info,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryExtensionsPage() {
  const { data: extensions, isLoading } = useQuery({
    queryKey: ['beneficiary-extensions'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/extensions');
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

  const list = extensions || [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Supplementary Quota Extensions
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Request additional land extent or supplementary water volume without altering your root approved allotment
          </p>
        </div>
        <Link
          href="/beneficiary/extensions/new"
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow transition shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Request Extension</span>
        </Link>
      </div>

      {/* Architectural Isolation Notice */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 space-y-3">
        <div className="flex items-center space-x-2 text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Architectural Integrity Rule &bull; Isolated Extension Objects</span>
        </div>
        <h2 className="text-base font-bold text-white">
          Independent Quota Lifecycles
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
          Extension requests are supplementary water/land requests. They never overwrite, modify, or erase your original root water allotment, nor do they retroactively recalculate historical milestone rates. Each extension is billed and evaluated as an independent supplementary record.
        </p>
      </div>

      {/* Extensions Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ArrowUpRight className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Extension Requests History</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">{list.length} Requests</span>
        </div>

        {list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50">
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Date Submitted</th>
                  <th className="py-3 px-4">Additional Area</th>
                  <th className="py-3 px-4">Additional Water</th>
                  <th className="py-3 px-4 text-right">Calculated Cost</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {list.map((ext: any) => (
                  <tr key={ext.extension_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      EXT-{ext.extension_id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-sans">
                      {formatDate(ext.created_at)}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {ext.requested_additional_area ? formatAcres(ext.requested_additional_area) : '0.00 acres'}
                    </td>
                    <td className="py-3 px-4 font-bold text-amber-800">
                      {formatLitres(ext.requested_additional_litres)}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(ext.extension_cost)}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${getStatusBadgeClass(
                          ext.status
                        )}`}
                      >
                        {ext.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-400">
            No supplementary quota extensions requested.
          </div>
        )}
      </div>
    </div>
  );
}
