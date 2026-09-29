'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LogOut, Shield, Droplet, Search, Command } from 'lucide-react';
import Link from 'next/link';
import GlobalSearchModal from './GlobalSearchModal';

export default function Navbar() {
  const { user, logout, switchRoleQuick } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 shrink-0">
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

          {/* Global Search Omnibox Trigger */}
          {user.role !== 'BENEFICIARY' && (
            <div className="flex-1 max-w-md hidden md:block">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-1.5 bg-slate-100/80 hover:bg-slate-100 text-slate-500 rounded-xl border border-slate-200/80 transition group shadow-inner"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
                    Search anything (beneficiary, survey #, app, bill, scheme)...
                  </span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white rounded border border-slate-300 text-[10px] font-mono text-slate-500">
                  <span className="text-[9px]">⌘</span>K
                </div>
              </button>
            </div>
          )}

          {/* Quick Role Switcher for seamless demo / test evaluation */}
          <div className="flex items-center space-x-3">
            {user.role !== 'BENEFICIARY' && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition"
                title="Search (Ctrl+K)"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            <div className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
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

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

