'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
  Map as MapIcon,
  Droplets,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  X,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface FilterState {
  projectId: string;
  districtId: string;
  blockId: string;
  panchayatId: string;
  villageId: string;
  beneficiaryName: string;
  phoneNumber: string;
  beneficiaryStatus: string;
  landAreaMin: string;
  landAreaMax: string;
  surveyNumber: string;
  subdivisionNumber: string;
  requiredLitresMin: string;
  requiredLitresMax: string;
  approvedLitresMin: string;
  approvedLitresMax: string;
  applicationStatus: string;
  approvalStatus: string;
  developmentBillStatus: string;
  developmentCostMin: string;
  developmentCostMax: string;
  paymentStatus: string;
  installmentNumber: string;
  installmentStatus: string;
  paymentMode: string;
  infrastructureStatus: string;
  runningBillStatus: string;
  extensionStatus: string;
  dateType: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
}

const initialFilters: FilterState = {
  projectId: '',
  districtId: '',
  blockId: '',
  panchayatId: '',
  villageId: '',
  beneficiaryName: '',
  phoneNumber: '',
  beneficiaryStatus: '',
  landAreaMin: '',
  landAreaMax: '',
  surveyNumber: '',
  subdivisionNumber: '',
  requiredLitresMin: '',
  requiredLitresMax: '',
  approvedLitresMin: '',
  approvedLitresMax: '',
  applicationStatus: '',
  approvalStatus: '',
  developmentBillStatus: '',
  developmentCostMin: '',
  developmentCostMax: '',
  paymentStatus: '',
  installmentNumber: '',
  installmentStatus: '',
  paymentMode: '',
  infrastructureStatus: '',
  runningBillStatus: '',
  extensionStatus: '',
  dateType: 'application_date',
  dateFrom: '',
  dateTo: '',
  page: 1,
  limit: 50,
};

