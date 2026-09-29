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
  
  const cardTints: Record<string, { bg: string; border: string; iconBox: string }> = {
    sky: {
      bg: 'bg-[#F8FAFD]',
      border: 'border-[#E2EAF4]',
      iconBox: 'bg-sky-50 text-sky-600 border-sky-100',
    },
    emerald: {
      bg: 'bg-[#F7FAFA]',
      border: 'border-[#DFEBE3]',
      iconBox: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    },
    amber: {
      bg: 'bg-[#FEFBF6]',
      border: 'border-[#FCEFE0]',
      iconBox: 'bg-amber-50 text-amber-600 border-amber-100',
    },
    indigo: {
      bg: 'bg-[#F8F9FE]',
      border: 'border-[#E3E8FC]',
      iconBox: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    },
    purple: {
      bg: 'bg-[#FAF8FE]',
      border: 'border-[#E9E3FC]',
      iconBox: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    rose: {
      bg: 'bg-[#FEF7F7]',
      border: 'border-[#FCE2E2]',
      iconBox: 'bg-rose-50 text-rose-600 border-rose-100',
    },
    slate: {
      bg: 'bg-[#FAFBFD]',
      border: 'border-[#E6EBF2]',
      iconBox: 'bg-slate-50 text-slate-600 border-slate-200',
    },
  };

  const style = cardTints[chosenVariant] || cardTints.sky;

  return (
    <div
      className={`${style.bg} ${style.border} p-3.5 sm:p-4 rounded-xl border shadow-xs flex flex-col justify-between hover:border-slate-300 transition duration-150 ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
          <div className={`p-1.5 rounded-lg border ${style.iconBox}`}>
            <Icon className="w-4 h-4 stroke-[2]" />
          </div>
        </div>
        <div className="mt-1 text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
          {value}
        </div>
      </div>

      {(subtitle || contextBadge) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-500 gap-1 font-normal">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {contextBadge && <div className="shrink-0">{contextBadge}</div>}
        </div>
      )}
    </div>
  );
}

export default KPICard;
