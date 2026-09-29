'use client';

import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  HelpCircle,
  PauseCircle,
  Check,
} from 'lucide-react';

export type BadgeVariant =
  | 'APPROVED'
  | 'ACTIVE'
  | 'PAID'
  | 'COMMISSIONED'
  | 'COMPLETED'
  | 'SUCCESS'
  | 'PENDING'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'PLANNING'
  | 'REQUESTED'
  | 'WARNING'
  | 'PARTIALLY_PAID'
  | 'REJECTED'
  | 'CANCELLED'
  | 'INACTIVE'
  | 'SUSPENDED'
  | 'OVERDUE'
  | 'ERROR'
  | 'DRAFT'
  | 'WAIVED'
  | 'DEFAULT';

interface StatusBadgeProps {
  status: string | null | undefined;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  className = '',
}: StatusBadgeProps) {
  const norm = (status || '').toUpperCase().trim();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = HelpCircle;

  switch (norm) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'PAID':
    case 'COMMISSIONED':
    case 'COMPLETED':
    case 'PASS':
    case 'SUCCESS':
      styles = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      Icon = CheckCircle2;
      break;

    case 'SUBMITTED':
    case 'UNDER_REVIEW':
    case 'PENDING':
    case 'PLANNING':
    case 'REQUESTED':
    case 'UNDER_CONSTRUCTION':
      styles = 'bg-sky-50 text-sky-700 border-sky-200/80';
      Icon = Clock;
      break;

    case 'PARTIALLY_PAID':
    case 'WARNING':
      styles = 'bg-amber-50 text-amber-800 border-amber-200/80';
      Icon = AlertCircle;
      break;

    case 'OVERDUE':
    case 'REJECTED':
    case 'CANCELLED':
    case 'FAIL':
    case 'ERROR':
      styles = 'bg-rose-50 text-rose-700 border-rose-200/80';
      Icon = XCircle;
      break;

    case 'INACTIVE':
    case 'SUSPENDED':
    case 'DRAFT':
    case 'WAIVED':
      styles = 'bg-slate-100 text-slate-600 border-slate-200';
      Icon = PauseCircle;
      break;

    default:
      styles = 'bg-slate-100 text-slate-700 border-slate-200';
      Icon = HelpCircle;
      break;
  }

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-0.5 gap-1.5',
    lg: 'text-sm px-3 py-1 gap-2',
  }[size];

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  }[size];

  const displayLabel = label || norm.replace(/_/g, ' ');

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-full border tracking-wide uppercase ${styles} ${sizeStyles} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizes} shrink-0`} />}
      <span>{displayLabel}</span>
    </span>
  );
}

export default StatusBadge;
