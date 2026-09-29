'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LogOut, Droplet, Search, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import GlobalSearchModal from './GlobalSearchModal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Global keyboard shortcut (⌘K or Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  const roleLabelMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
    ADMIN: { label: 'ADMINISTRATOR', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    FIELD_OFFICER: { label: 'FIELD OFFICER', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    ACCOUNTS: { label: 'ACCOUNTS OFFICER', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    VIEWER: { label: 'VIEWER (READ-ONLY)', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
    BENEFICIARY: { label: 'BENEFICIARY', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  };

  const currentRoleConfig = roleLabelMap[user.role] || {
    label: user.role,
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  };

  const userInitial = (user.full_name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Wordmark */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link
              href={user.role === 'BENEFICIARY' ? '/beneficiary/dashboard' : '/dashboard'}
              className="flex items-center gap-2.5 group"
            >
              <div className="bg-gradient-to-br from-sky-500 to-sky-600 p-2 rounded-xl text-white shadow-sm group-hover:from-sky-600 group-hover:to-sky-700 transition">
                <Droplet className="w-5 h-5 fill-white" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-lg tracking-tight">WaterGrid</span>
                <span className="font-semibold text-sky-600 text-sm">V1</span>
                <span className="hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-full">
                  {user.role === 'BENEFICIARY' ? 'Beneficiary Portal' : 'Production-Grade'}
                </span>
              </div>
            </Link>
          </div>

          {/* Centered Global Search Omnibox */}
          {user.role !== 'BENEFICIARY' && (
            <div className="flex-1 max-w-lg mx-2 hidden md:block">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center justify-between px-3.5 py-1.5 bg-slate-100/70 hover:bg-slate-100 text-slate-500 rounded-xl border border-slate-200/80 hover:border-slate-300 transition group shadow-inner"
              >
                <div className="flex items-center gap-2 text-left truncate">
                  <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700 truncate">
                    Search beneficiaries, survey no., applications, bills...
                  </span>
                </div>
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-white rounded border border-slate-300/80 text-[10px] font-mono text-slate-500 shadow-sm shrink-0 ml-2">
                  <span className="text-[9px]">⌘</span>K
                </div>
              </button>
            </div>
          )}

          {/* Right Side: Authenticated User & Actions */}
          <div className="flex items-center space-x-3 shrink-0">
            {/* Mobile Search Icon Button */}
            {user.role !== 'BENEFICIARY' && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-2 text-slate-500 hover:text-sky-600 hover:bg-slate-100 rounded-xl transition"
                title="Search (Ctrl+K)"
              >
                <Search className="w-5 h-5" />
              </button>
            )}

            {/* Authenticated User Status */}
            <div className="flex items-center gap-3 pl-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shadow-inner">
                {userInitial}
              </div>
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[160px]">
                  {user.full_name || 'Administrator'}
                </div>
                <div className="mt-0.5">
                  <span
                    className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${currentRoleConfig.bg} ${currentRoleConfig.text} ${currentRoleConfig.border}`}
                  >
                    {currentRoleConfig.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Sign out of WaterGrid"
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Global Search Omnibox Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
