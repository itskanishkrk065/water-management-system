'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { fetchSyncDiagnostics, triggerDeviceSync } from '@/lib/sync-client';

export interface SyncDiagnostics {
  state: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'ATTENTION_REQUIRED';
  deviceId: string;
  pendingOutboxCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export default function SyncStatusBanner() {
  const { user } = useAuth();
  const pathname = usePathname();

  const isUnauthenticatedRoute =
    !user ||
    pathname === '/login' ||
    pathname === '/beneficiary/login' ||
    pathname?.startsWith('/login');

  const [diag, setDiag] = useState<SyncDiagnostics | null>(null);
  const [isDraining, setIsDraining] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchDiagnosticsData = useCallback(async () => {
    if (isUnauthenticatedRoute) return;
    try {
      const data = await fetchSyncDiagnostics();
      setDiag(data);
    } catch {
      setDiag((prev) =>
        prev
          ? { ...prev, state: 'OFFLINE' }
          : {
              state: 'OFFLINE',
              deviceId: 'LOCAL-DESKTOP',
              pendingOutboxCount: 0,
              conflictCount: 0,
              lastSyncAt: null,
              lastError: 'Server unreachable',
            },
      );
    }
  }, [isUnauthenticatedRoute]);

  useEffect(() => {
    if (isUnauthenticatedRoute) return;
    fetchDiagnosticsData();
    const interval = setInterval(fetchDiagnosticsData, 15000);
    window.addEventListener('focus', fetchDiagnosticsData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', fetchDiagnosticsData);
    };
  }, [fetchDiagnosticsData, isUnauthenticatedRoute]);

  if (isUnauthenticatedRoute || !diag || dismissed) return null;

  const handleDrainNow = async () => {
    setIsDraining(true);
    try {
      await triggerDeviceSync();
      await fetchDiagnosticsData();
    } catch {
      // Handled by diagnostics state
    } finally {
      setIsDraining(false);
    }
  };

  if (!diag || dismissed) return null;

  // Formatting timestamp
  let timeStr = 'Never';
  if (diag.lastSyncAt) {
    const diffMin = Math.round((Date.now() - new Date(diag.lastSyncAt).getTime()) / 60000);
    timeStr = diffMin <= 0 ? 'Just now' : `${diffMin}m ago`;
  }

  const isConflict = diag.state === 'ATTENTION_REQUIRED' || diag.conflictCount > 0;
  const isOffline = diag.state === 'OFFLINE';
  const isSyncing = diag.state === 'SYNCING' || isDraining;

  // Dynamic Theme Colors
  let bgGradient = 'bg-slate-900/90 border-slate-700/60 text-slate-200';
  let badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  let statusText = `● Online | Synced ${timeStr}`;

  if (isConflict) {
    bgGradient = 'bg-rose-950/90 border-rose-700/60 text-rose-100';
    badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse';
    statusText = `⚠ Attention Required | ${diag.conflictCount} conflict(s) require review`;
  } else if (isSyncing) {
    bgGradient = 'bg-sky-950/90 border-sky-700/60 text-sky-100';
    badgeColor = 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    statusText = `↻ Syncing (${diag.pendingOutboxCount} pending)...`;
  } else if (isOffline) {
    bgGradient = 'bg-amber-950/90 border-amber-700/60 text-amber-100';
    badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    statusText = `● Offline | ${diag.pendingOutboxCount} operation(s) queued in local outbox`;
  }

  return (
    <aside
      aria-label="WaterGrid Central Sync Status"
      className={`sticky top-0 z-50 backdrop-blur-md border-b px-4 py-2 transition-all duration-300 shadow-md ${bgGradient}`}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: State Pill & Information */}
        <div className="flex items-center gap-3">
          <span className={`px-2.5 py-1 rounded-full font-medium border text-[11px] flex items-center gap-1.5 ${badgeColor}`}>
            <span
              className={`w-2 h-2 rounded-full ${
                isConflict
                  ? 'bg-rose-400 animate-ping'
                  : isSyncing
                  ? 'bg-sky-400 animate-spin'
                  : isOffline
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            {statusText}
          </span>

          <span className="hidden sm:inline text-slate-400">
            Node: <span className="font-mono text-slate-300">{diag.deviceId}</span>
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDrainNow}
            disabled={isSyncing}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-medium rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isSyncing ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Syncing...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync Now
              </>
            )}
          </button>

          <Link
            href="/sync-center"
            className="px-3 py-1 bg-sky-600/80 hover:bg-sky-500 text-white font-medium rounded transition flex items-center gap-1 shadow-sm"
          >
            <span>Sync Center</span>
            {diag.conflictCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {diag.conflictCount}
              </span>
            )}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10"
            title="Dismiss banner"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
