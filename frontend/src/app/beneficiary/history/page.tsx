'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate, formatDateTime, getStatusBadgeClass } from '@/lib/utils';
import {
  History,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Activity,
  Layers,
  MapPin,
  Droplets,
  CreditCard,
  FileCheck2,
} from 'lucide-react';

export default function BeneficiaryHistoryPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: history, isLoading } = useQuery({
    queryKey: ['beneficiary-history'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/history');
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

  const logs = history || [];

  const getIconForEntity = (entity: string) => {
    switch (entity) {
      case 'LandHolding':
        return MapPin;
      case 'WaterApplication':
      case 'WaterAllotment':
        return Droplets;
      case 'Payment':
      case 'DevelopmentBill':
      case 'Installment':
        return CreditCard;
      case 'Extension':
        return Layers;
      default:
        return Activity;
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Chronological Audit &amp; Event History
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete transparent ledger of all actions, submissions, administrative approvals, and payments
        </p>
      </div>

      {/* Trust & Transparency Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start space-x-3">
        <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs">
          <div className="font-bold text-slate-900 text-sm">PostgreSQL Immutable Audit Trail</div>
          <p className="text-slate-500 mt-0.5 leading-relaxed">
            Every record change, parcel verification, tariff calculation, and financial transaction is permanently logged with timestamps, IP origin, and cryptographic checksums in compliance with public irrigation integrity standards.
          </p>
        </div>
      </div>

      {/* Vertical Timeline */}
      {logs.length > 0 ? (
        <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
          {logs.map((item: any, idx: number) => {
            const Icon = getIconForEntity(item.entityType);
            const isExpanded = expandedId === item.id;

            return (
              <div key={item.id || idx} className="relative group">
                {/* Bullet Node */}
                <div className="absolute -left-[31px] top-1.5 h-6 w-6 rounded-full bg-white border-2 border-amber-600 flex items-center justify-center shadow-sm group-hover:scale-110 transition">
                  <Icon className="w-3 h-3 text-amber-600" />
                </div>

                {/* Event Card */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-900">
                        {item.description}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-100 text-slate-700">
                        {item.action}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDateTime(item.timestamp)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div>
                      Target Entity: <span className="font-semibold text-slate-700">{item.entityType}</span>
                      {item.entityId && (
                        <span className="font-mono text-slate-400 ml-1.5">
                          ({item.entityId.substring(0, 8)})
                        </span>
                      )}
                    </div>

                    {item.details && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="text-xs text-amber-600 hover:text-amber-700 font-medium inline-flex items-center space-x-0.5"
                      >
                        <span>{isExpanded ? 'Hide Payload' : 'View Payload'}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded JSON Details */}
                  {isExpanded && item.details && (
                    <div className="mt-3 p-3 bg-slate-900 rounded-xl text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      <pre>{JSON.stringify(item.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-400 text-xs">
          No audit history events recorded yet.
        </div>
      )}
    </div>
  );
}
