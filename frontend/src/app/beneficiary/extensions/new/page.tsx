'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  ArrowUpRight,
  ArrowLeft,
  Save,
  AlertCircle,
  ShieldCheck,
  Droplets,
  Map,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export default function NewExtensionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    additionalAcres: '0.00',
    additionalLitres: '10000',
    notes: '',
  });

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/beneficiary/extensions', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-extensions'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
      router.push('/beneficiary/extensions');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to submit extension request.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const litres = parseFloat(formData.additionalLitres);
    if (isNaN(litres) || litres <= 0) {
      setErrorMsg('Additional litres must be greater than 0');
      return;
    }

    const acres = parseFloat(formData.additionalAcres) || 0;

    submitMutation.mutate({
      additionalAcres: acres,
      additionalLitres: litres,
      notes: formData.notes || undefined,
    });
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/beneficiary/extensions"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Request Quota Extension
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit a supplemental water allocation request for expanded acreage or high-demand crop cycles
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 space-y-1">
          <div className="font-semibold flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>Root Allotment Preservation</span>
          </div>
          <p>
            This request will be evaluated as a supplemental quota. Your existing root approved allocation and historical rate configuration will remain entirely untouched.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Supplementary Water Quota (Litres) *
            </label>
            <div className="relative">
              <Droplets className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="number"
                step="100"
                min="1"
                required
                value={formData.additionalLitres}
                onChange={(e) => setFormData({ ...formData, additionalLitres: e.target.value })}
                placeholder="e.g. 10000"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Additional Land Extent (Acres)
            </label>
            <div className="relative">
              <Map className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.additionalAcres}
                onChange={(e) => setFormData({ ...formData, additionalAcres: e.target.value })}
                placeholder="0.00"
                className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Reason for Supplemental Request / Field Justification
          </label>
          <div className="relative">
            <textarea
              rows={4}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Expansion of coconut grove to adjacent field; requirement of supplemental drip irrigation volume for summer crop."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
            />
          </div>
        </div>

        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
          <Link
            href="/beneficiary/extensions"
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-600/20 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{submitMutation.isPending ? 'Submitting...' : 'Submit Extension Request'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
