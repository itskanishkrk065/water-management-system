'use client';

import React from 'react';
import Link from 'next/link';
import { Sliders, Layers, MapPin, Database, ArrowRight, ShieldCheck } from 'lucide-react';

export default function SettingsHubPage() {
  const settingsModules = [
    {
      title: 'Rate Tariff & Volume Pricing',
      description: 'Configure and historically version per-acre water quotas, development costs, and running tariffs.',
      href: '/settings/rates',
      icon: Sliders,
      badge: 'Active Tariff: ₹0.05/L',
      color: 'sky',
    },
    {
      title: '5-Stage Installment Templates',
      description: 'Manage 5-milestone payment installment schedules and percentage distributions (totals 100%).',
      href: '/settings/installments',
      icon: Layers,
      badge: '5 Milestones Configured',
      color: 'indigo',
    },
    {
      title: 'Official Location Hierarchy',
      description: 'LGD-verified District → Block → Village revenue master data for Coimbatore and Tiruppur.',
      href: '/settings/locations',
      icon: MapPin,
      badge: '493 Villages Mastered',
      color: 'emerald',
    },
    {
      title: 'Database & Offline Backups',
      description: 'Local SQLite data integrity diagnostics, disaster recovery checkpoints, and .wmbak archive generation.',
      href: '/settings/backup',
      icon: Database,
      badge: 'Offline WAL Mode',
      color: 'amber',
    },
    {
      title: 'Developer Portal & Clean State',
      description: 'Internal engineering console, SQLite master explorer, SQL query plan runner, duplicate detector, and clean state protocol.',
      href: '/developer',
      icon: ShieldCheck,
      badge: 'Engineering Master Console',
      color: 'emerald',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Administrative Configuration & Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          System governance, historical rate tariffs, location master trees, and offline SQLite backup management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {settingsModules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.href}
              href={mod.href}
              className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md hover:border-sky-300 transition group flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center group-hover:bg-sky-50 group-hover:text-sky-600 transition">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-1 text-[11px] font-bold rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                    {mod.badge}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{mod.description}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600 group-hover:text-sky-600">
                <span>Manage Configuration</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
