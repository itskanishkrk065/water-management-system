'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatAcres } from '@/lib/utils';
import {
  Droplets,
  Calculator,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Send,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function ApplyWaterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['beneficiary-water-preview'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/water/preview');
      return res.data;
    },
  });

  const [requiredLitres, setRequiredLitres] = useState<string>('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Auto-fill requiredLitres with calculated volume if empty
  React.useEffect(() => {
    if (preview?.calculatedAllottedLitres && !requiredLitres) {
      setRequiredLitres(preview.calculatedAllottedLitres);
    }
  }, [preview, requiredLitres]);

  const submitAppMutation = useMutation({
    mutationFn: async (payload: { requiredLitres: number }) => {
      const res = await apiClient.post('/beneficiary/water/applications', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-me'] });
      router.push('/beneficiary/water');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to submit water application.');
      setShowConfirmModal(false);
    },
  });

  if (previewLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const parsedReq = parseFloat(requiredLitres) || 0;
  const devRate = parseFloat(preview?.developmentCostPerLitre || '2.0');
  const estimatedBill = parsedReq * devRate;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (parsedReq <= 0) {
      setErrorMsg('Please specify a positive water quota greater than 0 litres.');
      return;
    }
    setShowConfirmModal(true);
  };

  const handleFinalSubmit = () => {
    submitAppMutation.mutate({ requiredLitres: parsedReq });
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/beneficiary/water"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Apply for Water Quota Allocation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Transparent calculation formula based on your registered land holdings and government tariff
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transparent Formula Display Card */}
      <div className="bg-gradient-to-br from-sky-900 via-sky-800 to-indigo-950 text-white p-6 sm:p-8 rounded-2xl shadow-md space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm">
            <Calculator className="w-6 h-6 text-sky-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Transparent Allocation Formula</h2>
            <p className="text-xs text-sky-200">Rule Section 28 &bull; Verified Land to Quota Multiplier</p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-5 border border-white/15">
          <div className="text-xs text-sky-200 font-semibold uppercase tracking-wider mb-2">
            Standard Statutory Formula
          </div>
          <div className="text-lg sm:text-xl font-bold tracking-tight text-white quantity-value">
            Total Land ({formatAcres(preview?.totalLandAcres)}) &times; Quota Rate ({formatLitres(preview?.litresPerAcre)}/acre)
          </div>
          <div className="text-sm font-bold text-amber-300 mt-2 flex items-center space-x-2">
            <span>= Calculated Allocation:</span>
            <span className="text-xl font-bold text-white underline decoration-amber-400 quantity-value">
              {formatLitres(preview?.calculatedAllottedLitres)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-sky-300">Registered Land Baseline</span>
            <div className="text-sm font-bold text-white mt-1">{formatAcres(preview?.totalLandAcres)}</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-sky-300">Standard Tariff Multiplier</span>
            <div className="text-sm font-bold text-white mt-1">{formatLitres(preview?.litresPerAcre)} / Acre</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <span className="text-sky-300">Estimated Development Rate</span>
            <div className="text-sm font-bold text-white mt-1">₹{preview?.developmentCostPerLitre} / Litre</div>
          </div>
        </div>
      </div>

      {/* Distinction Explainer Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-sky-600" />
          <span>Understanding Water Quota Terminology</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <span className="font-bold text-slate-800">1. Calculated Allocation</span>
            <p className="text-slate-500 mt-1">
              Exact mathematical quota derived from verified land parcels ({formatLitres(preview?.calculatedAllottedLitres)}).
            </p>
          </div>
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-100">
            <span className="font-bold text-amber-900">2. Requested Allocation</span>
            <p className="text-amber-800 mt-1">
              The volume you formally apply for. It can match or be lower/higher than the calculated quota.
            </p>
          </div>
          <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-100">
            <span className="font-bold text-emerald-900">3. Approved Allocation</span>
            <p className="text-emerald-800 mt-1">
              Final legally binding quota sanctioned by the irrigation executive engineer upon field inspection.
            </p>
          </div>
        </div>
      </div>

      {/* Application Form */}
      <form onSubmit={handleOpenConfirm} className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Requested Water Quota (in Litres) *
            </label>
            <button
              type="button"
              onClick={() => setRequiredLitres(preview?.calculatedAllottedLitres || '0')}
              className="text-xs text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center space-x-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Use Calculated Quota ({formatLitres(preview?.calculatedAllottedLitres)})</span>
            </button>
          </div>
          <div className="relative">
            <Droplets className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" />
            <input
              type="number"
              step="1"
              min="1"
              required
              value={requiredLitres}
              onChange={(e) => setRequiredLitres(e.target.value)}
              placeholder="e.g. 35000"
              className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-xl text-base font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Specify the volume of water required for your crop irrigation cycles.
          </p>
        </div>

        {/* Live Cost Preview */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Estimated Development Cost:</span>
            <span className="text-sm font-bold text-slate-900 currency-value">
              {formatCurrency(estimatedBill)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-500">
            <span>Payment Breakdown:</span>
            <span>Split across 5 fixed 20% milestone installments</span>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
          <Link
            href="/beneficiary/water"
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-sky-600/20 transition"
          >
            <Send className="w-4 h-4" />
            <span>Review &amp; Submit Application</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 mb-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Confirm Application Submission</h3>
              <p className="text-xs text-slate-500 mt-1">
                Please verify your requested water allocation quota before formal submission to the irrigation authority.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Volume:</span>
                <span className="font-bold text-sky-700 quantity-value">{formatLitres(parsedReq)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Land Holding Baseline:</span>
                <span className="font-semibold text-slate-800">{formatAcres(preview?.totalLandAcres)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Calculated Statutory Quota:</span>
                <span className="font-semibold text-slate-800 quantity-value">{formatLitres(preview?.calculatedAllottedLitres)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Estimated Development Cost:</span>
                <span className="font-bold text-slate-900 currency-value">{formatCurrency(estimatedBill)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Go Back &amp; Edit
              </button>
              <button
                type="button"
                disabled={submitAppMutation.isPending}
                onClick={handleFinalSubmit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow transition disabled:opacity-50"
              >
                {submitAppMutation.isPending ? 'Submitting Application...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
