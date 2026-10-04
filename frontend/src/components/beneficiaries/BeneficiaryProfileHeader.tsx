'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatAcres } from '@/lib/utils';
import {
  User,
  Phone,
  MapPin,
  Droplet,
  Layers,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface BeneficiaryProfileHeaderProps {
  beneficiary: any;
  onOpenPayment?: (billId?: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export function BeneficiaryProfileHeader({
  beneficiary,
  onOpenPayment,
  onNavigateTab,
}: BeneficiaryProfileHeaderProps) {
  const { data: nextActionData, isLoading: loadingNextAction } = useQuery({
    queryKey: ['beneficiary-next-action', beneficiary?.beneficiary_id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${beneficiary?.beneficiary_id}/next-action`);
      return res.data;
    },
    enabled: !!beneficiary?.beneficiary_id,
  });

  const nextAction = nextActionData || {
    type: 'CAUGHT_UP',
    label: "✓ You're all caught up.",
    description: 'No pending actions require immediate operator intervention.',
  };

  const totalLand = beneficiary?.total_land_acres || '0';
  const pendingDev = beneficiary?.metrics?.pendingBalance || '0';
  const pendingRunning = beneficiary?.running_summary?.totalPending || '0';
  const grandPending = (parseFloat(pendingDev) + parseFloat(pendingRunning)).toFixed(2);
  const approvedWater = beneficiary?.metrics?.approvedLitresTotal || '0';
  const infraStatus = beneficiary?.running_summary?.status === 'ACTIVE' ? 'COMMISSIONED' : 'PLANNED';

  const handleActionClick = () => {
    if (nextAction.type === 'COLLECT_PAYMENT') {
      if (onOpenPayment) {
        onOpenPayment(nextAction.billId);
      } else if (onNavigateTab) {
        onNavigateTab('billing');
      }
    } else if (nextAction.type === 'REVIEW_APPLICATION') {
      if (onNavigateTab) onNavigateTab('water');
    } else if (nextAction.type === 'REVIEW_EXTENSION') {
      if (onNavigateTab) onNavigateTab('extensions');
    } else if (nextAction.type === 'COMMISSION_INFRASTRUCTURE') {
      if (onNavigateTab) onNavigateTab('infrastructure');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Profile Info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">{beneficiary?.name}</h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  beneficiary?.status === 'ACTIVE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {beneficiary?.status || 'ACTIVE'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-400">
              <span className="font-mono text-cyan-400">{beneficiary?.beneficiary_id}</span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                {beneficiary?.phone_number}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                {beneficiary?.village?.name || 'Village'}, {beneficiary?.district?.name || 'District'}
              </span>
            </div>
          </div>
        </div>

        {/* Next Action Box */}
        <div className="bg-slate-950/80 border border-cyan-500/20 rounded-lg p-4 flex items-center justify-between gap-4 shrink-0 lg:min-w-[340px]">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Next Action</span>
            </div>
            <p className="text-sm font-medium text-white">{nextAction.label}</p>
            <p className="text-xs text-slate-400 line-clamp-1">{nextAction.description}</p>
          </div>

          {nextAction.type !== 'CAUGHT_UP' && (
            <button
              onClick={handleActionClick}
              className="px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>Action</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-800/80">
        {/* Outstanding Balance */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs font-medium text-slate-400 block mb-1">Development / Running</span>
          <div className="flex items-center justify-between">
            <span
              className={`text-lg font-bold ${
                parseFloat(grandPending) > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {parseFloat(grandPending) > 0 ? `PENDING ${formatCurrency(grandPending)}` : 'FULLY PAID'}
            </span>
            {parseFloat(grandPending) > 0 && onOpenPayment && (
              <button
                onClick={() => onOpenPayment()}
                className="text-xs text-cyan-400 hover:underline font-medium"
              >
                Pay Now
              </button>
            )}
          </div>
        </div>

        {/* Approved Water */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs font-medium text-slate-400 block mb-1">Approved Quota</span>
          <div className="flex items-center gap-2">
            <Droplet className="w-4 h-4 text-cyan-400" />
            <span className="text-lg font-bold text-white">{formatLitres(approvedWater)} / day</span>
          </div>
        </div>

        {/* Land Area */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs font-medium text-slate-400 block mb-1">Active Land</span>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span className="text-lg font-bold text-white">{formatAcres(totalLand)}</span>
          </div>
        </div>

        {/* Infrastructure */}
        <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/60">
          <span className="text-xs font-medium text-slate-400 block mb-1">Infrastructure</span>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold uppercase text-slate-200">{infraStatus}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
