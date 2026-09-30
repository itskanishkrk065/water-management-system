'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2, CheckCircle2, AlertTriangle, Layers, Zap } from 'lucide-react';

export function CacheDiagnosticsTab() {
  const queryClient = useQueryClient();
  const [invalidationStatus, setInvalidationStatus] = useState<string | null>(null);

  // Extract active query cache items
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();

  const handleInvalidateAll = async () => {
    await queryClient.invalidateQueries();
    setInvalidationStatus('All active application queries invalidated and re-fetched.');
    setTimeout(() => setInvalidationStatus(null), 4000);
  };

  const handleClearCache = () => {
    queryClient.clear();
    setInvalidationStatus('TanStack query cache completely purged.');
    setTimeout(() => setInvalidationStatus(null), 4000);
  };

  const handleInvalidateKey = async (queryKey: readonly unknown[]) => {
    await queryClient.invalidateQueries({ queryKey });
    setInvalidationStatus(`Query key [${queryKey.join(', ')}] invalidated.`);
    setTimeout(() => setInvalidationStatus(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-400">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">CACHE & REFRESH TROUBLESHOOTING</h2>
            <p className="text-xs font-mono text-slate-400">
              TanStack Query cache telemetry • Fix UI state desync without needing Cmd+R
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInvalidateAll}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Invalidate All Queries</span>
          </button>
          <button
            onClick={handleClearCache}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 border border-slate-700 font-mono text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge Cache</span>
          </button>
        </div>
      </div>

      {invalidationStatus && (
        <div className="p-3 bg-cyan-950/80 border border-cyan-800 rounded-lg text-xs font-mono text-cyan-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          {invalidationStatus}
        </div>
      )}

      {/* Why Cmd+R Happens Explanation Box */}
      <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2 text-amber-400 font-bold">
          <Zap className="w-4 h-4" />
          <span>UNDERSTANDING "CMD+R FIXES IT" CACHE DESYNC:</span>
        </div>
        <p className="text-slate-300 leading-relaxed">
          When mutations occur in one component (e.g. creating a land holding or recording a payment), dependent queries in other modules may remain in TanStack cache with stale timestamps unless explicitly invalidated with matching query keys. Use the Invalidate button below to re-synchronize without reloading the browser window.
        </p>
      </div>

      {/* Active Cache Queries List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              ACTIVE CACHED QUERY KEYS ({queries.length})
            </h3>
          </div>
        </div>

        {queries.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No active queries in memory. Navigate to business modules to populate cache.
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {queries.map((q, idx) => {
              const keyStr = JSON.stringify(q.queryKey);
              const state = q.state;
              const isStale = q.isStale();
              const isFetching = state.fetchStatus === 'fetching';

              return (
                <div
                  key={idx}
                  className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div>
                    <span className="text-emerald-400 font-bold select-all">{keyStr}</span>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span>Status: <strong className="text-slate-200">{state.status}</strong></span>
                      <span>Stale: <strong className={isStale ? 'text-amber-400' : 'text-emerald-400'}>{isStale ? 'YES' : 'NO'}</strong></span>
                      <span>Observers: <strong className="text-slate-200">{q.getObserversCount()}</strong></span>
                      <span>Last Updated: <strong className="text-slate-200">{new Date(state.dataUpdatedAt).toLocaleTimeString()}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleInvalidateKey(q.queryKey)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-cyan-900 text-slate-300 hover:text-cyan-300 border border-slate-700 text-xs transition"
                    >
                      Invalidate
                    </button>
                    <button
                      onClick={() => q.fetch()}
                      disabled={isFetching}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-900 text-slate-300 hover:text-emerald-300 border border-slate-700 text-xs transition disabled:opacity-40"
                    >
                      {isFetching ? 'Fetching...' : 'Refetch'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
