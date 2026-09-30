'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { LogOut, Droplet, Search, User, Shield, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import GlobalSearchModal from './GlobalSearchModal';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  if (!user) return null;

  const isBeneficiary = user.role === 'BENEFICIARY';
  const userInitial = (user.full_name || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shrink-0 shadow-xs">
        <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link
              href={isBeneficiary ? '/beneficiary/dashboard' : '/dashboard'}
              className="flex items-center gap-2 group"
            >
              <div className="bg-sky-600 p-1.5 rounded-lg text-white shadow-xs group-hover:bg-sky-700 transition">
                <Droplet className="w-4 h-4 fill-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 text-base tracking-tight font-sans">WaterGrid</span>
                <span className="font-mono font-bold text-sky-600 text-xs">V1</span>
                <span className="hidden sm:inline-flex text-[10px] font-mono font-medium px-2 py-0.2 bg-slate-100 text-slate-600 border border-slate-200 rounded">
                  {isBeneficiary ? 'FARMER PORTAL' : 'PRODUCTION'}
                </span>
              </div>
            </Link>
          </div>

          {/* Centered Global Command Omnibox */}
          {!isBeneficiary && (
            <div className="flex-1 max-w-md mx-2 hidden md:block">
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 transition text-xs shadow-inner"
              >
                <div className="flex items-center gap-2 truncate">
                  <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">Search beneficiaries, survey, water apps...</span>
                </div>
                <kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-[10px] font-mono text-slate-500 shadow-xs shrink-0">
                  {typeof window !== 'undefined' && /Mac/.test(navigator.userAgent) ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            </div>
          )}

          {/* Right: User Account Dropdown */}
          <div className="flex items-center space-x-2 shrink-0">
            {!isBeneficiary && (
              <button
                onClick={() => setIsSearchOpen(true)}
                className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                title="Search (⌘K)"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 p-1 pl-2 pr-1.5 rounded-lg hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                    {user.full_name}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 capitalize">
                    {user.role.toLowerCase().replace('_', ' ')}
                  </div>
                </div>
                <div className="h-7 w-7 rounded-lg bg-sky-100 text-sky-700 border border-sky-200 flex items-center justify-center font-bold text-xs">
                  {userInitial}
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1 z-40 text-xs">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <div className="font-semibold text-slate-900 truncate">{user.full_name}</div>
                    <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  </div>

                  <Link
                    href={isBeneficiary ? '/beneficiary/profile' : '/settings'}
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition"
                  >
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Account Profile</span>
                  </Link>

                  <Link
                    href="/developer"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-slate-700 hover:bg-slate-50 transition"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Developer Console</span>
                  </Link>

                  <div className="border-t border-slate-100 my-1" />

                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ⌘K Global Omnibox Palette Overlay */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
