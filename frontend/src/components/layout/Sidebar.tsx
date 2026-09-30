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
  Briefcase,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

interface NavGroup {
  heading: string;
  items: {
    label: string;
    href: string;
    icon: any;
    exact?: boolean;
  }[];
}

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
    const beneficiaryGroups: NavGroup[] = [
      {
        heading: 'PORTAL',
        items: [
          { label: 'Dashboard', href: '/beneficiary/dashboard', icon: LayoutDashboard, exact: true },
          { label: 'My Profile', href: '/beneficiary/profile', icon: User },
        ],
      },
      {
        heading: 'LAND & WATER ALLOCATION',
        items: [
          { label: 'Land Holdings', href: '/beneficiary/land', icon: Map },
          { label: 'Water Allotment', href: '/beneficiary/water', icon: Droplets },
          { label: 'Extension Requests', href: '/beneficiary/extensions', icon: ArrowUpRight },
        ],
      },
      {
        heading: 'FINANCIALS & INFRASTRUCTURE',
        items: [
          { label: 'Payments & Receipts', href: '/beneficiary/payments', icon: CreditCard },
          { label: 'Running Charges', href: '/beneficiary/running-charges', icon: CalendarDays },
          { label: 'Infrastructure Grid', href: '/beneficiary/infrastructure', icon: Building2 },
          { label: 'Documents', href: '/beneficiary/documents', icon: FileText },
          { label: 'Activity History', href: '/beneficiary/history', icon: History },
        ],
      },
    ];

    return (
      <aside className="w-60 bg-[#0B132B] text-slate-300 h-full overflow-y-auto p-3 flex flex-col justify-between shrink-0 border-r border-slate-800/80 custom-scrollbar">
        <div className="space-y-4">
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-wider">Farmer Portal</span>
            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold">Active</span>
          </div>

          {beneficiaryGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-0.5">
              <div className="px-2.5 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
                {group.heading}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 font-semibold shadow-xs'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-500 px-2">
          <div className="font-semibold text-slate-300 truncate">{user.full_name}</div>
        </div>
      </aside>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const isAccounts = user.role === 'ACCOUNTS';

  const navGroups: NavGroup[] = [
    {
      heading: 'OPERATIONS',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
        { label: 'Beneficiaries', href: '/admin/beneficiaries', icon: Users },
        { label: 'Find & Filter', href: '/reports/find', icon: Search },
        { label: 'Water Applications', href: '/water/applications', icon: FileCheck2 },
        ...(isAdmin ? [{ label: 'Approvals Queue', href: '/water/approvals', icon: CheckCircle }] : []),
      ],
    },
    {
      heading: 'FINANCE',
      items: [
        { label: 'Development Bills', href: '/billing/development', icon: Receipt },
        { label: '5-Stage Installments', href: '/billing/installments', icon: Layers },
        { label: 'Running Charges', href: '/billing/running', icon: CalendarDays },
        { label: 'Payments Ledger', href: '/payments', icon: CreditCard },
      ],
    },
    {
      heading: 'INFRASTRUCTURE',
      items: [
        { label: 'Infrastructure Grid', href: '/infrastructure', icon: Building2 },
        { label: 'Quota Extensions', href: '/extensions', icon: ArrowUpRight },
      ],
    },
    ...(isAdmin
      ? [
          {
            heading: 'MASTER DATA',
            items: [
              { label: 'Project Schemes', href: '/settings/project-schemes', icon: Briefcase },
              { label: 'Rate Tariffs', href: '/settings/rates', icon: Sliders },
              { label: 'Installment Templates', href: '/settings/installments', icon: Layers },
              { label: 'Locations', href: '/settings/locations', icon: MapPin },
            ],
          },
        ]
      : []),
    {
      heading: 'SYSTEM',
      items: [
        ...((isAdmin || isAccounts) ? [{ label: 'Data Integrity', href: '/admin/integrity', icon: ShieldCheck }] : []),
        { label: 'Audit History', href: '/audit', icon: History },
        ...(isAdmin ? [{ label: 'Backup & Restore', href: '/settings/backup', icon: Database }] : []),
        ...(isAdmin ? [{ label: 'Developer Portal', href: '/developer', icon: Terminal }] : []),
      ],
    },
  ];

  return (
    <aside className="w-60 bg-[#0B132B] text-slate-300 h-full overflow-y-auto p-3 flex flex-col justify-between shrink-0 border-r border-slate-800/80 custom-scrollbar">
      <div className="space-y-4">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="space-y-0.5">
            <div className="px-2.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wider">
              {group.heading}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300 font-semibold shadow-xs border-l-2 border-sky-400'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-800/80 text-[11px] font-mono text-slate-500 px-2">
        <span className="text-slate-400 font-semibold block truncate">{user.full_name}</span>
        <span>WaterGrid v1.0.0</span>
      </div>
    </aside>
  );
}
