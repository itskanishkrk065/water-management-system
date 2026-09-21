'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
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
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const isAccounts = user.role === 'ACCOUNTS' || isAdmin;
  const isField = user.role === 'FIELD_OFFICER' || isAdmin;

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Beneficiaries', href: '/beneficiaries', icon: Users },
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
