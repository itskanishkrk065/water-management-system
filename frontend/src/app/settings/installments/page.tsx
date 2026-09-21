'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Layers, Plus, AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function InstallmentTemplatesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('Standard 5-Stage Tariff Schedule');
  const [inst1, setInst1] = useState('2.50');
  const [inst2, setInst2] = useState('20.00');
  const [inst3, setInst3] = useState('25.00');
  const [inst4, setInst4] = useState('25.00');
  const [inst5, setInst5] = useState('27.50');
  const [error, setError] = useState<string | null>(null);

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  const selectedProjectId = projects?.[0]?.project_id;

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['installmentTemplates', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await apiClient.get('/billing/installment-templates', {
        params: { projectId: selectedProjectId },
      });
      return res.data;
    },
    enabled: !!selectedProjectId,
  });

  // Calculate live sum
  const currentSum =
    (parseFloat(inst1) || 0) +
    (parseFloat(inst2) || 0) +
    (parseFloat(inst3) || 0) +
    (parseFloat(inst4) || 0) +
    (parseFloat(inst5) || 0);

  const isValid100 = Math.abs(currentSum - 100.0) < 0.001;

  // Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/installment-templates', {
        projectId: selectedProjectId,
        name,
        inst1Pct: parseFloat(inst1),
        inst2Pct: parseFloat(inst2),
        inst3Pct: parseFloat(inst3),
        inst4Pct: parseFloat(inst4),
        inst5Pct: parseFloat(inst5),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installmentTemplates', selectedProjectId] });
      setShowModal(false);
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create installment template');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid100) {
      setError(`Validation Failed: Sum of all 5 installments must be exactly 100.00%. Current sum: ${currentSum.toFixed(2)}%`);
      return;
    }
    setError(null);
    createMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">5-Stage Installment Schedules</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure installment percentages. Installment 1 defaults to 2.5%, remaining stages configurable (must sum to 100%)
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => {
              setError(null);
              setShowModal(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Configure Schedule Template
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Template Name</th>
                <th className="px-5 py-3.5">Stage 1</th>
                <th className="px-5 py-3.5">Stage 2</th>
                <th className="px-5 py-3.5">Stage 3</th>
                <th className="px-5 py-3.5">Stage 4</th>
                <th className="px-5 py-3.5">Stage 5</th>
                <th className="px-5 py-3.5">Total Sum</th>
                <th className="px-5 py-3.5">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading templates...
                  </td>
                </tr>
              ) : templates && templates.length > 0 ? (
                templates.map((t: any) => (
                  <tr key={t.template_id} className="hover:bg-slate-50/50 transition">
                    <td className="px-5 py-4 font-bold text-slate-900">{t.name}</td>
                    <td className="px-5 py-4 font-semibold text-emerald-700">{t.inst_1_pct}%</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{t.inst_2_pct}%</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{t.inst_3_pct}%</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{t.inst_4_pct}%</td>
                    <td className="px-5 py-4 font-semibold text-slate-800">{t.inst_5_pct}%</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">100.00%</span>
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-500">{formatDate(t.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No installment templates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIGURE TEMPLATE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Configure Installment Schedule</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Schedule Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Stage 1 (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inst1}
                    onChange={(e) => setInst1(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-emerald-700"
                  />
                  <span className="text-[10px] text-slate-400">Defaults to 2.5%</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Stage 2 (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inst2}
                    onChange={(e) => setInst2(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Stage 3 (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inst3}
                    onChange={(e) => setInst3(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Stage 4 (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inst4}
                    onChange={(e) => setInst4(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Stage 5 (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inst5}
                    onChange={(e) => setInst5(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold"
                  />
                </div>
              </div>

              {/* Live Summation Indicator */}
              <div
                className={`p-3 rounded-lg text-xs flex justify-between items-center border ${
                  isValid100
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <span className="font-semibold">Calculated Total Sum:</span>
                <span className="font-bold text-sm">
                  {currentSum.toFixed(2)}% {isValid100 ? '✔ Valid' : '✖ Must equal 100%'}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid100 || createMutation.isPending}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
