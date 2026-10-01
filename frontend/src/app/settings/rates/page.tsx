'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate } from '@/lib/utils';
import { Sliders, Plus, History, AlertCircle, X, ShieldAlert, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import PageHeader from '@/components/ui/PageHeader';

export default function RatesConfigurationPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [litresPerAcre, setLitresPerAcre] = useState('10000');
  const [devCost, setDevCost] = useState('2.00');
  const [runningCost, setRunningCost] = useState('0.50');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [versionCode, setVersionCode] = useState('');
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

  // Timeline (Current, Future, Historical)
  const { data: timelineData, isLoading } = useQuery({
    queryKey: ['ratesTimeline', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return { current: [], future: [], historical: [] };
      const res = await apiClient.get('/rates/timeline', { params: { projectId: selectedProjectId } });
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
        versionCode: versionCode || undefined,
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeRate', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['ratesTimeline', selectedProjectId] });
      queryClient.invalidateQueries({ queryKey: ['rateHistory', selectedProjectId] });
      setShowNewVersionModal(false);
      setVersionCode('');
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

  const renderTariffTable = (tariffs: any[], emptyLabel: string) => {
    if (!tariffs || tariffs.length === 0) {
      return (
        <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
          {emptyLabel}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3">Version / ID</th>
              <th className="px-4 py-3">Litres / Acre</th>
              <th className="px-4 py-3">Dev Rate / L</th>
              <th className="px-4 py-3">Running Rate / L</th>
              <th className="px-4 py-3">Effective Date Range</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {tariffs.map((rate: any) => (
              <tr key={rate.rate_id} className="hover:bg-slate-50/50 transition">
                <td className="px-4 py-3 font-mono font-bold text-slate-800">
                  {rate.version_code || `TRF-${rate.rate_id.slice(0, 8)}`}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">{formatLitres(rate.litres_per_acre)}</td>
                <td className="px-4 py-3 font-bold text-emerald-700">₹{Number(rate.development_cost_per_litre).toFixed(2)} / L</td>
                <td className="px-4 py-3 font-bold text-sky-700">₹{Number(rate.running_cost_per_litre).toFixed(2)} / L</td>
                <td className="px-4 py-3 font-mono text-slate-600">
                  {formatDate(rate.effective_from)} &rarr; {rate.effective_to ? formatDate(rate.effective_to) : 'Open (Current)'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${
                      rate.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : new Date(rate.effective_from) > new Date()
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {rate.is_active ? 'ACTIVE' : new Date(rate.effective_from) > new Date() ? 'SCHEDULED FUTURE' : 'HISTORICAL'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{rate.created_by || 'ADMIN'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Effective-Dated Tariff Engine"
        description="Versioned master rate configurations. Changes automatically apply to future calculations; existing historical bills permanently retain their rate snapshots."
        badge="Tariff Engine"
        actions={
          user?.role === 'ADMIN' ? (
            <button
              onClick={() => {
                setError(null);
                setShowNewVersionModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Create Effective-Dated Tariff
            </button>
          ) : undefined
        }
      />

      {/* Critical History Notice */}
      <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl text-xs text-sky-900 flex items-start space-x-3">
        <History className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Historical Financial Immutability:</span> When a new tariff version is published,
          all existing development bills, 5-stage installments, running bills, and payment records permanently retain
          the tariff rate snapshot under which they were generated. Master tariff modifications NEVER mutate historical bills.
        </div>
      </div>

      {/* Currently Active Rate Card */}
      {activeRate && (
        <div className="bg-white p-6 rounded-2xl border-2 border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg">
              Currently Effective Active Tariff: {activeRate.version_code || `TRF-${activeRate.rate_id.slice(0, 8)}`}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Effective Since: {formatDate(activeRate.effective_from)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Litres Per Acre</span>
              <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                {formatLitres(activeRate.litres_per_acre)}
              </div>
              <span className="text-[11px] text-slate-400">Baseline allocation multiplier</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Development Cost / Litre</span>
              <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">
                ₹{Number(activeRate.development_cost_per_litre).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">5-Stage installment development rate</span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-semibold">Running Cost / Litre</span>
              <div className="text-2xl font-bold text-sky-700 mt-1 font-mono">
                ₹{Number(activeRate.running_cost_per_litre).toFixed(2)}
              </div>
              <span className="text-[11px] text-slate-400">Post-commissioning operation rate</span>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Future Tariffs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          <h2 className="text-sm font-bold text-slate-900">Scheduled Future Tariffs</h2>
        </div>
        <p className="text-xs text-slate-500">
          Tariffs configured to automatically become active on future dates. New bills generated on or after their effective date will resolve these rates.
        </p>
        {renderTariffTable(timelineData?.future || [], 'No future tariffs scheduled.')}
      </div>

      {/* Historical Tariffs */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Historical Tariffs &amp; Snapshots</h2>
        </div>
        <p className="text-xs text-slate-500">
          Permanent immutable audit trail of past rate versions. Historical bills reference these tariff versions for financial audit.
        </p>
        {renderTariffTable(timelineData?.historical || [], 'No historical tariff records.')}
      </div>

      {/* CREATE NEW RATE VERSION MODAL */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Create Effective-Dated Tariff</h3>
              <button onClick={() => setShowNewVersionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tariff Version Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRF-2026-Q4 or DEV-2026-02"
                  value={versionCode}
                  onChange={(e) => setVersionCode(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Litres Per Acre *
                </label>
                <input
                  type="number"
                  required
                  value={litresPerAcre}
                  onChange={(e) => setLitresPerAcre(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dev Rate / L (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={devCost}
                    onChange={(e) => setDevCost(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 font-mono font-bold text-emerald-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Running Rate / L (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={runningCost}
                    onChange={(e) => setRunningCost(e.target.value)}
                    className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 font-mono font-bold text-sky-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Effective Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Revision
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full text-xs rounded-xl border-slate-300 bg-slate-50/50 py-2 px-3"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewVersionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createRateMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {createRateMutation.isPending ? 'Publishing...' : 'Publish Tariff Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

