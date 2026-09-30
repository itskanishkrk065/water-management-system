'use client';

import React from 'react';
import { Shield, Database, Terminal, Server, AlertTriangle, Lock, RefreshCw, Cpu, Activity } from 'lucide-react';

export type DeveloperMode = 'READ_ONLY' | 'CONTROLLED_WRITE' | 'DESTRUCTIVE_RESET';

interface DeveloperHeaderProps {
  currentMode: DeveloperMode;
  onModeChange: (mode: DeveloperMode) => void;
  environment: string;
  isProduction: boolean;
  onRefreshAll: () => void;
  isRefreshing?: boolean;
}

export function DeveloperHeader({
  currentMode,
  onModeChange,
  environment,
  isProduction,
  onRefreshAll,
  isRefreshing = false,
}: DeveloperHeaderProps) {
  return (
    <div className="bg-[#0D1322] border-b border-slate-800/80 px-6 py-4 sticky top-0 z-40 shadow-xl backdrop-blur-md">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Brand & Badges */}
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold shadow-inner">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-mono flex items-center gap-2">
                WATERGRID <span className="text-emerald-400 text-xs px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/50">ENG-CONSOLE</span>
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                v1.0.0-OFFLINE
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Internal Engineering Control Console • SQLite + Electron Runtime
            </p>
          </div>
        </div>

        {/* Center: Environment & Operating Mode */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Environment Classification */}
          <div className={`px-3 py-1 rounded-md text-xs font-mono font-semibold border flex items-center gap-1.5 ${
            isProduction
              ? 'bg-rose-950/50 border-rose-800/60 text-rose-300'
              : 'bg-indigo-950/50 border-indigo-800/60 text-indigo-300'
          }`}>
            {isProduction ? <Lock className="w-3.5 h-3.5 text-rose-400" /> : <Server className="w-3.5 h-3.5 text-indigo-400" />}
            <span>ENV: {environment.toUpperCase()}</span>
          </div>

          {/* Operating Mode Selector with prominent badge */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => onModeChange('READ_ONLY')}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                currentMode === 'READ_ONLY'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              READ ONLY
            </button>
            <button
              onClick={() => onModeChange('CONTROLLED_WRITE')}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                currentMode === 'CONTROLLED_WRITE'
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              CONTROLLED WRITE
            </button>
            <button
              onClick={() => onModeChange('DESTRUCTIVE_RESET')}
              className={`px-3 py-1 text-xs font-mono font-semibold rounded transition-all ${
                currentMode === 'DESTRUCTIVE_RESET'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              DESTRUCTIVE / RESET
            </button>
          </div>

          {/* Prominent Mode Badge */}
          <div
            className={`px-3 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider border flex items-center gap-1.5 animate-pulse ${
              currentMode === 'READ_ONLY'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                : currentMode === 'CONTROLLED_WRITE'
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>DEVELOPER MODE — {currentMode.replace('_', ' ')}</span>
          </div>

          {/* Quick Refresh All */}
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition disabled:opacity-50"
            title="Refresh System Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
