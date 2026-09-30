'use client';

import React, { useState } from 'react';
import { DeveloperApi } from '@/lib/developer-api';
import { Server, Zap, Trash2, CheckCircle2, AlertTriangle, Database } from 'lucide-react';

interface TestDataTabProps {
  onRefreshTelemetry: () => void;
}

export function TestDataTab({ onRefreshTelemetry }: TestDataTabProps) {
  // Generation State
  const [count, setCount] = useState<number>(5);
  const [includeHoldings, setIncludeHoldings] = useState<boolean>(true);
  const [includeWaterApplications, setIncludeWaterApplications] = useState<boolean>(true);
  const [includeApprovedAllotments, setIncludeApprovedAllotments] = useState<boolean>(true);
  const [includeBillingAndPayments, setIncludeBillingAndPayments] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [genResult, setGenResult] = useState<any | null>(null);

  // Purge State
  const [purgePhrase, setPurgePhrase] = useState<string>('');
  const [purging, setPurging] = useState<boolean>(false);
  const [purgeResult, setPurgeResult] = useState<any | null>(null);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setGenResult(null);
      const res = await DeveloperApi.generateTestData({
        count,
        includeHoldings,
        includeWaterApplications,
        includeApprovedAllotments,
        includeBillingAndPayments,
      });
      setGenResult(res);
      onRefreshTelemetry();
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePurge = async () => {
    if (purgePhrase !== 'PURGE TEST DATA') {
      alert('You must type exactly "PURGE TEST DATA" to confirm.');
      return;
    }

    try {
      setPurging(true);
      setPurgeError(null);
      setPurgeResult(null);
      const res = await DeveloperApi.purgeTestData(purgePhrase);
      setPurgeResult(res);
      setPurgePhrase('');
      onRefreshTelemetry();
    } catch (err: any) {
      setPurgeError(err.response?.data?.message || err.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Synthetic Test Data Generator */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
          <Server className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-mono font-bold text-white uppercase">
            SYNTHETIC TEST DATA GENERATOR
          </h3>
        </div>

        <p className="text-xs font-mono text-slate-400">
          Generates isolated test records tagged with <strong className="text-emerald-300">[TEST_SYNTHETIC_DATA]</strong>. Real production data is never modified.
        </p>

        <div className="space-y-3 text-xs font-mono">
          <div>
            <label className="text-slate-300 block mb-1">Number of Synthetic Farmers to Create:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-300 font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-2 p-3 bg-slate-950 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-bold block mb-1">Include Linked Entities:</span>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeHoldings}
                onChange={(e) => setIncludeHoldings(e.target.checked)}
                className="rounded border-slate-800 text-emerald-600 bg-slate-900"
              />
              <span>Generate Land Holdings & Survey Parcels</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeWaterApplications}
                onChange={(e) => setIncludeWaterApplications(e.target.checked)}
                className="rounded border-slate-800 text-emerald-600 bg-slate-900"
              />
              <span>Generate Water Applications</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeApprovedAllotments}
                onChange={(e) => setIncludeApprovedAllotments(e.target.checked)}
                className="rounded border-slate-800 text-emerald-600 bg-slate-900"
              />
              <span>Generate Approved Water Allotments</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeBillingAndPayments}
                onChange={(e) => setIncludeBillingAndPayments(e.target.checked)}
                className="rounded border-slate-800 text-emerald-600 bg-slate-900"
              />
              <span>Generate 5-Installment Development Bills & Schedules</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
        >
          <Zap className="w-3.5 h-3.5" />
          <span>{generating ? 'Generating Test Data...' : `Generate ${count} Test Records`}</span>
        </button>

        {genResult && (
          <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs font-mono text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Generated {genResult.recordsCreated} synthetic test records!</span>
            </div>
            <span className="text-slate-400 text-[11px] block">
              Batch Run ID: #{genResult.batchRunId} • Marker: {genResult.marker}
            </span>
          </div>
        )}
      </div>

      {/* Test Data Isolated Purge */}
      <div className="bg-slate-900/90 border border-rose-900/50 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              ISOLATED TEST DATA PURGE
            </h3>
          </div>

          <p className="text-xs font-mono text-slate-400">
            Safely purges ONLY records tagged with <strong className="text-rose-300">[TEST_SYNTHETIC_DATA]</strong> or <strong className="text-rose-300">[DEMO]</strong>. Real production data is completely untouched.
          </p>

          <div className="p-4 bg-slate-950 rounded-xl border border-rose-900/70 space-y-3 text-xs font-mono">
            <label className="text-rose-300 font-bold block">
              TYPE <span className="text-white bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700">PURGE TEST DATA</span> TO CONFIRM:
            </label>
            <input
              type="text"
              placeholder="PURGE TEST DATA"
              value={purgePhrase}
              onChange={(e) => setPurgePhrase(e.target.value)}
              className="w-full p-2.5 bg-slate-900 border border-rose-700 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
            />
          </div>

          {purgeError && (
            <div className="p-3 bg-rose-950 border border-rose-800 rounded-lg text-rose-300 text-xs font-mono">
              {purgeError}
            </div>
          )}

          {purgeResult && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs font-mono text-emerald-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{purgeResult.message}</span>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handlePurge}
          disabled={purgePhrase !== 'PURGE TEST DATA' || purging}
          className="w-full py-2 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition disabled:opacity-40 shadow-md flex items-center justify-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{purging ? 'Purging Test Data...' : 'Purge All Synthetic Test Data'}</span>
        </button>
      </div>
    </div>
  );
}
