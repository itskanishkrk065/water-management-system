'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatAcres, formatCurrency, formatDate, getStatusBadgeClass } from '@/lib/utils';
import {
  Users,
  Search,
  Plus,
  ArrowRight,
  Phone,
  MapPin,
  Filter,
  RefreshCw,
  MoreVertical,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Archive,
  Lock,
  Unlock,
  KeyRound,
  FileText,
  AlertTriangle,
  X,
  Layers,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit,
  Droplet,
  Receipt,
  CreditCard,
  Building2,
  Copy,
} from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';

export default function AdminBeneficiariesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filters State
  const [search, setSearch] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [status, setStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Active Row Actions dropdown tracking
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modals state
  const [selectedBeneficiary, setSelectedBeneficiary] = useState<any | null>(null);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch Districts
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data;
    },
  });

  // Fetch Blocks when districtId selected
  const { data: blocks } = useQuery({
    queryKey: ['blocks', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const res = await apiClient.get(`/locations/districts/${districtId}/blocks`);
      return res.data;
    },
    enabled: !!districtId,
  });

  // Fetch Villages when blockId selected
  const { data: villageData } = useQuery({
    queryKey: ['villages', blockId],
    queryFn: async () => {
      if (!blockId) return { items: [] };
      const res = await apiClient.get(`/locations/blocks/${blockId}/villages`, {
        params: { limit: 200 },
      });
      return res.data;
    },
    enabled: !!blockId,
  });

  const villages = Array.isArray(villageData) ? villageData : villageData?.items || [];

  // Main Beneficiaries List Query with Server-Side Search & Filters
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-beneficiaries', search, districtId, blockId, villageId, status, page, limit],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiaries', {
        params: {
          search: search.trim() || undefined,
          districtId: districtId || undefined,
          blockId: blockId || undefined,
          villageId: villageId || undefined,
          status: status || undefined,
          page,
          limit,
        },
      });
      return res.data;
    },
  });

  // Active Obligations Query for Deactivation Modal
  const { data: obligations, isLoading: obligationsLoading } = useQuery({
    queryKey: ['obligations', selectedBeneficiary?.beneficiary_id],
    queryFn: async () => {
      if (!selectedBeneficiary?.beneficiary_id) return null;
      const res = await apiClient.get(`/beneficiaries/${selectedBeneficiary.beneficiary_id}/obligations`);
      return res.data;
    },
    enabled: !!selectedBeneficiary && showDeactivateModal,
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/deactivate`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowDeactivateModal(false);
      setSelectedBeneficiary(null);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to deactivate beneficiary');
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/reactivate`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowReactivateModal(false);
      setSelectedBeneficiary(null);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to reactivate beneficiary');
    },
  });

  // Archive Mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/archive`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowArchiveModal(false);
      setSelectedBeneficiary(null);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to archive beneficiary');
    },
  });

  // Toggle Account Login Status
  const toggleAccountMutation = useMutation({
    mutationFn: async ({ id, isActive, reason }: { id: string; isActive: boolean; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/account/toggle-status`, { isActive, reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      setShowAccountModal(false);
      setSelectedBeneficiary(null);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to update account access');
    },
  });

  // Force Password Reset
  const passwordResetMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/account/force-password-reset`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary'] });
      alert('Password reset request recorded. Beneficiary notified via secure channel.');
      setShowAccountModal(false);
      setSelectedBeneficiary(null);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to trigger password reset');
    },
  });

  const clearFilters = () => {
    setSearch('');
    setDistrictId('');
    setBlockId('');
    setVillageId('');
    setStatus('');
    setPage(1);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Beneficiary Management Registry"
        description="Centralized administrative registry for farmer identities, verified land parcels, water quotas, financial ledgers, and account access."
        breadcrumbs={[
          { label: 'Operations', href: '/dashboard' },
          { label: 'Beneficiaries', href: '/admin/beneficiaries' },
          { label: 'Registry' },
        ]}
        actions={
          <div className="flex items-center space-x-3">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-sky-600' : ''}`} />
            </button>
            <Link
              href="/beneficiaries/new"
              className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Beneficiary
            </Link>
          </div>
        }
      />

      {/* Search and Cascading Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Main Search */}
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by farmer name, phone number, UUID, or survey no..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition"
            />
          </div>

          {/* District Cascade */}
          <div className="md:col-span-2">
            <select
              value={districtId}
              onChange={(e) => {
                setDistrictId(e.target.value);
                setBlockId('');
                setVillageId('');
                setPage(1);
              }}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="">All Districts</option>
              {districts?.map((d: any) => (
                <option key={d.district_id} value={d.district_id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Block Cascade */}
          <div className="md:col-span-2">
            <select
              value={blockId}
              onChange={(e) => {
                setBlockId(e.target.value);
                setVillageId('');
                setPage(1);
              }}
              disabled={!districtId}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
            >
              <option value="">All Blocks</option>
              {blocks?.map((b: any) => (
                <option key={b.block_id} value={b.block_id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Village Cascade */}
          <div className="md:col-span-2">
            <select
              value={villageId}
              onChange={(e) => {
                setVillageId(e.target.value);
                setPage(1);
              }}
              disabled={!blockId}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-50"
            >
              <option value="">All Villages</option>
              {villages?.map((v: any) => (
                <option key={v.village_id} value={v.village_id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-slate-500 flex items-center">
              <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" /> Filter By:
            </span>

            {/* Status Filter */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Status:</span>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>

            {/* Rows Per Page */}
            <div className="flex items-center space-x-1.5">
              <span className="text-slate-500">Rows:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
              >
                <option value="15">15</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {(search || districtId || blockId || villageId || status) && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-medium transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Beneficiary Registry Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Count Header */}
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
          <div className="flex items-center space-x-2">
            <span className="text-slate-900 font-bold text-sm">
              {data?.meta?.total ? data.meta.total.toLocaleString() : 0} Beneficiaries
            </span>
            {data?.meta && (
              <span className="text-slate-400">
                • Showing {((data.meta.page - 1) * data.meta.limit) + 1}–
                {Math.min(data.meta.page * data.meta.limit, data.meta.total)}
              </span>
            )}
          </div>
          <div className="text-slate-500 text-[11px]">
            Server-Side Filtered &amp; Paginated
          </div>
        </div>

        {/* Scrollable Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Beneficiary ID &amp; Farmer</th>
                <th className="px-4 py-3.5">Contact</th>
                <th className="px-4 py-3.5">Administrative Location</th>
                <th className="px-4 py-3.5 text-right">Total Land</th>
                <th className="px-4 py-3.5 text-center">Applications</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Administrative Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                    <div className="inline-flex items-center space-x-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                      <span>Loading authorized beneficiary directory...</span>
                    </div>
                  </td>
                </tr>
              ) : data?.items?.length > 0 ? (
                data.items.map((b: any, bIdx: number) => {
                  const isMenuOpen = activeMenuId === b.beneficiary_id;
                  const isNearBottom = bIdx >= Math.max(0, data.items.length - 3) && data.items.length > 3;
                  return (
                    <tr
                      key={b.beneficiary_id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Farmer Name & UUID */}
                      <td className="px-5 py-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {b.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              href={`/admin/beneficiaries/${b.beneficiary_id}`}
                              className="font-bold text-slate-900 hover:text-sky-600 transition"
                            >
                              {b.name}
                            </Link>
                            <div className="flex items-center space-x-1 font-mono text-[10px] text-slate-400 mt-0.5">
                              <span>{b.beneficiary_id.slice(0, 8)}...</span>
                              <button
                                onClick={() => copyToClipboard(b.beneficiary_id, b.beneficiary_id)}
                                className="hover:text-slate-600"
                                title="Copy full UUID"
                              >
                                {copiedId === b.beneficiary_id ? (
                                  <span className="text-emerald-600 font-sans">Copied!</span>
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone & Contact */}
                      <td className="px-4 py-4 text-slate-700">
                        <div className="flex items-center space-x-1 text-xs font-semibold">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{b.phone_number}</span>
                        </div>
                        {b.email && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[150px]">
                            {b.email}
                          </div>
                        )}
                      </td>

                      {/* Location Cascade */}
                      <td className="px-4 py-4 text-slate-600">
                        <div className="flex items-center space-x-1 font-medium text-slate-800">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{b.village?.name || '—'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b.block?.name}, {b.district?.name}
                        </div>
                      </td>

                      {/* Land Total */}
                      <td className="px-4 py-4 text-right">
                        <span className="font-bold text-slate-900 text-sm">
                          {formatAcres(b.total_land_acres || 0)}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {b._count?.landHoldings || 0} Holdings
                        </div>
                      </td>

                      {/* Counts / Water */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 bg-sky-50 text-sky-700 font-semibold rounded-full border border-sky-200 text-[11px]">
                          <Droplet className="w-3 h-3 mr-1 text-sky-500" />
                          {b._count?.waterApplications || 0} Apps
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {b._count?.waterAllotments || 0} Allotments
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${getStatusBadgeClass(
                            b.status,
                          )}`}
                        >
                          {b.status}
                        </span>
                      </td>

                      {/* Action Menu */}
                      <td className="px-5 py-4 text-right relative">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/admin/beneficiaries/${b.beneficiary_id}`}
                            className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Manage
                          </Link>

                          {/* Quick Admin Dropdown Trigger */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuId(isMenuOpen ? null : b.beneficiary_id)}
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200 transition"
                              title="More Administrative Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div
                                onMouseLeave={() => setActiveMenuId(null)}
                                onWheel={(e) => e.stopPropagation()}
                                className={`absolute right-0 ${
                                  isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'
                                } w-56 max-h-[70vh] overflow-y-auto overscroll-contain bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-left text-xs divide-y divide-slate-100`}
                              >
                                <div className="py-1">
                                  <Link
                                    href={`/admin/beneficiaries/${b.beneficiary_id}?tab=overview`}
                                    className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-sky-600"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    View Full Dossier
                                  </Link>
                                  <Link
                                    href={`/admin/beneficiaries/${b.beneficiary_id}?tab=land`}
                                    className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-sky-600"
                                  >
                                    <Layers className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    Manage Land & SF Parcels
                                  </Link>
                                  <Link
                                    href={`/admin/beneficiaries/${b.beneficiary_id}?tab=water`}
                                    className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-sky-600"
                                  >
                                    <Droplet className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    Review Water Quotas
                                  </Link>
                                  <Link
                                    href={`/admin/beneficiaries/${b.beneficiary_id}?tab=payments`}
                                    className="flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-sky-600"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                    Billing & 5-Installments
                                  </Link>
                                </div>

                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      setSelectedBeneficiary(b);
                                      setShowAccountModal(true);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full flex items-center px-3.5 py-2 text-slate-700 hover:bg-slate-50"
                                  >
                                    <KeyRound className="w-3.5 h-3.5 mr-2 text-amber-500" />
                                    Account Security & Login
                                  </button>
                                </div>

                                <div className="py-1">
                                  {b.status === 'ACTIVE' ? (
                                    <button
                                      onClick={() => {
                                        setSelectedBeneficiary(b);
                                        setShowDeactivateModal(true);
                                        setActiveMenuId(null);
                                        setActionReason('');
                                        setActionError(null);
                                      }}
                                      className="w-full flex items-center px-3.5 py-2 text-rose-600 hover:bg-rose-50 font-medium"
                                    >
                                      <ShieldAlert className="w-3.5 h-3.5 mr-2 text-rose-500" />
                                      Deactivate Beneficiary...
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedBeneficiary(b);
                                        setShowReactivateModal(true);
                                        setActiveMenuId(null);
                                        setActionReason('');
                                        setActionError(null);
                                      }}
                                      className="w-full flex items-center px-3.5 py-2 text-emerald-600 hover:bg-emerald-50 font-medium"
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 mr-2 text-emerald-500" />
                                      Reactivate Beneficiary...
                                    </button>
                                  )}

                                  {isAdmin && (
                                    <button
                                      onClick={() => {
                                        setSelectedBeneficiary(b);
                                        setShowArchiveModal(true);
                                        setActiveMenuId(null);
                                        setActionReason('');
                                        setActionError(null);
                                      }}
                                      className="w-full flex items-center px-3.5 py-2 text-slate-500 hover:bg-slate-100"
                                    >
                                      <Archive className="w-3.5 h-3.5 mr-2 text-slate-400" />
                                      Archive Records (Admin)
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-slate-400">
                    <div className="max-w-md mx-auto space-y-2">
                      <Users className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-semibold text-slate-700">No beneficiaries matched your query</p>
                      <p className="text-xs text-slate-400">
                        Try clearing or modifying the search filters above.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div>
              Showing Page <span className="font-bold text-slate-900">{data.meta.page}</span> of{' '}
              <span className="font-bold text-slate-900">{data.meta.totalPages}</span> (Total{' '}
              {data.meta.total} records)
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Previous
              </button>
              <div className="px-3 py-1.5 font-mono text-slate-700 bg-slate-200/60 rounded-lg">
                {page} / {data.meta.totalPages}
              </div>
              <button
                disabled={page >= data.meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: DEACTIVATE BENEFICIARY (WITH ACTIVE OBLIGATIONS CHECK) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showDeactivateModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Deactivate Beneficiary</h3>
              </div>
              <button
                onClick={() => setShowDeactivateModal(false)}
                className="text-rose-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500">Beneficiary Target:</div>
                <div className="font-bold text-sm text-slate-900 mt-0.5">
                  {selectedBeneficiary.name} ({selectedBeneficiary.phone_number})
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  ID: {selectedBeneficiary.beneficiary_id}
                </div>
              </div>

              {/* Active Obligations Evaluation */}
              {obligationsLoading ? (
                <div className="p-4 text-center text-slate-400 bg-slate-50 rounded-xl">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-rose-500" />
                  Checking active operational and financial bindings...
                </div>
              ) : obligations?.hasObligations ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Active Obligations Detected!</span>
                  </div>
                  <p className="text-amber-700 leading-relaxed">
                    This beneficiary has active operational ties:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium pl-1">
                    {Number(obligations.approvedWaterLitres) > 0 && (
                      <li>Approved Water Quota: {Number(obligations.approvedWaterLitres).toLocaleString()} L</li>
                    )}
                    {Number(obligations.totalPendingAmount) > 0 && (
                      <li>Pending Development Balance: ₹{Number(obligations.totalPendingAmount).toLocaleString()}</li>
                    )}
                    {obligations.pendingInstallmentsCount > 0 && (
                      <li>Pending Installments: {obligations.pendingInstallmentsCount} milestones</li>
                    )}
                    {obligations.activeInfrastructureCount > 0 && (
                      <li>Active Pipeline Infrastructure: {obligations.activeInfrastructureCount} works</li>
                    )}
                  </ul>
                  <div className="text-[11px] text-amber-800 font-semibold pt-1">
                    Deactivating will suspend active operational workflows. Historical records and financial ledgers will remain intact.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No active operational obligations found. Safe to deactivate.</span>
                </div>
              )}

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              {/* Mandatory Reason Input */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Deactivation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the administrative reason for deactivating this beneficiary (mandatory for audit logging)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || deactivateMutation.isPending}
                  onClick={() =>
                    deactivateMutation.mutate({
                      id: selectedBeneficiary.beneficiary_id,
                      reason: actionReason,
                    })
                  }
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Confirm Deactivation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: REACTIVATE BENEFICIARY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showReactivateModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Reactivate Beneficiary</h3>
              </div>
              <button
                onClick={() => setShowReactivateModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600">
                Reactivating <strong className="text-slate-900">{selectedBeneficiary.name}</strong> will return this profile to active status, allowing new water requests and operations.
              </p>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reactivation Reason <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the reason for reactivation (e.g., resumed farming operations)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowReactivateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || reactivateMutation.isPending}
                  onClick={() =>
                    reactivateMutation.mutate({
                      id: selectedBeneficiary.beneficiary_id,
                      reason: actionReason,
                    })
                  }
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Beneficiary'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ARCHIVE BENEFICIARY (ADMIN ONLY) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showArchiveModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Archive className="w-5 h-5 text-slate-300" />
                <h3 className="font-bold text-base">Archive Beneficiary (Admin Governance)</h3>
              </div>
              <button
                onClick={() => setShowArchiveModal(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                Archiving retains all historical ledgers and survey parcels for audit purposes while fully removing the profile from active operational pipelines.
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Archival Justification <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the permanent archival justification..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || archiveMutation.isPending}
                  onClick={() =>
                    archiveMutation.mutate({
                      id: selectedBeneficiary.beneficiary_id,
                      reason: actionReason,
                    })
                  }
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {archiveMutation.isPending ? 'Archiving...' : 'Confirm Archival'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ACCOUNT LOGIN & SECURITY MANAGEMENT */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showAccountModal && selectedBeneficiary && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Beneficiary Account Security</h3>
              </div>
              <button
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-800">{selectedBeneficiary.name}</div>
                <div className="text-slate-500 mt-0.5">Phone: {selectedBeneficiary.phone_number}</div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="font-bold text-slate-800">Login Access</div>
                    <div className="text-slate-500 text-[11px]">Enable or disable self-service portal login</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() =>
                        toggleAccountMutation.mutate({
                          id: selectedBeneficiary.beneficiary_id,
                          isActive: true,
                          reason: 'Administrative access restored',
                        })
                      }
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold"
                    >
                      Enable Login
                    </button>
                    <button
                      onClick={() =>
                        toggleAccountMutation.mutate({
                          id: selectedBeneficiary.beneficiary_id,
                          isActive: false,
                          reason: 'Administrative security lockout',
                        })
                      }
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold"
                    >
                      Disable Login
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <div className="font-bold text-slate-800">Force Password Reset</div>
                    <div className="text-slate-500 text-[11px]">Initiate verified reset flow without exposing passwords</div>
                  </div>
                  <button
                    onClick={() =>
                      passwordResetMutation.mutate({
                        id: selectedBeneficiary.beneficiary_id,
                        reason: 'Admin requested password reset',
                      })
                    }
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-semibold"
                  >
                    Trigger Reset
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
