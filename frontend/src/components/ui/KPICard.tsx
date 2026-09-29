'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconVariant?: 'sky' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'rose' | 'slate';
  contextBadge?: React.ReactNode;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconVariant,
  variant,
  contextBadge,
  className = '',
}: KPICardProps & { variant?: any }) {
  const chosenVariant = iconVariant || (variant === 'default' ? 'slate' : variant) || 'sky';
  const iconVariants: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  };
  const iconStyle = iconVariants[chosenVariant] || iconVariants.sky;

  return (
    <div
      className={`bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-300 transition ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
          <div className={`p-1.5 rounded-lg border ${iconStyle}`}>
            <Icon className="w-4 h-4 stroke-[2]" />
          </div>
        </div>
        <div className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight font-mono">
          {value}
        </div>
      </div>

      {(subtitle || contextBadge) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 gap-1">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {contextBadge && <div className="shrink-0">{contextBadge}</div>}
        </div>
      )}
    </div>
  );
}

export default KPICard;
