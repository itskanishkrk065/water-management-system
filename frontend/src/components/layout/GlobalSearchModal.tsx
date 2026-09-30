'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  User,
  MapPin,
  FileText,
  CreditCard,
  Briefcase,
  Layers,
  ArrowRight,
  Loader2,
  CornerDownLeft,
  PlusCircle,
  Shield,
  Activity,
  Droplets,
  Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface GlobalSearchResultItem {
  id: string;
  category: 'BENEFICIARY' | 'LAND_HOLDING' | 'WATER_APPLICATION' | 'BILL' | 'PAYMENT' | 'PROJECT_SCHEME' | 'LOCATION';
  title: string;
  subtitle: string;
  status?: string;
  link: string;
  metadata?: any;
}

export interface GlobalSearchResponse {
  term: string;
  totalResults: number;
  categories: {
    beneficiaries: GlobalSearchResultItem[];
    landHoldings: GlobalSearchResultItem[];
    waterApplications: GlobalSearchResultItem[];
    bills: GlobalSearchResultItem[];
    payments: GlobalSearchResultItem[];
    projectSchemes: GlobalSearchResultItem[];
    locations: GlobalSearchResultItem[];
  };
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
      setResults(null);
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await apiClient.get('/search/global', {
          params: { q: searchTerm.trim(), limit: 8 },
        });
        setResults(res.data);
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  if (!isOpen) return null;

  const handleNavigate = (link: string) => {
    onClose();
    router.push(link);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'BENEFICIARY':
        return <User className="w-4 h-4 text-sky-600" />;
      case 'LAND_HOLDING':
        return <Layers className="w-4 h-4 text-emerald-600" />;
      case 'WATER_APPLICATION':
        return <Droplets className="w-4 h-4 text-sky-600" />;
      case 'BILL':
        return <FileText className="w-4 h-4 text-amber-600" />;
      case 'PAYMENT':
        return <CreditCard className="w-4 h-4 text-purple-600" />;
      case 'PROJECT_SCHEME':
        return <Briefcase className="w-4 h-4 text-indigo-600" />;
      case 'LOCATION':
        return <MapPin className="w-4 h-4 text-rose-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-500" />;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'BENEFICIARY':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'LAND_HOLDING':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'WATER_APPLICATION':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'BILL':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'PAYMENT':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'PROJECT_SCHEME':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'LOCATION':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const commandShortcuts = [
    { label: 'Register New Beneficiary', href: '/beneficiaries/new', icon: PlusCircle, category: 'COMMAND' },
    { label: 'Submit Water Application', href: '/water/applications/new', icon: Droplets, category: 'COMMAND' },
    { label: 'Record New Payment', href: '/payments', icon: CreditCard, category: 'COMMAND' },
    { label: 'Run Data Integrity Audit', href: '/admin/integrity', icon: Activity, category: 'COMMAND' },
    { label: 'Open Developer Master Console', href: '/developer', icon: Shield, category: 'COMMAND' },
  ];

  // Compile all filtered results
  const allItems: GlobalSearchResultItem[] = results
    ? [
        ...(results.categories.beneficiaries || []),
        ...(results.categories.landHoldings || []),
        ...(results.categories.waterApplications || []),
        ...(results.categories.bills || []),
        ...(results.categories.payments || []),
        ...(results.categories.projectSchemes || []),
        ...(results.categories.locations || []),
      ]
    : [];

  const displayItems =
    activeCategory === 'ALL'
      ? allItems
      : allItems.filter((i) => i.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-20 animate-in fade-in duration-100">
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-3.5 border-b border-slate-200 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search beneficiary, phone, survey #, app #, bill #, receipt #, or command..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && displayItems.length > 0) {
                handleNavigate(displayItems[0].link);
              }
            }}
            className="flex-1 bg-transparent border-none text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-0 font-medium"
          />
          {loading && <Loader2 className="w-4 h-4 text-sky-600 animate-spin shrink-0" />}
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded text-[11px] font-mono font-semibold">
            ESC
          </kbd>
        </div>

        {/* Category Filter Pills */}
        {results && results.totalResults > 0 && (
          <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs bg-white custom-scrollbar">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                activeCategory === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({results.totalResults})
            </button>
            {results.categories.beneficiaries?.length > 0 && (
              <button
                onClick={() => setActiveCategory('BENEFICIARY')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeCategory === 'BENEFICIARY'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-100'
                }`}
              >
                Beneficiaries ({results.categories.beneficiaries.length})
              </button>
            )}
            {results.categories.landHoldings?.length > 0 && (
              <button
                onClick={() => setActiveCategory('LAND_HOLDING')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeCategory === 'LAND_HOLDING'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                }`}
              >
                Land ({results.categories.landHoldings.length})
              </button>
            )}
            {results.categories.waterApplications?.length > 0 && (
              <button
                onClick={() => setActiveCategory('WATER_APPLICATION')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeCategory === 'WATER_APPLICATION'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100'
                }`}
              >
                Applications ({results.categories.waterApplications.length})
              </button>
            )}
            {results.categories.bills?.length > 0 && (
              <button
                onClick={() => setActiveCategory('BILL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeCategory === 'BILL'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100'
                }`}
              >
                Bills ({results.categories.bills.length})
              </button>
            )}
            {results.categories.payments?.length > 0 && (
              <button
                onClick={() => setActiveCategory('PAYMENT')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  activeCategory === 'PAYMENT'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-100'
                }`}
              >
                Payments ({results.categories.payments.length})
              </button>
            )}
          </div>
        )}

        {/* Results & Quick Commands List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 custom-scrollbar">
          {!searchTerm || searchTerm.length < 2 ? (
            <div className="space-y-4 p-2">
              <div>
                <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-2 px-1">
                  Quick Action Shortcuts
                </span>
                <div className="space-y-1">
                  {commandShortcuts.map((cmd, idx) => {
                    const Icon = cmd.icon;
                    return (
                      <div
                        key={idx}
                        onClick={() => handleNavigate(cmd.href)}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50/70 cursor-pointer transition border border-transparent hover:border-sky-100 text-xs text-slate-700 group"
                      >
                        <div className="flex items-center gap-2.5 font-medium">
                          <Icon className="w-4 h-4 text-sky-600 group-hover:scale-110 transition" />
                          <span>{cmd.label}</span>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition" />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-xs flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Tip: Type at least 2 characters to search across beneficiaries, survey parcels, water applications, and receipts.
                </span>
              </div>
            </div>
          ) : loading && !results ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 mx-auto text-sky-600 animate-spin mb-2" />
              <p className="text-xs text-slate-500 font-medium">Searching registry records...</p>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <p className="text-sm font-medium text-slate-700">No records found for &quot;{searchTerm}&quot;</p>
              <p className="text-xs text-slate-400 mt-1">
                Try checking the phone number, survey number, or scheme code.
              </p>
            </div>
          ) : (
            displayItems.map((item) => (
              <div
                key={`${item.category}-${item.id}`}
                onClick={() => handleNavigate(item.link)}
                className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-sky-50/70 cursor-pointer transition border border-transparent hover:border-sky-100"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 group-hover:bg-white group-hover:shadow-xs shrink-0 transition">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs text-slate-900 group-hover:text-sky-900 truncate">
                        {item.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded border ${getCategoryBadgeColor(
                          item.category,
                        )}`}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                      {item.status && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {item.status}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-slate-400 group-hover:text-sky-600 text-xs font-medium shrink-0 ml-2">
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-slate-600">
              <CornerDownLeft className="w-3 h-3" /> Select / Enter
            </span>
          </div>
          <div>
            <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">ESC</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
