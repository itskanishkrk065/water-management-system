'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { LogOut, Shield, Droplet } from 'lucide-react';
import Link from 'next/link';

export default function Navbar() {
  const { user, logout, switchRoleQuick } = useAuth();

  if (!user) return null;

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href={user.role === 'BENEFICIARY' ? '/beneficiary/dashboard' : '/dashboard'} className="flex items-center space-x-2">
            <div className="bg-sky-600 p-2 rounded-lg text-white">
              <Droplet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">WaterGrid V1</span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full">
                {user.role === 'BENEFICIARY' ? 'Beneficiary Portal' : 'Production-Grade'}
              </span>
            </div>
          </Link>
        </div>

        {/* Quick Role Switcher for seamless demo / test evaluation */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="px-2 font-medium text-slate-500">Switch Role:</span>
            <button
              onClick={() => switchRoleQuick('ADMIN')}
              className={`px-2 py-1 rounded font-semibold transition ${
                user.role === 'ADMIN'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ADMIN
            </button>
            <button
              onClick={() => switchRoleQuick('FIELD_OFFICER')}
              className={`px-2 py-1 rounded font-semibold transition ${
                user.role === 'FIELD_OFFICER'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              FIELD
            </button>
            <button
              onClick={() => switchRoleQuick('ACCOUNTS')}
              className={`px-2 py-1 rounded font-semibold transition ${
                user.role === 'ACCOUNTS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ACCOUNTS
            </button>
            <button
              onClick={() => switchRoleQuick('VIEWER')}
              className={`px-2 py-1 rounded font-semibold transition ${
                user.role === 'VIEWER'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              VIEWER
            </button>
            <button
              onClick={() => switchRoleQuick('BENEFICIARY')}
              className={`px-2 py-1 rounded font-semibold transition ${
                user.role === 'BENEFICIARY'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              BENEFICIARY
            </button>
          </div>

          <div className="flex items-center space-x-2 pl-3 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-800 leading-tight">{user.full_name}</div>
              <div className="text-xs text-slate-500 flex items-center justify-end space-x-1">
                <Shield className="w-3 h-3 text-sky-600" />
                <span>{user.role}</span>
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
