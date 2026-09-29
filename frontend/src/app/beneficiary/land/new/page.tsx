'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Map,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Save,
  ShieldAlert,
  Briefcase,
} from 'lucide-react';
import Link from 'next/link';

interface ParcelRow {
  surveyNumber: string;
  subdivisionNumber: string;
  areaAcres: string;
}

export default function NewLandHoldingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [projectId, setProjectId] = useState<string>('');
  const [declaredArea, setDeclaredArea] = useState<string>('3.5000');
  const [parcels, setParcels] = useState<ParcelRow[]>([
    { surveyNumber: '104/1A', subdivisionNumber: '1', areaAcres: '2.0000' },
    { surveyNumber: '104/1B', subdivisionNumber: '2', areaAcres: '1.5000' },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch active project schemes
  const { data: projects = [] } = useQuery({
    queryKey: ['active-projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects/active');
      return res.data;
    },
  });

  // Auto-select first active project if not set
  React.useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].project_id);
    }
  }, [projectId, projects]);

  // Checksum calculation
  const parsedDeclared = parseFloat(declaredArea) || 0;
  const sumParcels = parcels.reduce((acc, p) => acc + (parseFloat(p.areaAcres) || 0), 0);
  const diff = Math.abs(parsedDeclared - sumParcels);
  const isMatch = parsedDeclared > 0 && diff < 0.0001;

  const handleAddParcel = () => {
    setParcels([...parcels, { surveyNumber: '', subdivisionNumber: '', areaAcres: '0.0000' }]);
  };

  const handleRemoveParcel = (index: number) => {
    if (parcels.length <= 1) return;
    setParcels(parcels.filter((_, i) => i !== index));
  };

  const handleParcelChange = (index: number, field: keyof ParcelRow, value: string) => {
    const updated = [...parcels];
    updated[index][field] = value;
    setParcels(updated);
  };

  const addLandMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/beneficiary/land', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-me'] });
      router.push('/beneficiary/land');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create land holding. Check parcel checksums.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isMatch) {
      setErrorMsg(
        `Parcel area sum (${sumParcels.toFixed(4)} acres) does not match declared area (${parsedDeclared.toFixed(4)} acres).`
      );
      return;
    }

    // Validate that all parcels have survey numbers and positive area
    for (let i = 0; i < parcels.length; i++) {
      if (!parcels[i].surveyNumber.trim()) {
        setErrorMsg(`Row ${i + 1}: Survey number (SF) is required.`);
        return;
      }
      if ((parseFloat(parcels[i].areaAcres) || 0) <= 0) {
        setErrorMsg(`Row ${i + 1}: Parcel area must be greater than 0.`);
        return;
      }
    }

    if (!projectId) {
      setErrorMsg('Project Scheme is required.');
      return;
    }

    const payload = {
      projectId,
      declaredTotalArea: parsedDeclared,
      parcels: parcels.map((p) => ({
        surveyNumber: p.surveyNumber.trim(),
        subdivisionNumber: p.subdivisionNumber.trim() || undefined,
        areaAcres: parseFloat(p.areaAcres),
      })),
    };

    addLandMutation.mutate(payload);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          href="/beneficiary/land"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Register Land Holding &amp; Survey Parcels
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Strict Checksum Protection: The sum of all individual SF parcels must match declared total area
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-sm flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Project Scheme & Declared Extent Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Briefcase className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Project Scheme &amp; Title Area</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Project Scheme *
              </label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              >
                <option value="" disabled>
                  {projects.length === 0 ? 'Loading schemes...' : 'Select Project Scheme'}
                </option>
                {projects.map((p: any) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.project_name} ({p.project_code})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Designated irrigation or water distribution scheme.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Declared Total Extent (in Acres) *
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                required
                value={declaredArea}
                onChange={(e) => setDeclaredArea(e.target.value)}
                placeholder="e.g. 3.5000"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
              <p className="text-xs text-slate-400 mt-1">
                Total land area as recorded on revenue patta / deed.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic SF Parcels Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Survey (SF) &amp; Subdivision Parcels</h2>
              <p className="text-xs text-slate-500">Breakdown of the land into individual survey numbers and subdivisions</p>
            </div>
            <button
              type="button"
              onClick={handleAddParcel}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Survey Row</span>
            </button>
          </div>

          {/* Parcels Table / List */}
          <div className="space-y-3">
            <div className="hidden sm:grid grid-cols-12 gap-3 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2">
              <div className="col-span-4">Survey Number (SF) *</div>
              <div className="col-span-4">Subdivision (Optional)</div>
              <div className="col-span-3">Area (Acres) *</div>
              <div className="col-span-1 text-center">Action</div>
            </div>

            {parcels.map((row, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 items-center"
              >
                <div className="sm:col-span-4">
                  <label className="sm:hidden text-xs font-semibold text-slate-500 block mb-1">
                    Survey Number (SF)
                  </label>
                  <input
                    type="text"
                    required
                    value={row.surveyNumber}
                    onChange={(e) => handleParcelChange(idx, 'surveyNumber', e.target.value)}
                    placeholder="e.g. 104/1A"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="sm:hidden text-xs font-semibold text-slate-500 block mb-1">
                    Subdivision
                  </label>
                  <input
                    type="text"
                    value={row.subdivisionNumber}
                    onChange={(e) => handleParcelChange(idx, 'subdivisionNumber', e.target.value)}
                    placeholder="e.g. 1B"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="sm:hidden text-xs font-semibold text-slate-500 block mb-1">
                    Area (Acres)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={row.areaAcres}
                    onChange={(e) => handleParcelChange(idx, 'areaAcres', e.target.value)}
                    placeholder="e.g. 1.7500"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                  />
                </div>

                <div className="sm:col-span-1 flex justify-center">
                  <button
                    type="button"
                    disabled={parcels.length <= 1}
                    onClick={() => handleRemoveParcel(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-30"
                    title="Remove row"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Live Checksum Box */}
          <div
            className={`p-4 rounded-xl border transition ${
              isMatch
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-3">
                {isMatch ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="text-xs">
                  <div className="font-bold text-sm">
                    {isMatch
                      ? 'Area Checksum Verified &bull; Exact Match'
                      : 'Area Checksum Mismatch &bull; Submission Blocked'}
                  </div>
                  <p className="mt-0.5">
                    {isMatch
                      ? `Sum of parcels (${sumParcels.toFixed(4)} acres) matches declared area (${parsedDeclared.toFixed(4)} acres) exactly.`
                      : `Declared: ${parsedDeclared.toFixed(4)} acres | Sum of SF parcels: ${sumParcels.toFixed(4)} acres (Difference: ${diff.toFixed(4)} acres).`}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                    isMatch
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}
                >
                  {isMatch ? 'CHECKSUM PASS' : `Δ ${diff.toFixed(4)} ACRES`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
          <Link
            href="/beneficiary/land"
            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!isMatch || addLandMutation.isPending}
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-amber-600/20 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            <span>{addLandMutation.isPending ? 'Validating & Saving...' : 'Save Land Holding'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
