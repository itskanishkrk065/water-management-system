'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconVariant?: 'sky' | 'emerald' | 'amber' | 'indigo' | 'purple' | 'rose' | 'slate';
  contextBadge?: React.ReactNode;
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconVariant = 'slate',
  variant,
  contextBadge,
  className = '',
}: KPICardProps & { variant?: any }) {
  const chosenVariant = iconVariant || (variant === 'default' ? 'slate' : variant) || 'slate';

  const iconTints: Record<string, string> = {
    sky: 'text-sky-600 bg-sky-50 border-sky-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    rose: 'text-rose-600 bg-rose-50 border-rose-100',
    slate: 'text-slate-600 bg-slate-100 border-slate-200/80',
  };

  const iconStyle = iconTints[chosenVariant] || iconTints.slate;

  return (
    <div
      className={`bg-white border border-slate-200/90 p-4 rounded-xl shadow-xs flex flex-col justify-between hover:border-slate-300 transition-all ${className}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">{title}</span>
          {Icon && (
            <div className={`p-1.5 rounded-lg border ${iconStyle}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        <div className="mt-1 text-2xl font-bold text-slate-900 tracking-tight font-mono">
          {value}
        </div>
      </div>

      {(subtitle || contextBadge) && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 gap-1">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {contextBadge && <div className="shrink-0">{contextBadge}</div>}
        </div>
      )}
    </div>
  );
}

export default KPICard;
