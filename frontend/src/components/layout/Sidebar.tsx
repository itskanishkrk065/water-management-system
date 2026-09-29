'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  Search,
  Layers,
  FileCheck2,
  CheckCircle,
  Receipt,
  CreditCard,
  Building2,
  ArrowUpRight,
  Sliders,
  History,
  CalendarDays,
  MapPin,
  User,
  Map,
  Droplets,
  FileText,
  Database,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  // Do not show sidebar on standalone auth pages
  if (
    pathname === '/login' ||
    pathname.startsWith('/beneficiary/login') ||
    pathname.startsWith('/beneficiary/signup') ||
    pathname.startsWith('/beneficiary/forgot-password') ||
    pathname.startsWith('/beneficiary/reset-password')
  ) {
    return null;
  }

  const isBeneficiaryView = user.role === 'BENEFICIARY' || pathname.startsWith('/beneficiary');

  if (isBeneficiaryView) {
    const beneficiaryNavItems = [
      { label: 'Dashboard', href: '/beneficiary/dashboard', icon: LayoutDashboard },
      { label: 'My Profile', href: '/beneficiary/profile', icon: User },
      { label: 'Land Holdings', href: '/beneficiary/land', icon: Map },
      { label: 'Water Allotment', href: '/beneficiary/water', icon: Droplets },
      { label: 'Payments & Receipts', href: '/beneficiary/payments', icon: CreditCard },
      { label: 'Infrastructure Grid', href: '/beneficiary/infrastructure', icon: Building2 },
      { label: 'Running Charges', href: '/beneficiary/running-charges', icon: CalendarDays },
      { label: 'Extension Requests', href: '/beneficiary/extensions', icon: ArrowUpRight },
      { label: 'Documents', href: '/beneficiary/documents', icon: FileText },
      { label: 'Activity History', href: '/beneficiary/history', icon: History },
    ];

    return (
      <aside className="w-64 bg-slate-900 text-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-1">
          <div className="px-3 py-2 text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>Beneficiary Portal</span>
            <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-mono">Self-Service</span>
          </div>
          {beneficiaryNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/beneficiary/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? 'bg-amber-600 text-white font-semibold shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 px-3">
          <div className="font-semibold text-slate-300 truncate">{user.full_name}</div>
          <div className="text-[11px] text-emerald-400 mt-0.5">Verified Beneficiary Account</div>
          <div className="text-[10px] text-slate-500 mt-1">Direct Land & Water Allocation</div>
        </div>
      </aside>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Beneficiaries', href: '/admin/beneficiaries', icon: Users },
    { label: 'Find & Filter', href: '/admin/find', icon: Search },
    { label: 'Water Applications', href: '/water/applications', icon: FileCheck2 },
    ...(isAdmin ? [{ label: 'Approvals Queue', href: '/water/approvals', icon: CheckCircle }] : []),
    {
      label: 'Development Bills',
      href: '/billing/development',
      icon: Receipt,
    },
    {
      label: 'Installments (5-Stage)',
      href: '/billing/installments',
      icon: Layers,
    },
    {
      label: 'Running Charges',
      href: '/billing/running',
      icon: CalendarDays,
    },
    { label: 'Payments Ledger', href: '/payments', icon: CreditCard },
    { label: 'Infrastructure Grid', href: '/infrastructure', icon: Building2 },
    { label: 'Extensions', href: '/extensions', icon: ArrowUpRight },
    ...(isAdmin
      ? [
          { label: 'Rate Tariff (Versioned)', href: '/settings/rates', icon: Sliders },
          { label: 'Installment Templates', href: '/settings/installments', icon: Layers },
          { label: 'Locations Hierarchy', href: '/settings/locations', icon: MapPin },
          { label: 'Database & Backup', href: '/settings/backup', icon: Database },
        ]
      : []),
    { label: 'Audit Trail', href: '/audit', icon: History },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-sky-600 text-white font-semibold shadow'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800 text-xs text-slate-400 px-3">
        <div className="font-semibold text-slate-300">Kongu Basin Irrigation</div>
        <div>PostgreSQL NUMERIC Precision</div>
        <div className="text-[11px] text-slate-400 mt-1">Audit Logged & Snapshot Safe</div>
      </div>
    </aside>
  );
}
