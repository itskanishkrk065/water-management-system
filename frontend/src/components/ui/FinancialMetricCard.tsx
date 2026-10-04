'use client';

import React from 'react';
import { formatCurrency } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface FinancialMetricCardProps {
  title: string;
  pendingAmount: number;
  paidAmount: number;
  totalAmount: number;
  subtitle?: string;
  icon?: LucideIcon;
  currencyPrefix?: string;
  className?: string;
}

export function FinancialMetricCard({
  title,
  pendingAmount = 0,
  paidAmount = 0,
  totalAmount = 0,
  subtitle,
  icon: Icon,
  className = '',
}: FinancialMetricCardProps) {
  const formattedPending = formatCurrency(pendingAmount);
  const formattedPaid = formatCurrency(paidAmount);
  const formattedTotal = formatCurrency(totalAmount);

  return (
    <div
      className={`bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all ${className}`}
    >
      {/* Title Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="p-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-200/80">
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      {/* Mandatory Hierarchy: 1. PENDING, 2. PAID, 3. TOTAL */}
      <div className="py-3 space-y-2">
        {/* 1. PENDING (Primary / Red / Danger) */}
        <div className="flex items-baseline justify-between gap-2 bg-rose-50/70 p-2 rounded-lg border border-rose-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">1. Pending</span>
          <span className="text-base font-extrabold text-rose-700 font-mono tracking-tight text-right whitespace-nowrap">
            {formattedPending}
          </span>
        </div>

        {/* 2. PAID (Success / Green) */}
        <div className="flex items-baseline justify-between gap-2 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">2. Paid</span>
          <span className="text-sm font-bold text-emerald-700 font-mono tracking-tight text-right whitespace-nowrap">
            {formattedPaid}
          </span>
        </div>

        {/* 3. TOTAL (Neutral / Reference) */}
        <div className="flex items-baseline justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">3. Total</span>
          <span className="text-xs font-semibold text-slate-700 font-mono tracking-tight text-right whitespace-nowrap">
            {formattedTotal}
          </span>
        </div>
      </div>

      {subtitle && (
        <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
}
