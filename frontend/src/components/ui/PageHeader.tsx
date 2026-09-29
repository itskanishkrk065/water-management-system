'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  badgeVariant?: 'default' | 'success' | 'warning' | 'info';
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  badge,
  badgeVariant = 'info',
  breadcrumbs,
  actions,
  children,
}: PageHeaderProps) {
  const badgeStyles = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    info: 'bg-sky-50 text-sky-700 border-sky-200',
  }[badgeVariant];

  return (
    <div className="space-y-3 mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-slate-700 transition">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-600 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {badge && (
              typeof badge === 'string' ? (
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${badgeStyles}`}>
                  {badge}
                </span>
              ) : (
                badge
              )
            )}
          </div>
          {description && (
            <p className="text-sm text-slate-500 max-w-3xl leading-relaxed">{description}</p>
          )}
        </div>

        {actions && <div className="flex items-center gap-2.5 shrink-0 flex-wrap">{actions}</div>}
      </div>

      {children}
    </div>
  );
}

export default PageHeader;
