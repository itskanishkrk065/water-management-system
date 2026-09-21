'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate } from '@/lib/utils';
import { Sliders, Plus, History, AlertCircle, X, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function RatesConfigurationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [litresPerAcre, setLitresPerAcre] = useState('10000');
  const [devCost, setDevCost] = useState('2.00');
  const [runningCost, setRunningCost] = useState('0.50');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('Periodic tariff review and indexing');
  const [error, setError] = useState<string | null>(null);

  // Projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  const selectedProjectId = projects?.[0]?.project_id;

  // Active Rate
  const { data: activeRate } = useQuery({
    queryKey: ['activeRate', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      const res = await apiClient.get('/rates/active', { params: { projectId: selectedProjectId } });
      return res.data;
    },
    enabled: !!selectedProjectId,
  });

  // Rate History
  const { data: history, isLoading } = useQuery({
    queryKey: ['rateHistory', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await apiClient.get('/rates/history', { params: { projectId: selectedProjectId } });
      return res.data;
    },
    enabled: !!selectedProjectId,
  });

  // Create Rate Version Mutation
  const createRateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/rates', {
        projectId: selectedProjectId,
        litresPerAcre: parseFloat(litresPerAcre),
        developmentCostPerLitre: parseFloat(devCost),
        runningCostPerLitre: parseFloat(runningCost),
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeRate', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['rateHistory', selectedProjectId] });
      setShowNewVersionModal(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create new rate version');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createRateMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Versioned Rate Configuration</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable tariff snapshots. Never overwrites in place; prior records retain their historical validity.
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setError(null);
              setShowNewVersionModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Effective Rate Version
          </button>
        )}
      </div>

      {/* Critical History Notice */}
      <div className="p-4 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start space-x-3">
        <History className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Historical Integrity Guarantee:</span> When new rates are activated,
          all existing water applications, allotments, development bills, and installments continue using the
          snapshot rate in effect at the moment they were created. They are NEVER retroactively recalculated.
        </div>
      </div>

      {/* Currently Active Rate Card */}
      {activeRate && (
        <div className="bg-white p-6 rounded-xl border-2 border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded">
              Currently Effective Active Tariff Version
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Effective Since: {formatDate(activeRate.effective_from)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Litres Per Acre</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatLitres(activeRate.litres_per_acre)}
              </div>
              <span className="text-[11px] text-slate-400">Baseline allocation multiplier</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Development Cost / Litre</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                ₹{Number(activeRate.development_cost_per_litre).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">5-Stage installment basis</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Running Cost / Litre</span>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                ₹{Number(activeRate.running_cost_per_litre).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">Post-commissioning fee</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Rate History Audit Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
          Historical Rate Versions &amp; Snapshots
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Version Rate ID</th>
                <th className="px-5 py-3.5">Litres / Acre</th>
                <th className="px-5 py-3.5">Development Cost / L</th>
                <th className="px-5 py-3.5">Running Cost / L</th>
                <th className="px-5 py-3.5">Effective Range</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Author</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading historical rate versions...
                  </td>
                </tr>
              ) : history && history.length > 0 ? (
                history.map((rate: any) => (
                  <tr key={rate.rate_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">{rate.rate_id.slice(0, 8)}...</td>
                    <td className="px-5 py-4 font-semibold text-slate-900">{formatLitres(rate.litres_per_acre)}</td>
                    <td className="px-5 py-4 font-bold text-emerald-700">₹{Number(rate.development_cost_per_litre).toFixed(2)}</td>
                    <td className="px-5 py-4 font-bold text-blue-700">₹{Number(rate.running_cost_per_litre).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-600">
                      {formatDate(rate.effective_from)} &rarr; {rate.effective_to ? formatDate(rate.effective_to) : 'Present (Active)'}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${rate.is_active ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600 border-slate-300'}`}>
                        {rate.is_active ? 'ACTIVE' : 'HISTORICAL'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-500">{rate.created_by}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No rate configurations found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW RATE VERSION MODAL */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Create New Effective Rate Version</h3>
              <button onClick={() => setShowNewVersionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Litres Per Acre *
                </label>
                <input
                  type="number"
                  required
                  value={litresPerAcre}
                  onChange={(e) => setLitresPerAcre(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Development Cost / Litre (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={devCost}
                  onChange={(e) => setDevCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Running Cost / Litre (INR) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={runningCost}
                  onChange={(e) => setRunningCost(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Effective Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reason for Revision
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowNewVersionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRateMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {createRateMutation.isPending ? 'Activating...' : 'Activate New Rate Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
