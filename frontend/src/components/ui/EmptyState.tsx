'use client';

import React from 'react';
import { LucideIcon, FolderSearch } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon = FolderSearch,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 p-8 md:p-12 text-center flex flex-col items-center justify-center ${className}`}
    >
      <div className="p-3.5 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 mb-4">
        <Icon className="w-8 h-8 stroke-[1.5]" />
      </div>
      <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mt-1.5 leading-relaxed">{description}</p>

      {(actionLabel && (actionHref || onAction)) && (
        <div className="mt-5">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              onClick={onAction}
              type="button"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
