'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  Briefcase,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  ShieldAlert,
  ShieldCheck,
  Layers,
  FileText,
  Sliders,
  Calendar,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export interface ProjectScheme {
  project_id: string;
  project_code: string;
  project_name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  start_date?: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  _count?: {
    landHoldings?: number;
    waterApplications?: number;
    rateConfigurations?: number;
  };
}

export default function ProjectSchemesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<ProjectScheme | null>(null);
  const [showToggleStatusModal, setShowToggleStatusModal] = useState(false);

  // Form states
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch all schemes
  const { data: schemes = [], isLoading } = useQuery<ProjectScheme[]>({
    queryKey: ['project-schemes'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  // Create Scheme Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        projectCode: formCode.trim().toUpperCase(),
        projectName: formName.trim(),
        description: formDesc.trim() || undefined,
        status: formStatus,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : undefined,
      };
      const res = await apiClient.post('/projects', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-schemes'] });
      queryClient.invalidateQueries({ queryKey: ['active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create project scheme');
    },
  });

  // Update Scheme Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedScheme) return;
      const payload: any = {
        projectName: formName.trim(),
        description: formDesc.trim() || undefined,
        status: formStatus,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : undefined,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : undefined,
      };
      const res = await apiClient.patch(`/projects/${selectedScheme.project_id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-schemes'] });
      queryClient.invalidateQueries({ queryKey: ['active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowEditModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to update project scheme');
    },
  });

  // Toggle Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (schemeId: string) => {
      const res = await apiClient.patch(`/projects/${schemeId}/toggle-status`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-schemes'] });
      queryClient.invalidateQueries({ queryKey: ['active-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowToggleStatusModal(false);
      setSelectedScheme(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to toggle scheme status');
    },
  });

  const resetForm = () => {
    setFormCode('');
    setFormName('');
    setFormDesc('');
    setFormStatus('ACTIVE');
    setFormStartDate('');
    setFormEndDate('');
    setFormError(null);
    setSelectedScheme(null);
  };

  const openEditModal = (scheme: ProjectScheme) => {
    setSelectedScheme(scheme);
    setFormCode(scheme.project_code);
    setFormName(scheme.project_name);
    setFormDesc(scheme.description || '');
    setFormStatus(scheme.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setFormStartDate(scheme.start_date ? scheme.start_date.slice(0, 10) : '');
    setFormEndDate(scheme.end_date ? scheme.end_date.slice(0, 10) : '');
    setFormError(null);
    setShowEditModal(true);
  };

  // Filter schemes
  const filteredSchemes = schemes.filter((s) => {
    const matchesSearch =
      s.project_code.toLowerCase().includes(search.toLowerCase()) ||
      s.project_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.status === 'ACTIVE') ||
      (statusFilter === 'INACTIVE' && s.status !== 'ACTIVE');

    return matchesSearch && matchesStatus;
  });

  // Summary counts
  const totalSchemes = schemes.length;
  const activeSchemes = schemes.filter((s) => s.status === 'ACTIVE').length;
  const inactiveSchemes = totalSchemes - activeSchemes;
  const totalHoldingsLinked = schemes.reduce(
    (sum, s) => sum + (s._count?.landHoldings || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-sky-100 text-sky-700 rounded-xl">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Project Scheme Master Data
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Centralized management of agricultural irrigation and water allocation schemes.
              </p>
            </div>
          </div>
        </div>

        {user?.role === 'ADMIN' && (
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="inline-flex items-center px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Project Scheme
          </button>
        )}
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Schemes
            </div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{totalSchemes}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Active Schemes
            </div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{activeSchemes}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Inactive Schemes
            </div>
            <div className="text-xl font-extrabold text-slate-700 mt-0.5">{inactiveSchemes}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Linked Land Holdings
            </div>
            <div className="text-xl font-extrabold text-indigo-700 mt-0.5">
              {totalHoldingsLinked}
            </div>
          </div>
        </div>
      </div>

      {/* Historical Data & Invariant Notice */}
      <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 text-xs text-sky-900 flex items-start space-x-3">
        <HelpCircle className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold">Historical Data Integrity Rules:</p>
          <p className="text-sky-800 leading-relaxed">
            • <strong>Active Schemes</strong> appear in the dropdown when creating new Land Holdings and Water Applications.
            <br />
            • <strong>Deactivating a Scheme</strong> safely hides it from new selections while permanently preserving all historical land holdings, billing records, and audit history intact.
          </p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search scheme name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none"
          >
            <option value="ALL">All Statuses ({totalSchemes})</option>
            <option value="ACTIVE">Active Only ({activeSchemes})</option>
            <option value="INACTIVE">Inactive Only ({inactiveSchemes})</option>
          </select>
        </div>
      </div>

      {/* Master Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Scheme Code</th>
                <th className="py-3.5 px-4">Scheme Name & Description</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Linked Records</th>
                <th className="py-3.5 px-4">Validity Timeline</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading project schemes...
                  </td>
                </tr>
              ) : filteredSchemes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No project schemes found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredSchemes.map((scheme) => {
                  const isActive = scheme.status === 'ACTIVE';
                  const holdingsCount = scheme._count?.landHoldings || 0;
                  const appsCount = scheme._count?.waterApplications || 0;
                  const ratesCount = scheme._count?.rateConfigurations || 0;

                  return (
                    <tr key={scheme.project_id} className="hover:bg-slate-50/60 transition">
                      <td className="py-4 px-4 font-mono font-bold text-slate-900">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
                          {scheme.project_code}
                        </span>
                      </td>

                      <td className="py-4 px-4 max-w-xs sm:max-w-md">
                        <div className="font-bold text-slate-900 text-sm">
                          {scheme.project_name}
                        </div>
                        {scheme.description && (
                          <div className="text-slate-500 text-[11px] mt-0.5 line-clamp-2">
                            {scheme.description}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-[11px]">
                            <XCircle className="w-3 h-3 mr-1" /> Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        <div className="flex flex-col space-y-0.5 text-[11px]">
                          <span className="font-semibold text-slate-800">
                            {holdingsCount} Land Holdings
                          </span>
                          <span className="text-slate-400">
                            {appsCount} Applications • {ratesCount} Tariffs
                          </span>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        {scheme.start_date ? (
                          <div>From: {formatDate(scheme.start_date)}</div>
                        ) : (
                          <div className="text-slate-400">No start date</div>
                        )}
                        {scheme.end_date && (
                          <div className="text-slate-400">To: {formatDate(scheme.end_date)}</div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right space-x-2 whitespace-nowrap">
                        {user?.role === 'ADMIN' && (
                          <>
                            <button
                              onClick={() => openEditModal(scheme)}
                              className="inline-flex items-center px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-[11px]"
                              title="Edit Scheme Details"
                            >
                              <Edit2 className="w-3 h-3 mr-1" /> Edit
                            </button>

                            <button
                              onClick={() => {
                                setSelectedScheme(scheme);
                                setShowToggleStatusModal(true);
                              }}
                              className={`inline-flex items-center px-2.5 py-1.5 font-bold rounded-lg transition text-[11px] ${
                                isActive
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isActive ? (
                                <>
                                  <ShieldAlert className="w-3 h-3 mr-1" /> Deactivate
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-3 h-3 mr-1" /> Activate
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE SCHEME MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">Register New Project Scheme</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                createMutation.mutate();
              }}
              className="p-6 space-y-4 text-xs"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Scheme Code * <span className="text-[10px] text-slate-400 font-normal">(Unique identifier, e.g. KB-IRR-2026)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. KB-IRR-2026"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm uppercase text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Scheme Name * <span className="text-[10px] text-slate-400 font-normal">(Full project title)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bhavani Basin Sustainable Irrigation Network"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Geographical coverage, canal specifications, target beneficiary criteria..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  <option value="ACTIVE">ACTIVE (Available for new land allocations)</option>
                  <option value="INACTIVE">INACTIVE (Draft / Pending Commissioning)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow transition"
                >
                  {createMutation.isPending ? 'Saving Scheme...' : 'Create Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT SCHEME MODAL */}
      {showEditModal && selectedScheme && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit2 className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-sm">Edit Scheme: {selectedScheme.project_code}</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                updateMutation.mutate();
              }}
              className="p-6 space-y-4 text-xs"
            >
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scheme Code (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={formCode}
                  className="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono text-sm text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Scheme Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl shadow transition"
                >
                  {updateMutation.isPending ? 'Saving Changes...' : 'Update Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOGGLE STATUS CONFIRMATION MODAL */}
      {showToggleStatusModal && selectedScheme && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-6 text-center space-y-4">
              <div
                className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center ${
                  selectedScheme.status === 'ACTIVE'
                    ? 'bg-rose-100 text-rose-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {selectedScheme.status === 'ACTIVE' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>

              <h3 className="font-bold text-base text-slate-900">
                {selectedScheme.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'} Scheme?
              </h3>

              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl text-left border border-slate-200">
                <div className="font-bold text-slate-800">
                  {selectedScheme.project_name} ({selectedScheme.project_code})
                </div>
                <div className="mt-2 text-slate-500">
                  {selectedScheme.status === 'ACTIVE' ? (
                    <span>
                      • New land holdings will no longer be able to select this scheme.
                      <br />
                      • All existing {selectedScheme._count?.landHoldings || 0} linked land holdings and historical records remain 100% valid and preserved.
                    </span>
                  ) : (
                    <span>
                      • This scheme will immediately become available in dropdowns for new land holdings and water applications.
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  onClick={() => setShowToggleStatusModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => toggleStatusMutation.mutate(selectedScheme.project_id)}
                  disabled={toggleStatusMutation.isPending}
                  className={`px-5 py-2 text-white font-bold rounded-xl shadow transition text-xs ${
                    selectedScheme.status === 'ACTIVE'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {toggleStatusMutation.isPending
                    ? 'Processing...'
                    : selectedScheme.status === 'ACTIVE'
                    ? 'Confirm Deactivation'
                    : 'Confirm Reactivation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