export function FindFilterManager() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Collapsible filter sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    location: true,
    beneficiary: true,
    land: false,
    water: false,
    billing: false,
    infrastructure: false,
    dates: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // 1. Initialize filters from URL search params
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => {
    const params = new URLSearchParams(searchParams.toString());
    return {
      districtId: params.get('districtId') || '',
      blockId: params.get('blockId') || '',
      panchayatId: params.get('panchayatId') || '',
      villageId: params.get('villageId') || '',
      beneficiaryName: params.get('beneficiaryName') || '',
      phoneNumber: params.get('phoneNumber') || '',
      beneficiaryStatus: params.get('beneficiaryStatus') || '',
      landAreaMin: params.get('landAreaMin') || '',
      landAreaMax: params.get('landAreaMax') || '',
      surveyNumber: params.get('surveyNumber') || '',
      subdivisionNumber: params.get('subdivisionNumber') || '',
      requiredLitresMin: params.get('requiredLitresMin') || '',
      requiredLitresMax: params.get('requiredLitresMax') || '',
      approvedLitresMin: params.get('approvedLitresMin') || '',
      approvedLitresMax: params.get('approvedLitresMax') || '',
      applicationStatus: params.get('applicationStatus') || '',
      approvalStatus: params.get('approvalStatus') || '',
      developmentBillStatus: params.get('developmentBillStatus') || '',
      developmentCostMin: params.get('developmentCostMin') || '',
      developmentCostMax: params.get('developmentCostMax') || '',
      paymentStatus: params.get('paymentStatus') || '',
      installmentNumber: params.get('installmentNumber') || '',
      installmentStatus: params.get('installmentStatus') || '',
      paymentMode: params.get('paymentMode') || '',
      infrastructureStatus: params.get('infrastructureStatus') || '',
      runningBillStatus: params.get('runningBillStatus') || '',
      extensionStatus: params.get('extensionStatus') || '',
      dateType: params.get('dateType') || 'application_date',
      dateFrom: params.get('dateFrom') || '',
      dateTo: params.get('dateTo') || '',
      page: parseInt(params.get('page') || '1', 10),
      limit: parseInt(params.get('limit') || '50', 10),
      projectId: params.get('projectId') || '',
    };
  });

  const [appliedFilters, setAppliedFilters] = useState<FilterState>(draftFilters);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Preset modal states
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [showPresetsListModal, setShowPresetsListModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [presetSaving, setPresetSaving] = useState(false);

  // 2. Fetch Filter Metadata & Presets & Projects
  const { data: filterMeta } = useQuery({
    queryKey: ['reports-find-metadata'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/find/metadata');
      return res.data;
    },
    staleTime: 1000 * 60 * 30,
  });

  const { data: presets = [], refetch: refetchPresets } = useQuery<any[]>({
    queryKey: ['reports-find-presets'],
    queryFn: async () => {
      const res = await apiClient.get('/reports/find/presets');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: projectsData = [] } = useQuery<any[]>({
    queryKey: ['projects-active-list'],
    queryFn: async () => {
      const res = await apiClient.get('/projects/active');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // 3. Location Dropdowns with Cascading
  const { data: districtsData } = useQuery<any[]>({
    queryKey: ['locations-districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
  });

  const { data: blocksData } = useQuery<any[]>({
    queryKey: ['locations-blocks', draftFilters.districtId],
    queryFn: async () => {
      if (!draftFilters.districtId) return [];
      const res = await apiClient.get(`/locations/blocks?districtId=${draftFilters.districtId}`);
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
    enabled: !!draftFilters.districtId,
  });

  const { data: villagesData } = useQuery<any[]>({
    queryKey: ['locations-villages', draftFilters.blockId],
    queryFn: async () => {
      if (!draftFilters.blockId) return [];
      const res = await apiClient.get(`/locations/villages?blockId=${draftFilters.blockId}&limit=200`);
      return Array.isArray(res.data) ? res.data : (res.data?.items || []);
    },
    enabled: !!draftFilters.blockId,
  });

  // 4. Build Filter Payload for API
  const filterPayload = useMemo(() => {
    const payload: any = {
      page: appliedFilters.page,
      limit: appliedFilters.limit,
    };

    if (appliedFilters.projectId) payload.projectId = appliedFilters.projectId;
    if (appliedFilters.districtId) payload.districtId = appliedFilters.districtId;
    if (appliedFilters.blockId) payload.blockId = appliedFilters.blockId;
    if (appliedFilters.panchayatId) payload.panchayatId = appliedFilters.panchayatId;
    if (appliedFilters.villageId) payload.villageId = appliedFilters.villageId;

    if (appliedFilters.beneficiaryName) payload.beneficiaryName = appliedFilters.beneficiaryName;
    if (appliedFilters.phoneNumber) payload.phoneNumber = appliedFilters.phoneNumber;
    if (appliedFilters.beneficiaryStatus) payload.beneficiaryStatus = appliedFilters.beneficiaryStatus;

    if (appliedFilters.landAreaMin) payload.landAreaMin = parseFloat(appliedFilters.landAreaMin);
    if (appliedFilters.landAreaMax) payload.landAreaMax = parseFloat(appliedFilters.landAreaMax);
    if (appliedFilters.surveyNumber) payload.surveyNumber = appliedFilters.surveyNumber;
    if (appliedFilters.subdivisionNumber) payload.subdivisionNumber = appliedFilters.subdivisionNumber;

    if (appliedFilters.requiredLitresMin) payload.requiredLitresMin = parseFloat(appliedFilters.requiredLitresMin);
    if (appliedFilters.requiredLitresMax) payload.requiredLitresMax = parseFloat(appliedFilters.requiredLitresMax);
    if (appliedFilters.approvedLitresMin) payload.approvedLitresMin = parseFloat(appliedFilters.approvedLitresMin);
    if (appliedFilters.approvedLitresMax) payload.approvedLitresMax = parseFloat(appliedFilters.approvedLitresMax);
    if (appliedFilters.applicationStatus) payload.applicationStatus = appliedFilters.applicationStatus;
    if (appliedFilters.approvalStatus) payload.approvalStatus = appliedFilters.approvalStatus;

    if (appliedFilters.developmentBillStatus) payload.developmentBillStatus = appliedFilters.developmentBillStatus;
    if (appliedFilters.developmentCostMin) payload.developmentCostMin = parseFloat(appliedFilters.developmentCostMin);
    if (appliedFilters.developmentCostMax) payload.developmentCostMax = parseFloat(appliedFilters.developmentCostMax);
    if (appliedFilters.paymentStatus) payload.paymentStatus = appliedFilters.paymentStatus;

    if (appliedFilters.installmentNumber) payload.installmentNumber = parseInt(appliedFilters.installmentNumber, 10);
    if (appliedFilters.installmentStatus) payload.installmentStatus = appliedFilters.installmentStatus;
    if (appliedFilters.paymentMode) payload.paymentMode = appliedFilters.paymentMode;

    if (appliedFilters.infrastructureStatus) payload.infrastructureStatus = appliedFilters.infrastructureStatus;
    if (appliedFilters.runningBillStatus) payload.runningBillStatus = appliedFilters.runningBillStatus;
    if (appliedFilters.extensionStatus) payload.extensionStatus = appliedFilters.extensionStatus;

    if (appliedFilters.dateType && (appliedFilters.dateFrom || appliedFilters.dateTo)) {
      payload.dateType = appliedFilters.dateType;
      if (appliedFilters.dateFrom) payload.dateFrom = appliedFilters.dateFrom;
      if (appliedFilters.dateTo) payload.dateTo = appliedFilters.dateTo;
    }

    return payload;
  }, [appliedFilters]);

  // 5. Query Filtered Data and Aggregations
  const { data: reportResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['reports-find-query', filterPayload],
    queryFn: async () => {
      const res = await apiClient.post('/reports/find', filterPayload);
      return res.data;
    },
  });

  // 6. Sync URL Search Params
  const syncUrlParams = (filters: FilterState) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== '' && val !== null && val !== undefined) {
        params.set(key, String(val));
      }
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleApplyFilters = () => {
    const updated = { ...draftFilters, page: 1 };
    setAppliedFilters(updated);
    syncUrlParams(updated);
  };

  const handleClearFilters = () => {
    setDraftFilters(initialFilters);
    setAppliedFilters(initialFilters);
    syncUrlParams(initialFilters);
  };

  const handleRemoveFilter = (key: keyof FilterState) => {
    const updatedDraft = { ...draftFilters, [key]: initialFilters[key] };
    const updatedApplied = { ...appliedFilters, [key]: initialFilters[key], page: 1 };
    setDraftFilters(updatedDraft);
    setAppliedFilters(updatedApplied);
    syncUrlParams(updatedApplied);
  };

  const handlePageChange = (newPage: number) => {
    const updated = { ...appliedFilters, page: newPage };
    setDraftFilters(updated);
    setAppliedFilters(updated);
    syncUrlParams(updated);
  };

  const handleLimitChange = (newLimit: number) => {
    const updated = { ...appliedFilters, limit: newLimit, page: 1 };
    setDraftFilters(updated);
    setAppliedFilters(updated);
    syncUrlParams(updated);
  };

  // 7. Server-Side Authoritative PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      setExportError(null);

      const response = await apiClient.post('/reports/find/export/pdf', filterPayload, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `water-management-report-${new Date().toISOString().slice(0, 10)}.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setExportError(err.response?.data?.message || 'Failed to generate and download PDF report.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // 8. Server-Side Authoritative Excel Export (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      setExportError(null);

      const response = await apiClient.post('/reports/find/export/excel', filterPayload, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const contentDisposition = response.headers['content-disposition'];
      let filename = `water-registry-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setExportError(err.response?.data?.message || 'Failed to generate and download Excel export.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  // 9. Reporting Presets Actions
  const handleLoadPreset = (preset: any) => {
    const rawFilters = typeof preset.filters_json === 'string' ? JSON.parse(preset.filters_json) : (preset.filters_json || {});
    const updated: FilterState = {
      ...initialFilters,
      ...rawFilters,
      page: 1,
      limit: appliedFilters.limit,
    };
    setDraftFilters(updated);
    setAppliedFilters(updated);
    syncUrlParams(updated);
    setShowPresetsListModal(false);
  };

  const handleSaveCurrentPreset = async () => {
    if (!presetName.trim()) return;
    setPresetSaving(true);
    try {
      await apiClient.post('/reports/find/presets', {
        name: presetName.trim(),
        description: presetDesc.trim() || undefined,
        report_type: 'FIND_FILTER',
        filters: filterPayload,
      });
      refetchPresets();
      setShowSavePresetModal(false);
      setPresetName('');
      setPresetDesc('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save preset');
    } finally {
      setPresetSaving(false);
    }
  };

  const handleDeletePreset = async (presetId: string) => {
    if (!confirm('Are you sure you want to deactivate this reporting preset?')) return;
    try {
      await apiClient.delete(`/reports/find/presets/${presetId}`);
      refetchPresets();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete preset');
    }
  };


  // Active filters list for chips
  const activeChips = useMemo(() => {
    const chips: { key: keyof FilterState; label: string; value: string }[] = [];

    const districtsList = Array.isArray(districtsData) ? districtsData : [];
    const blocksList = Array.isArray(blocksData) ? blocksData : [];
    const villagesList = Array.isArray(villagesData) ? villagesData : [];

    if (appliedFilters.districtId && districtsList.length > 0) {
      const d = districtsList.find((item: any) => item.district_id === appliedFilters.districtId);
      if (d) chips.push({ key: 'districtId', label: 'District', value: d.name });
    }
    if (appliedFilters.blockId && blocksList.length > 0) {
      const b = blocksList.find((item: any) => item.block_id === appliedFilters.blockId);
      if (b) chips.push({ key: 'blockId', label: 'Block', value: b.name });
    }
    if (appliedFilters.villageId && villagesList.length > 0) {
      const v = villagesList.find((item: any) => item.village_id === appliedFilters.villageId);
      if (v) chips.push({ key: 'villageId', label: 'Village', value: v.name });
    }
    if (appliedFilters.beneficiaryName) {
      chips.push({ key: 'beneficiaryName', label: 'Name', value: appliedFilters.beneficiaryName });
    }
    if (appliedFilters.phoneNumber) {
      chips.push({ key: 'phoneNumber', label: 'Phone', value: appliedFilters.phoneNumber });
    }
    if (appliedFilters.beneficiaryStatus) {
      chips.push({ key: 'beneficiaryStatus', label: 'Beneficiary Status', value: appliedFilters.beneficiaryStatus });
    }
    if (appliedFilters.landAreaMin || appliedFilters.landAreaMax) {
      chips.push({
        key: 'landAreaMin',
        label: 'Land Area',
        value: `${appliedFilters.landAreaMin || '0'} – ${appliedFilters.landAreaMax || '∞'} ac`,
      });
    }
    if (appliedFilters.surveyNumber) {
      chips.push({ key: 'surveyNumber', label: 'Survey No', value: appliedFilters.surveyNumber });
    }
    if (appliedFilters.subdivisionNumber) {
      chips.push({ key: 'subdivisionNumber', label: 'Subdivision', value: appliedFilters.subdivisionNumber });
    }
    if (appliedFilters.requiredLitresMin || appliedFilters.requiredLitresMax) {
      chips.push({
        key: 'requiredLitresMin',
        label: 'Required Water',
        value: `${appliedFilters.requiredLitresMin || '0'} – ${appliedFilters.requiredLitresMax || '∞'} L`,
      });
    }
    if (appliedFilters.approvedLitresMin || appliedFilters.approvedLitresMax) {
      chips.push({
        key: 'approvedLitresMin',
        label: 'Approved Water',
        value: `${appliedFilters.approvedLitresMin || '0'} – ${appliedFilters.approvedLitresMax || '∞'} L`,
      });
    }
    if (appliedFilters.paymentStatus) {
      chips.push({ key: 'paymentStatus', label: 'Payment Status', value: appliedFilters.paymentStatus });
    }
    if (appliedFilters.developmentBillStatus) {
      chips.push({ key: 'developmentBillStatus', label: 'Bill Status', value: appliedFilters.developmentBillStatus });
    }
    if (appliedFilters.installmentNumber) {
      chips.push({ key: 'installmentNumber', label: 'Installment #', value: `Stage ${appliedFilters.installmentNumber}` });
    }
    if (appliedFilters.infrastructureStatus) {
      chips.push({ key: 'infrastructureStatus', label: 'Infrastructure', value: appliedFilters.infrastructureStatus });
    }
    if (appliedFilters.extensionStatus) {
      chips.push({ key: 'extensionStatus', label: 'Extension', value: appliedFilters.extensionStatus });
    }
    if (appliedFilters.dateFrom || appliedFilters.dateTo) {
      chips.push({
        key: 'dateFrom',
        label: appliedFilters.dateType.replace(/_/g, ' '),
        value: `${appliedFilters.dateFrom || 'Start'} to ${appliedFilters.dateTo || 'End'}`,
      });
    }

    return chips;
  }, [appliedFilters, districtsData, blocksData, villagesData]);

  const metrics = reportResponse?.metrics;
  const items = reportResponse?.items || [];
  const meta = reportResponse?.meta || { total: 0, page: 1, limit: 50, totalPages: 1 };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-sky-500/10 border border-sky-400/30 rounded-full text-xs font-semibold text-sky-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Authoritative Query Engine • Decimal-Safe Aggregations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <Search className="w-8 h-8 text-sky-400" />
              <span>Advanced Find, Filter & Reports</span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Query PostgreSQL across beneficiaries, cadastral land holdings, water allotments, 5-installment development
              billing, and physical infrastructure. All metrics update synchronously over the exact filtered dataset.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleClearFilters}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition flex items-center gap-2 border border-slate-700 shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Clear</span>
            </button>

            <button
              onClick={handleApplyFilters}
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition shadow-lg shadow-sky-500/20 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              <span>Apply Filters</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={isExportingExcel || isLoading}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-emerald-600/30 flex items-center gap-2"
            >
              {isExportingExcel ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf || isLoading}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
            >
              {isExportingPdf ? (
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExportingPdf ? 'Exporting...' : 'Export PDF'}</span>
            </button>

            <button
              onClick={() => setShowSavePresetModal(true)}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              title="Save current criteria as a reusable preset"
            >
              <span>+ Save Preset</span>
            </button>
          </div>
        </div>

        {/* Presets Quick Selector Ribbon */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              Reporting Presets:
            </span>
            <button
              type="button"
              onClick={() => {
                handleClearFilters();
                setDraftFilters((p) => ({ ...p, applicationStatus: 'APPROVED' }));
                setAppliedFilters((p) => ({ ...p, applicationStatus: 'APPROVED', page: 1 }));
              }}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 font-medium transition"
            >
              💧 Approved Water
            </button>
            <button
              type="button"
              onClick={() => {
                handleClearFilters();
                setDraftFilters((p) => ({ ...p, paymentStatus: 'UNPAID' }));
                setAppliedFilters((p) => ({ ...p, paymentStatus: 'UNPAID', page: 1 }));
              }}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 font-medium transition"
            >
              ⚠️ Pending Payments
            </button>
            <button
              type="button"
              onClick={() => {
                handleClearFilters();
                setDraftFilters((p) => ({ ...p, applicationStatus: 'SUBMITTED' }));
                setAppliedFilters((p) => ({ ...p, applicationStatus: 'SUBMITTED', page: 1 }));
              }}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-medium transition"
            >
              📋 Review Queue
            </button>
            <button
              type="button"
              onClick={() => {
                handleClearFilters();
                setDraftFilters((p) => ({ ...p, beneficiaryStatus: 'ACTIVE' }));
                setAppliedFilters((p) => ({ ...p, beneficiaryStatus: 'ACTIVE', page: 1 }));
              }}
              className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 font-medium transition"
            >
              🌱 Active Beneficiaries
            </button>
          </div>

          {presets.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Custom Presets ({presets.length}):</span>
              <select
                onChange={(e) => {
                  const p = presets.find((item: any) => item.preset_id === e.target.value);
                  if (p) handleLoadPreset(p);
                }}
                defaultValue=""
                className="bg-slate-800 text-slate-200 border border-slate-700 text-xs rounded-lg px-2.5 py-1 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="" disabled>
                  Load Saved Preset...
                </option>
                {presets.map((preset: any) => (
                  <option key={preset.preset_id} value={preset.preset_id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {exportError && (
          <div className="mt-4 p-3 bg-red-950/80 border border-red-800 rounded-xl text-xs text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{exportError}</span>
          </div>
        )}
      </div>

      {/* 2. Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Active Filters:</span>
          {activeChips.map((chip, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-full text-xs font-medium"
            >
              <span className="text-sky-600 font-normal">{chip.label}:</span>
              <span className="font-semibold">{chip.value}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(chip.key)}
                className="hover:bg-sky-200 rounded-full p-0.5 text-sky-600 transition"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
          <button
            onClick={handleClearFilters}
            className="text-xs text-red-600 hover:text-red-700 font-medium ml-2 underline underline-offset-2"
          >
            Clear All
          </button>
        </div>
      )}

      {/* 3. Comprehensive Filter Sections */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden divide-y divide-slate-100">
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Filter Criteria Specification</span>
          </div>
          <div className="text-xs text-slate-500">
            Configure filters and click <span className="font-semibold text-slate-700">Apply Filters</span> to execute
          </div>
        </div>

        {/* Section: Location & Project */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('location')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>1. Location Hierarchy & Project Scheme</span>
            </span>
            {openSections.location ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.location && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Project Scheme</label>
                <select
                  value={draftFilters.projectId}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, projectId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Project Schemes</option>
                  {projectsData.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} ({p.project_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">District</label>
                <select
                  value={draftFilters.districtId}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      districtId: e.target.value,
                      blockId: '',
                      villageId: '',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Districts</option>
                  {(Array.isArray(districtsData) ? districtsData : []).map((d: any) => (
                    <option key={d.district_id} value={d.district_id}>
                      {d.name} {d.lgd_code || d.lgd_district_code ? `(${d.lgd_code || d.lgd_district_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Block / Taluk</label>
                <select
                  value={draftFilters.blockId}
                  disabled={!draftFilters.districtId}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      blockId: e.target.value,
                      villageId: '',
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">All Blocks</option>
                  {(Array.isArray(blocksData) ? blocksData : []).map((b: any) => (
                    <option key={b.block_id} value={b.block_id}>
                      {b.name} {b.lgd_code || b.lgd_block_code ? `(${b.lgd_code || b.lgd_block_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Revenue Village</label>
                <select
                  value={draftFilters.villageId}
                  disabled={!draftFilters.blockId}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, villageId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">All Villages</option>
                  {(Array.isArray(villagesData) ? villagesData : []).map((v: any) => (
                    <option key={v.village_id} value={v.village_id}>
                      {v.name} {v.lgd_code || v.lgd_village_code ? `(${v.lgd_code || v.lgd_village_code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section: Beneficiary Details */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('beneficiary')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <User className="w-4 h-4 text-sky-600" />
              <span>2. Beneficiary Profile & Verification Status</span>
            </span>
            {openSections.beneficiary ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.beneficiary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Beneficiary Name (Partial Search)</label>
                <input
                  type="text"
                  placeholder="e.g. Ravi Kumar"
                  value={draftFilters.beneficiaryName}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, beneficiaryName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 98765"
                  value={draftFilters.phoneNumber}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Beneficiary Status</label>
                <select
                  value={draftFilters.beneficiaryStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, beneficiaryStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Statuses</option>
                  {filterMeta?.beneficiaryStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section: Land Holdings */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('land')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <MapIcon className="w-4 h-4 text-emerald-600" />
              <span>3. Cadastral Land & Survey Parcel Filters</span>
            </span>
            {openSections.land ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.land && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Land Area From (Acres)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 5.0"
                  value={draftFilters.landAreaMin}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, landAreaMin: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Total Land Area To (Acres)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 15.0"
                  value={draftFilters.landAreaMax}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, landAreaMax: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Survey / SF Number</label>
                <input
                  type="text"
                  placeholder="e.g. 102/1"
                  value={draftFilters.surveyNumber}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, surveyNumber: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subdivision Number</label>
                <input
                  type="text"
                  placeholder="e.g. 2B"
                  value={draftFilters.subdivisionNumber}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, subdivisionNumber: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section: Water Applications & Allotments */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('water')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-cyan-600" />
              <span>4. Water Allocation & Application Status</span>
            </span>
            {openSections.water ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.water && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Required Litres Min (L)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="e.g. 10000"
                  value={draftFilters.requiredLitresMin}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, requiredLitresMin: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Required Litres Max (L)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="e.g. 100000"
                  value={draftFilters.requiredLitresMax}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, requiredLitresMax: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Approved Litres Min (L)</label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  placeholder="e.g. 5000"
                  value={draftFilters.approvedLitresMin}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, approvedLitresMin: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Application Status</label>
                <select
                  value={draftFilters.applicationStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, applicationStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Statuses</option>
                  {filterMeta?.applicationStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section: Billing, 5-Installments & Payments */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('billing')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>5. Development Billing, 5-Installment Stages & Payments</span>
            </span>
            {openSections.billing ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.billing && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Overall Payment Status <span className="text-red-500 font-bold">*</span>
                </label>
                <select
                  value={draftFilters.paymentStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50/50 px-3 py-2 text-sm font-semibold text-amber-950 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value="">All Payment States</option>
                  <option value="PAID">PAID (Fully Settled)</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="UNPAID">UNPAID (0 Paid)</option>
                  <option value="OVERDUE">OVERDUE (Has Past Due Installment)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Installment Number (1–5)</label>
                <select
                  value={draftFilters.installmentNumber}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, installmentNumber: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">Any Installment</option>
                  <option value="1">Installment 1 (Initial Deposit)</option>
                  <option value="2">Installment 2 (Site Work)</option>
                  <option value="3">Installment 3 (Pipe Laying)</option>
                  <option value="4">Installment 4 (Testing)</option>
                  <option value="5">Installment 5 (Commissioning)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Installment Status</label>
                <select
                  value={draftFilters.installmentStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, installmentStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Installment Statuses</option>
                  {filterMeta?.installmentStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={draftFilters.paymentMode}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, paymentMode: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Payment Modes</option>
                  {filterMeta?.paymentModes?.map((mode: string) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section: Infrastructure & Extensions */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('infrastructure')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600" />
              <span>6. Physical Infrastructure Grid & Quota Extensions</span>
            </span>
            {openSections.infrastructure ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.infrastructure && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Infrastructure Status</label>
                <select
                  value={draftFilters.infrastructureStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, infrastructureStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Infrastructure Statuses</option>
                  {filterMeta?.infrastructureStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Extension Request Status</label>
                <select
                  value={draftFilters.extensionStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, extensionStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Extension Statuses</option>
                  {filterMeta?.extensionStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Running Bill Status</label>
                <select
                  value={draftFilters.runningBillStatus}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, runningBillStatus: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="">All Running Bill Statuses</option>
                  {filterMeta?.billStatuses?.map((st: string) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Section: Date Range Scope */}
        <div className="p-5">
          <button
            type="button"
            onClick={() => toggleSection('dates')}
            className="w-full flex items-center justify-between text-left font-semibold text-slate-900 text-sm mb-3"
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>7. Date Range Scope & Event Timestamps</span>
            </span>
            {openSections.dates ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {openSections.dates && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Date Target Field</label>
                <select
                  value={draftFilters.dateType}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateType: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                >
                  <option value="application_date">Water Application Date</option>
                  <option value="approval_date">Allotment Approval Date</option>
                  <option value="payment_date">Payment Transaction Date</option>
                  <option value="planned_date">Infrastructure Planned Date</option>
                  <option value="commissioned_date">Infrastructure Commissioned Date</option>
                  <option value="extension_date">Extension Request Date</option>
                  <option value="created_at">Beneficiary Record Created At</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={draftFilters.dateFrom}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={draftFilters.dateTo}
                  onChange={(e) => setDraftFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Real-Time Filtered Metrics (Whole Population) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-sky-600" />
            <span>Aggregate Metrics for Filtered Population</span>
            {isFetching && <RefreshCw className="w-3.5 h-3.5 text-sky-500 animate-spin" />}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            Computed over <span className="font-bold text-slate-800">{meta.total}</span> matching beneficiaries (not limited to current page)
          </span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Beneficiaries Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Beneficiaries</span>
                <User className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">{metrics.beneficiaries.total.toLocaleString()}</div>
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span className="text-emerald-600 font-medium">Active: {metrics.beneficiaries.active}</span>
                <span>•</span>
                <span className="text-slate-500">Inactive: {metrics.beneficiaries.inactive}</span>
              </div>
            </div>

            {/* Land Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Active Land Area</span>
                <MapIcon className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">
                {parseFloat(metrics.land.totalLandAcres).toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-emerald-600">acres</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span>Holdings: <b className="text-slate-800">{metrics.land.totalHoldings}</b></span>
                <span>•</span>
                <span>Parcels: <b className="text-slate-800">{metrics.land.totalParcels}</b></span>
              </div>
            </div>

            {/* Water Allocation Card */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Water Allocation</span>
                <Droplets className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl font-bold text-cyan-700">
                {parseFloat(metrics.water.totalApprovedLitres).toLocaleString()} <span className="text-sm font-normal text-cyan-600">L Approved</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span>Req: <b className="text-slate-800">{parseFloat(metrics.water.totalRequiredLitres).toLocaleString()} L</b></span>
                <span>•</span>
                <span>Calc: <b className="text-slate-800">{parseFloat(metrics.water.totalCalculatedLitres).toLocaleString()} L</b></span>
              </div>
            </div>

            {/* Financial Development Cost */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Total Development Cost</span>
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900">
                ₹{parseFloat(metrics.financials.totalDevelopmentCost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span className="text-emerald-600 font-semibold">Paid: ₹{parseFloat(metrics.financials.totalAmountPaid).toLocaleString()}</span>
                <span>•</span>
                <span className="text-red-600 font-semibold">Pending: ₹{parseFloat(metrics.financials.totalPending).toLocaleString()}</span>
              </div>
            </div>

            {/* Payment Beneficiaries Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Beneficiary Payment States</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="flex items-center justify-between gap-1 pt-1">
                <div className="text-center">
                  <div className="text-sm font-bold text-emerald-600">{metrics.paymentBeneficiaries.paid}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Paid</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-amber-600">{metrics.paymentBeneficiaries.partiallyPaid}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Partial</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-600">{metrics.paymentBeneficiaries.unpaid}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Unpaid</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-red-600">{metrics.paymentBeneficiaries.overdue}</div>
                  <div className="text-[10px] text-slate-500 uppercase">Overdue</div>
                </div>
              </div>
            </div>

            {/* 5-Installment Stages Breakdown */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>5-Stage Installments</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-bold text-indigo-700">{metrics.installments.total} <span className="text-sm font-normal text-indigo-500">Stages</span></div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span className="text-emerald-600 font-medium">{metrics.installments.paid} Paid</span>
                <span>•</span>
                <span className="text-amber-600 font-medium">{metrics.installments.pending} Pending</span>
                <span>•</span>
                <span className="text-red-600 font-medium">{metrics.installments.overdue} Overdue</span>
              </div>
            </div>

            {/* Infrastructure Progress */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Infrastructure Grid</span>
                <Building2 className="w-4 h-4 text-violet-600" />
              </div>
              <div className="text-2xl font-bold text-violet-700">
                {metrics.infrastructure.commissioned} <span className="text-sm font-normal text-violet-500">Commissioned</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span>Plan: {metrics.infrastructure.planned}</span>
                <span>•</span>
                <span>Const: {metrics.infrastructure.underConstruction}</span>
                <span>•</span>
                <span>Comp: {metrics.infrastructure.completed}</span>
              </div>
            </div>

            {/* Extensions Summary */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Quota Extensions</span>
                <Clock className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl font-bold text-teal-700">
                {metrics.extensions.approved} / {metrics.extensions.totalRequests} <span className="text-sm font-normal text-teal-500">Approved</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                <span>Pending: {metrics.extensions.pending}</span>
                <span>•</span>
                <span>+Litres: {parseFloat(metrics.extensions.additionalLitresApproved).toLocaleString()} L</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* 5. Results Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Filtered Matching Records</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing records {meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1} to{' '}
              {Math.min(meta.page * meta.limit, meta.total)} of {meta.total.toLocaleString()} matching beneficiaries
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Rows per page:</span>
            <select
              value={appliedFilters.limit}
              onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-3" />
            <p className="text-sm font-medium">Querying PostgreSQL database...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6 text-slate-400" />
            </div>
            <h4 className="text-base font-bold text-slate-900">No records found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              No beneficiaries or related records match the selected filter criteria. Try removing one or more filters.
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-4 px-4 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-lg text-xs font-semibold transition"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-200 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4 text-right">Land (Ac)</th>
                  <th className="py-3 px-4 text-right">Approved Water</th>
                  <th className="py-3 px-4 text-right">Dev Cost</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Pending</th>
                  <th className="py-3 px-4 text-center">Payment Status</th>
                  <th className="py-3 px-4 text-center">Infrastructure</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {items.map((record: any, idx: number) => {
                  const rowNumber = (meta.page - 1) * meta.limit + idx + 1;
                  return (
                    <tr key={record.beneficiaryId} className="hover:bg-sky-50/50 transition">
                      <td className="py-3.5 px-4 font-mono text-slate-400">{rowNumber}</td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/beneficiaries/${record.beneficiaryId}`}
                          className="font-bold text-slate-900 hover:text-sky-600 transition flex items-center gap-1 group"
                        >
                          <span>{record.name}</span>
                          <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition text-sky-500" />
                        </Link>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{record.phoneNumber}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{record.villageName}</div>
                        <div className="text-[11px] text-slate-500">{record.blockName}, {record.districtName}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-700">
                        {record.totalLandAcres}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-cyan-700">
                        {parseFloat(record.approvedLitres).toLocaleString()} L
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-900">
                        ₹{parseFloat(record.developmentCost).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                        ₹{parseFloat(record.amountPaid).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-red-600">
                        ₹{parseFloat(record.pendingBalance).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            record.paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : record.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : record.paymentStatus === 'OVERDUE'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-slate-100 text-slate-700 border border-slate-300'
                          }`}
                        >
                          {record.paymentStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            record.infrastructureStatus === 'COMMISSIONED'
                              ? 'bg-violet-100 text-violet-800'
                              : record.infrastructureStatus === 'COMPLETED'
                              ? 'bg-blue-100 text-blue-800'
                              : record.infrastructureStatus === 'UNDER_CONSTRUCTION'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {record.infrastructureStatus.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Link
                          href={`/beneficiaries/${record.beneficiaryId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-sky-100 text-slate-700 hover:text-sky-700 rounded-md font-semibold text-[11px] transition"
                        >
                          <span>View Detail</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {meta.totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              onClick={() => handlePageChange(Math.max(1, meta.page - 1))}
              disabled={meta.page <= 1 || isLoading}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <div className="text-xs text-slate-600 font-medium">
              Page <span className="font-bold text-slate-900">{meta.page}</span> of{' '}
              <span className="font-bold text-slate-900">{meta.totalPages}</span>
            </div>

            <button
              onClick={() => handlePageChange(Math.min(meta.totalPages, meta.page + 1))}
              disabled={meta.page >= meta.totalPages || isLoading}
              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Save Preset Modal */}
      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Save Filter as Preset</h3>
              <button
                onClick={() => setShowSavePresetModal(false)}
                className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Save the current combination of location, financial, status, and water filters to quickly run reports in the future.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preset Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Village-wise Water Allocation"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of what this preset filters..."
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  className="w-full text-sm rounded-lg border-slate-300 px-3 py-2 focus:ring-sky-500 focus:border-sky-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!presetName.trim() || presetSaving}
                onClick={handleSaveCurrentPreset}
                className="px-4 py-2 bg-sky-600 text-white text-xs font-semibold rounded-lg hover:bg-sky-700 disabled:opacity-50 transition"
              >
                {presetSaving ? 'Saving...' : 'Save Preset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

