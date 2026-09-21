'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatAcres, formatLitres, formatCurrency } from '@/lib/utils';
import { Search, Droplet, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';

function NewWaterApplicationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillBeneficiaryId = searchParams.get('beneficiaryId') || '';

  const [phoneSearch, setPhoneSearch] = useState('');
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [requiredLitres, setRequiredLitres] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Projects
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  useEffect(() => {
    if (projects?.[0] && !selectedProjectId) {
      setSelectedProjectId(projects[0].project_id);
    }
  }, [projects, selectedProjectId]);

  // Load prefilled beneficiary if present
  useEffect(() => {
    if (prefillBeneficiaryId) {
      apiClient.get(`/beneficiaries/${prefillBeneficiaryId}`).then((res) => {
        setBeneficiary(res.data);
        setPhoneSearch(res.data.phone_number);
      });
    }
  }, [prefillBeneficiaryId]);

  // Preview Allotment Query
  const { data: preview } = useQuery({
    queryKey: ['previewAllotment', beneficiary?.beneficiary_id, selectedProjectId],
    queryFn: async () => {
      if (!beneficiary?.beneficiary_id || !selectedProjectId) return null;
      const res = await apiClient.get('/water/preview-allotment', {
        params: {
          beneficiaryId: beneficiary.beneficiary_id,
          projectId: selectedProjectId,
        },
      });
      return res.data;
    },
    enabled: !!beneficiary?.beneficiary_id && !!selectedProjectId,
  });

  const handlePhoneSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneSearch.trim()) return;
    setError(null);
    try {
      const res = await apiClient.get('/beneficiaries/lookup', {
        params: { phone: phoneSearch.trim() },
      });
      if (res.data.found) {
        setBeneficiary(res.data.beneficiary);
      } else {
        setError('Beneficiary phone not found in registry. Please onboard the beneficiary first.');
        setBeneficiary(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error searching beneficiary');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!beneficiary) {
      setError('Please select a verified beneficiary');
      return;
    }
    const litres = parseFloat(requiredLitres);
    if (isNaN(litres) || litres <= 0) {
      setError('Please enter a valid required water volume in litres');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/water/applications', {
        beneficiaryId: beneficiary.beneficiary_id,
        projectId: selectedProjectId,
        requiredLitres: litres,
        remarks: remarks || undefined,
      });

      router.push(`/water/applications`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit water application');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Water Application</h1>
        <p className="text-sm text-slate-500 mt-1">
          Submit farmer requirement; preview calculated baseline allotment quota before administrative approval
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Farmer Phone Search */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Step 1: Select Beneficiary by Phone
        </label>
        <form onSubmit={handlePhoneSearch} className="flex gap-3">
          <input
            type="tel"
            placeholder="Enter farmer phone number..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition flex items-center space-x-2 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>Find Farmer</span>
          </button>
        </form>

        {beneficiary && (
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            <div>
              <span className="text-slate-400">Name:</span>
              <div className="font-bold text-slate-900">{beneficiary.name}</div>
            </div>
            <div>
              <span className="text-slate-400">Total Verified Land:</span>
              <div className="font-bold text-emerald-700">{formatAcres(beneficiary.total_land_acres)}</div>
            </div>
            <div>
              <span className="text-slate-400">Location:</span>
              <div className="font-semibold text-slate-800">
                {beneficiary.village?.name}, {beneficiary.district?.name}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Project & Requirement Form with Live Preview (Section 28) */}
      {beneficiary && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Water Project Scope *
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {projects?.map((p: any) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.project_name} ({p.project_code})
                </option>
              ))}
            </select>
          </div>

          {/* Critical Section 28 Calculation Preview Display */}
          {preview && (
            <div className="p-5 bg-sky-50 border-2 border-sky-200 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-sky-900 font-bold text-xs uppercase tracking-wider">
                <Droplet className="w-4 h-4 text-sky-600" />
                <span>Section 28 Allotment Preview</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-sky-100">
                  <span className="text-slate-400">Total Land</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {formatAcres(preview.total_land_acres)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-sky-100">
                  <span className="text-slate-400">Litres / Acre</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {formatLitres(preview.litres_per_acre)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-sky-100">
                  <span className="text-slate-400">Calculated Allotment</span>
                  <div className="text-base font-bold text-sky-700 mt-0.5">
                    {formatLitres(preview.calculated_allotted_litres)}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-sky-100">
                  <span className="text-slate-400">Development Cost / L</span>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    ₹{Number(preview.development_cost_per_litre).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Required Litres (Beneficiary Request) *
            </label>
            <input
              type="number"
              required
              placeholder="e.g. 60000"
              value={requiredLitres}
              onChange={(e) => setRequiredLitres(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-base font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
            <p className="text-xs text-slate-500 mt-1">
              Note: This is the beneficiary&apos;s request. The administrator will decide the approved quantity.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Cultivation Remarks / Season Requirements
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Rabi crop pulse cultivation across SF 101/1A"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Submitting Application...' : 'Submit Water Application'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function NewWaterApplicationPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500 flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
          <span>Loading application form...</span>
        </div>
      }
    >
      <NewWaterApplicationContent />
    </Suspense>
  );
}
