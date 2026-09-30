'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatAcres, formatLitres, formatCurrency } from '@/lib/utils';
import { Search, Droplet, AlertCircle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';

function NewWaterApplicationContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const prefillBeneficiaryId = searchParams.get('beneficiaryId') || '';

  const [phoneSearch, setPhoneSearch] = useState('');
  const [beneficiary, setBeneficiary] = useState<any>(null);
  const [selectedLandId, setSelectedLandId] = useState('');
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

  // Fetch Eligible Holdings for Beneficiary
  const { data: eligibleData, isLoading: eligibleLoading } = useQuery({
    queryKey: ['eligible-holdings', beneficiary?.beneficiary_id],
    queryFn: async () => {
      if (!beneficiary?.beneficiary_id) return null;
      const res = await apiClient.get(`/water/eligible-holdings/${beneficiary.beneficiary_id}`);
      return res.data;
    },
    enabled: !!beneficiary?.beneficiary_id,
  });

  const eligibleHoldings = eligibleData?.eligible_holdings || [];

  // Auto-select first eligible holding when loaded
  useEffect(() => {
    if (eligibleHoldings.length > 0) {
      const currentStillEligible = eligibleHoldings.find((h: any) => h.land_id === selectedLandId);
      if (!currentStillEligible) {
        setSelectedLandId(eligibleHoldings[0].land_id);
        if (eligibleHoldings[0].project_id) {
          setSelectedProjectId(eligibleHoldings[0].project_id);
        }
      }
    } else {
      setSelectedLandId('');
    }
  }, [eligibleHoldings, selectedLandId]);

  // Preview Allotment Query
  const { data: preview } = useQuery({
    queryKey: ['previewAllotment', beneficiary?.beneficiary_id, selectedProjectId, selectedLandId],
    queryFn: async () => {
      if (!beneficiary?.beneficiary_id || !selectedProjectId) return null;
      const res = await apiClient.get('/water/preview-allotment', {
        params: {
          beneficiaryId: beneficiary.beneficiary_id,
          projectId: selectedProjectId,
          landId: selectedLandId || undefined,
        },
      });
      return res.data;
    },
    enabled: !!beneficiary?.beneficiary_id && !!selectedProjectId && !!selectedLandId,
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
    if (!selectedLandId) {
      setError('Please select an eligible land holding');
      return;
    }
    const litres = parseFloat(requiredLitres);
    if (isNaN(litres) || litres <= 0) {
      setError('Please enter a valid required water volume in litres');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/water/applications', {
        beneficiaryId: beneficiary.beneficiary_id,
        landId: selectedLandId,
        projectId: selectedProjectId,
        requiredLitres: litres,
        remarks: remarks || undefined,
      });

      // Synchronize all query keys
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['water-applications'] }),
        queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] }),
        queryClient.invalidateQueries({ queryKey: ['eligible-holdings', beneficiary.beneficiary_id] }),
        queryClient.invalidateQueries({ queryKey: ['beneficiary-water', beneficiary.beneficiary_id] }),
        queryClient.invalidateQueries({ queryKey: ['beneficiary-land', beneficiary.beneficiary_id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', beneficiary.beneficiary_id] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] }),
      ]);

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
          {/* Land Holding Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Select Eligible Land Holding * (One Water Application per Holding)
            </label>

            {eligibleLoading ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                <span>Checking land holding eligibility...</span>
              </div>
            ) : eligibleHoldings.length === 0 ? (
              <div className="p-5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>No land holdings are currently eligible for a new water application.</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Existing approved or active water allocations must be completed, cancelled, or otherwise become eligible before a new application can be created.
                </p>
                {eligibleData?.ineligible_holdings && eligibleData.ineligible_holdings.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-700">Holdings with Active Allotments / Applications:</span>
                    {eligibleData.ineligible_holdings.map((ih: any) => (
                      <div key={ih.land_id} className="text-[11px] text-slate-600 flex items-center justify-between bg-white/70 px-2.5 py-1 rounded border border-amber-100">
                        <span>Holding #{ih.holding_index} ({formatAcres(ih.declared_total_area)})</span>
                        <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-[10px]">
                          Status: {ih.blocking_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {eligibleHoldings.map((lh: any) => {
                  const isSelected = selectedLandId === lh.land_id;

                  return (
                    <div
                      key={lh.land_id}
                      onClick={() => {
                        setSelectedLandId(lh.land_id);
                        if (lh.project_id) setSelectedProjectId(lh.project_id);
                      }}
                      className={`p-3 rounded-xl border text-xs transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start space-x-2.5">
                        <input
                          type="radio"
                          name="selectedHolding"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedLandId(lh.land_id);
                            if (lh.project_id) setSelectedProjectId(lh.project_id);
                          }}
                          className="mt-0.5 text-sky-600 focus:ring-sky-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900">
                            Holding #{lh.holding_index} ({formatAcres(lh.declared_total_area)}) • {lh.project_name || 'Kongu Basin Scheme'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Parcels: {lh.parcels?.map((p: any) => `SF ${p.survey_number}/${p.subdivision_number}`).join(', ') || 'No parcels recorded'}
                          </div>
                        </div>
                      </div>

                      <div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Eligible
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

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
