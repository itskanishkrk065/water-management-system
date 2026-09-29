'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  formatCurrency,
  formatLitres,
  formatAcres,
  formatDate,
  formatDateTime,
  getStatusBadgeClass,
} from '@/lib/utils';
import {
  User,
  Phone,
  MapPin,
  Compass,
  Layers,
  Droplet,
  Receipt,
  CreditCard,
  Building2,
  ArrowUpRight,
  FileText,
  History,
  Plus,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  Edit,
  ShieldAlert,
  ShieldCheck,
  Archive,
  KeyRound,
  RotateCcw,
  Copy,
  ChevronRight,
  ExternalLink,
  Lock,
  Unlock,
  Sparkles,
} from 'lucide-react';

function AdminBeneficiaryDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string;
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';
  const isAccounts = user?.role === 'ADMIN' || user?.role === 'ACCOUNTS';

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAddLandModal, setShowAddLandModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReversePaymentModal, setShowReversePaymentModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);

  // Correction & Action inputs
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);

  // Edit Profile Form State
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress1, setEditAddress1] = useState('');
  const [editAddress2, setEditAddress2] = useState('');
  const [editAddress3, setEditAddress3] = useState('');
  const [editDistrictId, setEditDistrictId] = useState('');
  const [editBlockId, setEditBlockId] = useState('');
  const [editVillageId, setEditVillageId] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editDirection, setEditDirection] = useState('NORTH');
  const [editDescription, setEditDescription] = useState('');

  // Add Land Form State
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [declaredTotalArea, setDeclaredTotalArea] = useState('');
  const [parcels, setParcels] = useState<Array<{ surveyNumber: string; subdivisionNumber: string; area: string }>>([
    { surveyNumber: '', subdivisionNumber: '', area: '' },
  ]);
  const [landFormError, setLandFormError] = useState<string | null>(null);

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Beneficiary Dossier Query
  const { data: b, isLoading, refetch } = useQuery({
    queryKey: ['admin-beneficiary-detail', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // History Query
  const { data: historyLogs } = useQuery({
    queryKey: ['beneficiary-history', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/history`);
      return res.data;
    },
    enabled: !!id && activeTab === 'history',
  });

  // Active Obligations Query
  const { data: obligations, isLoading: obligationsLoading } = useQuery({
    queryKey: ['obligations', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/obligations`);
      return res.data;
    },
    enabled: !!id && showDeactivateModal,
  });

  // Location Queries for Cascading Edit Form
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data;
    },
  });

  const { data: editBlocks } = useQuery({
    queryKey: ['blocks', editDistrictId],
    queryFn: async () => {
      if (!editDistrictId) return [];
      const res = await apiClient.get(`/locations/districts/${editDistrictId}/blocks`);
      return res.data;
    },
    enabled: !!editDistrictId,
  });

  const { data: editVillageData } = useQuery({
    queryKey: ['villages', editBlockId],
    queryFn: async () => {
      if (!editBlockId) return { items: [] };
      const res = await apiClient.get(`/locations/blocks/${editBlockId}/villages`, {
        params: { limit: 200 },
      });
      return res.data;
    },
    enabled: !!editBlockId,
  });

  const editVillages = Array.isArray(editVillageData) ? editVillageData : editVillageData?.items || [];

  // Projects Query
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  // Populate Edit Modal
  const openEditModal = () => {
    if (!b) return;
    setEditName(b.name || '');
    setEditPhone(b.phone_number || '');
    setEditEmail(b.email || '');
    setEditAddress1(b.address_line1 || '');
    setEditAddress2(b.address_line2 || '');
    setEditAddress3(b.address_line3 || '');
    setEditDistrictId(b.district_id || '');
    setEditBlockId(b.block_id || '');
    setEditVillageId(b.village_id || '');
    setEditPincode(b.pincode || '');
    setEditDirection(b.location_direction || 'NORTH');
    setEditDescription(b.location_description || '');
    setActionReason('');
    setActionError(null);
    setShowEditModal(true);
  };

  // Update Profile Mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.patch(`/beneficiaries/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowEditModal(false);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to update beneficiary');
    },
  });

  // Deactivate Mutation
  const deactivateMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post(`/beneficiaries/${id}/deactivate`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowDeactivateModal(false);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to deactivate');
    },
  });

  // Reactivate Mutation
  const reactivateMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post(`/beneficiaries/${id}/reactivate`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowReactivateModal(false);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to reactivate');
    },
  });

  // Archive Mutation
  const archiveMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post(`/beneficiaries/${id}/archive`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowArchiveModal(false);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to archive');
    },
  });

  // Toggle Account Access
  const toggleAccountMutation = useMutation({
    mutationFn: async ({ isActive, reason }: { isActive: boolean; reason: string }) => {
      const res = await apiClient.post(`/beneficiaries/${id}/account/toggle-status`, { isActive, reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowAccountModal(false);
      setActionReason('');
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to update login access');
    },
  });

  // Force Password Reset
  const passwordResetMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiClient.post(`/beneficiaries/${id}/account/force-password-reset`, { reason });
      return res.data;
    },
    onSuccess: () => {
      alert('Password reset trigger recorded in audit log. User can reset via SMS/Email.');
      setShowAccountModal(false);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to trigger reset');
    },
  });

  // Add Land Submit Handler
  const handleAddLandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLandFormError(null);

    const targetProject = selectedProjectId || projects?.[0]?.project_id;
    if (!targetProject) {
      setLandFormError('Please select a project');
      return;
    }

    const declared = parseFloat(declaredTotalArea);
    if (isNaN(declared) || declared <= 0) {
      setLandFormError('Please enter a valid declared total area');
      return;
    }

    const parsedParcels = parcels.map((p) => ({
      surveyNumber: p.surveyNumber.trim(),
      subdivisionNumber: p.subdivisionNumber.trim(),
      area: parseFloat(p.area) || 0,
    }));

    for (const p of parsedParcels) {
      if (!p.surveyNumber || !p.subdivisionNumber || p.area <= 0) {
        setLandFormError('All survey parcels must have survey number, subdivision, and positive area');
        return;
      }
    }

    const sumParcels = parsedParcels.reduce((sum, p) => sum + p.area, 0);
    if (Math.abs(sumParcels - declared) > 0.001) {
      setLandFormError(
        `Area Checksum Mismatch: Sum of parcels (${sumParcels.toFixed(2)} ac) does not equal declared total area (${declared.toFixed(2)} ac)`,
      );
      return;
    }

    try {
      await apiClient.post(`/beneficiaries/${id}/land`, {
        projectId: targetProject,
        declaredTotalArea: declared,
        parcels: parsedParcels,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowAddLandModal(false);
      setDeclaredTotalArea('');
      setParcels([{ surveyNumber: '', subdivisionNumber: '', area: '' }]);
    } catch (err: any) {
      setLandFormError(err.response?.data?.message || 'Error adding land holding');
    }
  };

  // Record Payment Submit Handler
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setPaymentError('Please enter a valid payment amount');
      return;
    }

    if (!selectedInstallmentId) {
      setPaymentError('No installment milestone selected');
      return;
    }

    try {
      await apiClient.post('/payments', {
        installmentId: selectedInstallmentId,
        amount: amt,
        paymentMode,
        referenceNumber: paymentRef.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-detail', id] });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  const copyToClipboard = (text: string, copyKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(copyKey);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Loading Beneficiary Management Dossier...</p>
        </div>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center max-w-lg mx-auto my-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Beneficiary Record Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested beneficiary record does not exist or has been removed from the registry.
        </p>
        <Link
          href="/admin/beneficiaries"
          className="inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold"
        >
          Return to Beneficiary Directory
        </Link>
      </div>
    );
  }

  // Calculated KPI aggregates
  const totalLandAcres = b.landHoldings
    ?.filter((l: any) => l.status === 'ACTIVE')
    .reduce((acc: number, curr: any) => acc + parseFloat(curr.declared_total_area || '0'), 0) || 0;

  const totalRequiredWater = b.waterApplications?.reduce(
    (acc: number, curr: any) => acc + (curr.required_litres || 0),
    0,
  ) || 0;

  const totalApprovedWater = b.waterAllotments?.reduce(
    (acc: number, curr: any) => acc + (curr.approved_litres || 0),
    0,
  ) || 0;

  const totalDevCost = b.developmentBills?.reduce(
    (acc: number, curr: any) => acc + parseFloat(curr.development_cost || '0'),
    0,
  ) || 0;

  const totalPaid = b.developmentBills?.reduce(
    (acc: number, curr: any) => acc + parseFloat(curr.amount_paid || '0'),
    0,
  ) || 0;

  const totalPending = b.developmentBills?.reduce(
    (acc: number, curr: any) => acc + parseFloat(curr.pending_amount || '0'),
    0,
  ) || 0;

  const isBeneficiaryActive = b.status === 'ACTIVE';

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs text-slate-500">
        <Link href="/admin/beneficiaries" className="hover:text-sky-600 font-medium">
          Beneficiaries Directory
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-bold text-slate-800">{b.name}</span>
        <span className="font-mono text-slate-400">({b.beneficiary_id.slice(0, 8)}...)</span>
      </div>

      {/* Header Profile Dossier Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center font-extrabold text-2xl shadow-md shrink-0">
              {b.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{b.name}</h1>
                <span
                  className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(
                    b.status,
                  )}`}
                >
                  {b.status}
                </span>
                {b.user ? (
                  <span
                    className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${
                      b.user.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    Login: {b.user.is_active ? 'ENABLED' : 'DISABLED'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 text-[11px] font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    No Portal Account
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
                <div className="flex items-center space-x-1.5 font-mono text-slate-800">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{b.phone_number}</span>
                </div>
                {b.email && (
                  <div className="flex items-center space-x-1.5 text-slate-600">
                    <span>{b.email}</span>
                  </div>
                )}
                <div className="flex items-center space-x-1 text-slate-700">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>
                    {b.village?.name}, {b.block?.name}, {b.district?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Administrative Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openEditModal}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Edit Profile
            </button>

            <button
              onClick={() => setShowAccountModal(true)}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <KeyRound className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
              Account Security
            </button>

            {isBeneficiaryActive ? (
              <button
                onClick={() => {
                  setActionReason('');
                  setActionError(null);
                  setShowDeactivateModal(true);
                }}
                className="inline-flex items-center px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-sm"
              >
                <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => {
                  setActionReason('');
                  setActionError(null);
                  setShowReactivateModal(true);
                }}
                className="inline-flex items-center px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                Reactivate
              </button>
            )}

            {isAdmin && isBeneficiaryActive && (
              <button
                onClick={() => {
                  setActionReason('');
                  setActionError(null);
                  setShowArchiveModal(true);
                }}
                className="inline-flex items-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition"
                title="Archive historical dossier"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Operational KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 border-t border-slate-100">
          <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Land
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatAcres(totalLandAcres)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {b.landHoldings?.length || 0} Holding parcels
            </div>
          </div>

          <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Required Water
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatLitres(totalRequiredWater)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Agricultural Demand</div>
          </div>

          <div className="p-3.5 bg-sky-50/50 border border-sky-200 rounded-xl">
            <div className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider">
              Approved Water
            </div>
            <div className="text-base font-extrabold text-sky-900 mt-1">
              {formatLitres(totalApprovedWater)}
            </div>
            <div className="text-[10px] text-sky-600 mt-0.5">Government Allotment</div>
          </div>

          <div className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Development Cost
            </div>
            <div className="text-base font-extrabold text-slate-900 mt-1">
              {formatCurrency(totalDevCost)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Historical Rate Basis</div>
          </div>

          <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl">
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">
              Total Paid
            </div>
            <div className="text-base font-extrabold text-emerald-900 mt-1">
              {formatCurrency(totalPaid)}
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">Verified Collections</div>
          </div>

          <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl">
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">
              Balance Pending
            </div>
            <div className="text-base font-extrabold text-amber-900 mt-1">
              {formatCurrency(totalPending)}
            </div>
            <div className="text-[10px] text-amber-600 mt-0.5">Outstanding Dues</div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* 10 OPERATIONAL TABS NAVIGATION */}
      {/* ──────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto text-xs font-semibold scrollbar-none">
        {[
          { id: 'overview', label: 'Overview', icon: User },
          { id: 'land', label: `Land (${b.landHoldings?.length || 0})`, icon: Layers },
          { id: 'water', label: `Water (${b.waterApplications?.length || 0})`, icon: Droplet },
          { id: 'billing', label: `Billing (${b.developmentBills?.length || 0})`, icon: Receipt },
          { id: 'payments', label: `Payments & Installments`, icon: CreditCard },
          { id: 'infrastructure', label: `Infrastructure (${b.infrastructures?.length || 0})`, icon: Building2 },
          { id: 'extensions', label: `Extensions (${b.extensions?.length || 0})`, icon: ArrowUpRight },
          { id: 'documents', label: `Documents (${b.documents?.length || 0})`, icon: FileText },
          { id: 'account', label: `Account Security`, icon: KeyRound },
          { id: 'history', label: `Audit Trail`, icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-sky-600 text-sky-700 font-bold bg-sky-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 1: OVERVIEW */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center">
              <User className="w-4 h-4 mr-2 text-sky-600" />
              Farmer Identity & Revenue Location
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Beneficiary UUID:</span>
                <span className="font-mono text-slate-800 font-semibold">{b.beneficiary_id}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Full Name:</span>
                <span className="font-bold text-slate-900">{b.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Phone Number:</span>
                <span className="font-mono font-semibold text-slate-900">{b.phone_number}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Email Address:</span>
                <span className="text-slate-900">{b.email || 'Not Provided'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Revenue District:</span>
                <span className="font-semibold text-slate-900">{b.district?.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Revenue Block:</span>
                <span className="font-semibold text-slate-900">{b.block?.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Revenue Village:</span>
                <span className="font-semibold text-slate-900">{b.village?.name}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Postal Pincode:</span>
                <span className="font-mono text-slate-900">{b.pincode}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center">
              <Compass className="w-4 h-4 mr-2 text-indigo-600" />
              Direction & Physical Address
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Direction from Village:</span>
                <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                  {b.location_direction}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Location Landmark:</span>
                <span className="text-slate-900 text-right max-w-[240px]">
                  {b.location_description || 'None recorded'}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Address Line 1:</span>
                <span className="text-slate-900">{b.address_line1}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Address Line 2:</span>
                <span className="text-slate-900">{b.address_line2 || '—'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Profile Created:</span>
                <span className="text-slate-700">{formatDate(b.created_at)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Last System Update:</span>
                <span className="text-slate-700">{formatDateTime(b.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 2: LAND MANAGEMENT & PARCELS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'land' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Surveyed Land Holdings</h3>
              <p className="text-xs text-slate-500">
                Verified survey & subdivision records with area checksum validation
              </p>
            </div>
            <button
              onClick={() => setShowAddLandModal(true)}
              className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow transition"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Land Holding
            </button>
          </div>

          <div className="space-y-4">
            {b.landHoldings?.length > 0 ? (
              b.landHoldings.map((lh: any, idx: number) => {
                const totalParcelsArea = lh.parcels?.reduce(
                  (acc: number, curr: any) => acc + parseFloat(curr.area || '0'),
                  0,
                ) || 0;
                const isChecksumValid =
                  Math.abs(totalParcelsArea - parseFloat(lh.declared_total_area)) < 0.001;

                return (
                  <div
                    key={lh.holding_id}
                    className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                          #{idx + 1}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">
                            Holding #{idx + 1} — Declared: {formatAcres(lh.declared_total_area)}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            Project ID: {lh.project_id} • Holding UUID: {lh.holding_id.slice(0, 8)}...
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isChecksumValid ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Area Balanced
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 text-xs font-semibold rounded-lg">
                            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Area Mismatch
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${getStatusBadgeClass(lh.status)}`}>
                          {lh.status}
                        </span>
                      </div>
                    </div>

                    {/* SF Parcels Breakdown */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Survey & Subdivision Parcels ({lh.parcels?.length || 0})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {lh.parcels?.map((p: any) => (
                          <div
                            key={p.parcel_id}
                            className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-mono font-bold text-slate-800">
                                SF {p.survey_number}/{p.subdivision_number}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Verified Boundary
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-emerald-700 text-sm">
                                {formatAcres(p.area)}
                              </div>
                              <div className="text-[10px] text-slate-400">{p.status}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Historical Protection Notice */}
                    {b.waterAllotments?.length > 0 && (
                      <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-800 text-xs flex items-center space-x-2">
                        <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>
                          <strong>Historical Rule Active:</strong> This land holding is linked to an approved water allotment. Structural modifications require administrative versioning to preserve quota integrity.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Layers className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No land holdings recorded</p>
                <p className="text-xs">Click "Add Land Holding" above to register agricultural parcels.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 3: WATER APPLICATIONS & ALLOTMENTS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'water' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Water Applications & Allocation History</h3>
            <p className="text-xs text-slate-500">
              Formal water quotas calculated per acre tariff and government allotment orders
            </p>
          </div>

          <div className="space-y-4">
            {b.waterApplications?.length > 0 ? (
              b.waterApplications.map((app: any) => (
                <div
                  key={app.application_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Water Application #{app.application_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-slate-500">
                        Submitted: {formatDate(app.created_at)}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(app.status)}`}>
                      {app.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Required Litres:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {formatLitres(app.required_litres)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Calculated Litres:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {formatLitres(app.calculated_litres)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Rate at Application:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        ₹{app.rate_snapshot?.rate_per_litre || 0.05}/L
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Review Status:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {app.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Droplet className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No water applications registered</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 4: BILLING */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Development Cost Bills</h3>
            <p className="text-xs text-slate-500">
              Immutable historical billing records based on locked tariff rates
            </p>
          </div>

          <div className="space-y-4">
            {b.developmentBills?.length > 0 ? (
              b.developmentBills.map((bill: any) => (
                <div
                  key={bill.bill_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Bill #{bill.bill_number}
                      </div>
                      <div className="text-xs text-slate-500">
                        Generated: {formatDate(bill.created_at)}
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(bill.status)}`}>
                      {bill.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Approved Volume:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {formatLitres(bill.approved_litres)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Historical Rate:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        ₹{bill.rate_applied_per_litre}/L
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Development Cost:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {formatCurrency(bill.development_cost)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Outstanding Balance:</span>
                      <div className="font-bold text-amber-700 text-sm mt-0.5">
                        {formatCurrency(bill.pending_amount)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Receipt className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No development bills issued</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 5: PAYMENTS & 5-STAGE INSTALLMENTS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">5-Stage Installments & Payments Ledger</h3>
            <p className="text-xs text-slate-500">
              Progressive milestone payment schedule and verified accounting receipts
            </p>
          </div>

          {/* 5-Installment Schedule */}
          {b.developmentBills?.[0]?.installments?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
                5-Stage Milestone Schedule
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Stage #</th>
                      <th className="px-4 py-3">Milestone Name</th>
                      <th className="px-4 py-3 text-right">Percentage</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                      <th className="px-4 py-3 text-right">Paid</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {b.developmentBills[0].installments.map((inst: any) => (
                      <tr key={inst.installment_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-bold text-slate-900">
                          #{inst.installment_number}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-800">
                          {inst.milestone_name}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono">
                          {inst.percentage}%
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                          {formatCurrency(inst.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-emerald-700">
                          {formatCurrency(inst.amount_paid || 0)}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${getStatusBadgeClass(inst.status)}`}>
                            {inst.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          {inst.status !== 'PAID' && isAccounts && (
                            <button
                              onClick={() => {
                                setSelectedInstallmentId(inst.installment_id);
                                setPaymentAmount(String(parseFloat(inst.amount) - parseFloat(inst.amount_paid || '0')));
                                setPaymentError(null);
                                setShowPaymentModal(true);
                              }}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                            >
                              Pay Milestone
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payments List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 uppercase tracking-wider">
              Payments Ledger Transactions
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Receipt #</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.payments?.length > 0 ? (
                    b.payments.map((p: any) => (
                      <tr key={p.payment_id} className="hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-mono font-bold text-sky-700">
                          {p.receipt_number || p.payment_id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600">
                          {formatDateTime(p.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-700">
                          {p.payment_mode}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-500">
                          {p.reference_number || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${getStatusBadgeClass(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No financial payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 6: INFRASTRUCTURE GRID */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Infrastructure Works & Grid Commissioning</h3>
            <p className="text-xs text-slate-500">
              Pipeline construction lifecycle: PLANNED → UNDER CONSTRUCTION → COMPLETED → COMMISSIONED
            </p>
          </div>

          <div className="space-y-4">
            {b.infrastructures?.length > 0 ? (
              b.infrastructures.map((infra: any) => (
                <div
                  key={infra.infrastructure_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="font-bold text-slate-900 text-sm">
                      Infrastructure Work #{infra.infrastructure_id.slice(0, 8)}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(infra.status)}`}>
                      {infra.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Planned Date:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {formatDate(infra.planned_date) || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Construction Started:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {formatDate(infra.construction_started_date) || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Completed Date:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {formatDate(infra.completed_date) || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Commissioned Date:</span>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {formatDate(infra.commissioned_date) || '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <Building2 className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No infrastructure works recorded</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 7: EXTENSIONS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Quota Extension Requests</h3>
            <p className="text-xs text-slate-500">
              Area and water quota expansions tracked independently from base allotments
            </p>
          </div>

          <div className="space-y-4">
            {b.extensions?.length > 0 ? (
              b.extensions.map((ext: any) => (
                <div
                  key={ext.extension_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="font-bold text-slate-900 text-sm">
                      Extension Request #{ext.extension_id.slice(0, 8)}
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(ext.status)}`}>
                      {ext.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Requested Area:</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatAcres(ext.additional_land_area)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Requested Litres:</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatLitres(ext.requested_litres)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Extension Cost:</span>
                      <div className="font-bold text-slate-900 mt-0.5">
                        {formatCurrency(ext.extension_cost || 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Requested Date:</span>
                      <div className="font-semibold text-slate-700 mt-0.5">
                        {formatDate(ext.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-2">
                <ArrowUpRight className="w-10 h-10 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-700">No extension requests recorded</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 8: DOCUMENTS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900">Categorized Documents Repository</h3>
            <p className="text-xs text-slate-500">
              Official patta deeds, survey sketches, application forms, and receipts
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {['Land Records', 'Water Allotment Order', 'Development Bills', 'Payment Receipts', 'Infrastructure Survey', 'Other'].map(
              (category, idx) => (
                <div
                  key={category}
                  className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm hover:border-sky-300 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">{category}</span>
                    <FileText className="w-4 h-4 text-sky-600" />
                  </div>
                  <p className="text-xs text-slate-400">
                    Encrypted verified documentation on record.
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-emerald-700 font-semibold">Verified Archive</span>
                    <button className="text-sky-600 font-bold hover:underline">
                      View
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 9: ACCOUNT SECURITY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 max-w-2xl shadow-sm">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <KeyRound className="w-4 h-4 mr-2 text-amber-500" />
              Beneficiary Portal Account Access
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Manage self-service credentials and password reset triggers without plain text exposure
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Login Access Status</span>
                <p className="text-slate-400 text-[11px]">
                  Controls whether the farmer can sign in to the self-service beneficiary portal
                </p>
              </div>
              <span
                className={`px-3 py-1 font-bold rounded-full border ${
                  b.user?.is_active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {b.user?.is_active ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Linked Account Identity</span>
                <p className="text-slate-400 text-[11px]">User UUID and Authentication Email</p>
              </div>
              <span className="font-mono text-slate-700">
                {b.user?.email || b.email || 'No email bound'}
              </span>
            </div>

            <div className="py-3 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800">Account Created</span>
                <p className="text-slate-400 text-[11px]">Initial registration timestamp</p>
              </div>
              <span className="text-slate-700">{formatDateTime(b.user?.created_at || b.created_at)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center space-x-3">
            {b.user?.is_active ? (
              <button
                onClick={() =>
                  toggleAccountMutation.mutate({
                    isActive: false,
                    reason: 'Administrative lockout from beneficiary management detail',
                  })
                }
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow"
              >
                Disable Login Access
              </button>
            ) : (
              <button
                onClick={() =>
                  toggleAccountMutation.mutate({
                    isActive: true,
                    reason: 'Administrative access restored from beneficiary detail',
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow"
              >
                Enable Login Access
              </button>
            )}

            <button
              onClick={() =>
                passwordResetMutation.mutate('Admin initiated password reset from beneficiary detail')
              }
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow"
            >
              Trigger Password Reset
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* TAB 10: COMPLETE AUDIT HISTORY */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm space-y-4">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Chronological Audit Events</h3>
              <p className="text-xs text-slate-500">
                Immutable record of administrative corrections, status changes, and reason justifications
              </p>
            </div>
            <History className="w-5 h-5 text-slate-400" />
          </div>

          <div className="p-6">
            {historyLogs?.length > 0 ? (
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6">
                {historyLogs.map((log: any) => (
                  <div key={log.audit_id} className="relative pl-6">
                    {/* Timeline bullet */}
                    <div className="absolute -left-2 top-0.5 w-4 h-4 rounded-full bg-sky-600 border-2 border-white shadow" />
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {log.action} — {log.entity_type}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {formatDateTime(log.created_at)}
                        </span>
                      </div>

                      <div className="text-slate-600">
                        <strong>Actor:</strong> {log.user?.full_name || 'System'} ({log.user?.role?.name || 'ADMIN'})
                      </div>

                      {log.reason && (
                        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900">
                          <strong>Correction Reason:</strong> {log.reason}
                        </div>
                      )}

                      {log.old_values && log.new_values && (
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-2 bg-white p-2.5 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-rose-600 font-bold">Old Value:</span>
                            <pre className="text-slate-600 overflow-x-auto mt-0.5">
                              {JSON.stringify(log.old_values, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <span className="text-emerald-600 font-bold">New Value:</span>
                            <pre className="text-slate-600 overflow-x-auto mt-0.5">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                No audit events recorded for this beneficiary yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: EDIT BENEFICIARY (ADMINISTRATIVE CORRECTION) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">Administrative Profile Correction</h3>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!actionReason.trim()) {
                  setActionError('An administrative correction reason is mandatory.');
                  return;
                }
                updateProfileMutation.mutate({
                  name: editName.trim(),
                  phoneNumber: editPhone.trim(),
                  email: editEmail.trim() || undefined,
                  addressLine1: editAddress1.trim(),
                  addressLine2: editAddress2.trim() || undefined,
                  addressLine3: editAddress3.trim() || undefined,
                  districtId: editDistrictId,
                  blockId: editBlockId,
                  villageId: editVillageId,
                  pincode: editPincode.trim(),
                  locationDirection: editDirection,
                  locationDescription: editDescription.trim() || undefined,
                  reason: actionReason.trim(),
                });
              }}
              className="p-6 space-y-4 text-xs"
            >
              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Farmer Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number (Login Identity) *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                  <p className="text-[10px] text-amber-600 mt-1">
                    Changing phone updates portal login identity. Old number is retained in audit history.
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Revenue Location Hierarchy */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800">Verified Location Cascade</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-500 mb-1">District *</label>
                    <select
                      required
                      value={editDistrictId}
                      onChange={(e) => {
                        setEditDistrictId(e.target.value);
                        setEditBlockId('');
                        setEditVillageId('');
                      }}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="">Select District</option>
                      {districts?.map((d: any) => (
                        <option key={d.district_id} value={d.district_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Block *</label>
                    <select
                      required
                      value={editBlockId}
                      onChange={(e) => {
                        setEditBlockId(e.target.value);
                        setEditVillageId('');
                      }}
                      disabled={!editDistrictId}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-50"
                    >
                      <option value="">Select Block</option>
                      {editBlocks?.map((b: any) => (
                        <option key={b.block_id} value={b.block_id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Village *</label>
                    <select
                      required
                      value={editVillageId}
                      onChange={(e) => setEditVillageId(e.target.value)}
                      disabled={!editBlockId}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-50"
                    >
                      <option value="">Select Village</option>
                      {editVillages?.map((v: any) => (
                        <option key={v.village_id} value={v.village_id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={editPincode}
                    onChange={(e) => setEditPincode(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Direction from Village *</label>
                  <select
                    value={editDirection}
                    onChange={(e) => setEditDirection(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="NORTH">NORTH</option>
                    <option value="SOUTH">SOUTH</option>
                    <option value="EAST">EAST</option>
                    <option value="WEST">WEST</option>
                    <option value="NORTHEAST">NORTHEAST</option>
                    <option value="NORTHWEST">NORTHWEST</option>
                    <option value="SOUTHEAST">SOUTHEAST</option>
                    <option value="SOUTHWEST">SOUTHWEST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Address Line 1 *</label>
                <input
                  type="text"
                  required
                  value={editAddress1}
                  onChange={(e) => setEditAddress1(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              {/* Mandatory Reason */}
              <div>
                <label className="block font-bold text-slate-900 mb-1">
                  Correction Reason (Required for Audit Logging) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="State the reason for this administrative correction (e.g., corrected spelling in name / revenue village mismatch)..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {updateProfileMutation.isPending ? 'Saving Correction...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD LAND HOLDING */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showAddLandModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Add Land Holding & Survey Parcels</h3>
              </div>
              <button onClick={() => setShowAddLandModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLandSubmit} className="p-6 space-y-4 text-xs">
              {landFormError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {landFormError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Project Scheme</label>
                <select
                  value={selectedProjectId || projects?.[0]?.project_id || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {projects?.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Declared Total Area (Acres) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 5.00"
                  value={declaredTotalArea}
                  onChange={(e) => setDeclaredTotalArea(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                />
              </div>

              {/* Dynamic Parcels */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Survey Numbers & Subdivision Parcels
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setParcels([...parcels, { surveyNumber: '', subdivisionNumber: '', area: '' }])
                    }
                    className="text-sky-600 font-bold hover:underline flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Parcel
                  </button>
                </div>

                {parcels.map((p, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 items-center"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        required
                        placeholder="Survey No (e.g. 101)"
                        value={p.surveyNumber}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].surveyNumber = e.target.value;
                          setParcels(updated);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        required
                        placeholder="Subdivision (e.g. 1A)"
                        value={p.subdivisionNumber}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].subdivisionNumber = e.target.value;
                          setParcels(updated);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="Area (ac)"
                        value={p.area}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].area = e.target.value;
                          setParcels(updated);
                        }}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-1 text-center">
                      {parcels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setParcels(parcels.filter((_, i) => i !== idx))}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4 mx-auto" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLandModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition"
                >
                  Verify & Save Land Holding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: RECORD PAYMENT */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">Record Milestone Payment</h3>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="p-6 space-y-4 text-xs">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {paymentError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  <option value="UPI">UPI / QR Transfer</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer (NEFT/RTGS)</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CASH">Cash Collection</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Reference / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTR-987654321"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow transition"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: DEACTIVATE (WITH OBLIGATIONS) */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Deactivate Beneficiary</h3>
              </div>
              <button onClick={() => setShowDeactivateModal(false)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {obligationsLoading ? (
                <div className="p-4 text-center text-slate-400">
                  Checking active operational and financial bindings...
                </div>
              ) : obligations?.hasObligations ? (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-amber-800 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Active Obligations Warning</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-amber-900 font-medium">
                    {Number(obligations.approvedWaterLitres) > 0 && (
                      <li>Approved Water Quota: {Number(obligations.approvedWaterLitres).toLocaleString()} L</li>
                    )}
                    {Number(obligations.totalPendingAmount) > 0 && (
                      <li>Pending Balance: ₹{Number(obligations.totalPendingAmount).toLocaleString()}</li>
                    )}
                    {obligations.pendingInstallmentsCount > 0 && (
                      <li>Pending Installments: {obligations.pendingInstallmentsCount}</li>
                    )}
                    {obligations.activeInfrastructureCount > 0 && (
                      <li>Active Infrastructure: {obligations.activeInfrastructureCount} works</li>
                    )}
                  </ul>
                  <div className="text-[11px] text-amber-800 font-semibold pt-1">
                    Deactivating suspends active workflows. Historical records and ledgers will remain intact.
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium">
                  No active operational bindings. Safe to deactivate.
                </div>
              )}

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Deactivation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the administrative reason for deactivation..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || deactivateMutation.isPending}
                  onClick={() => deactivateMutation.mutate(actionReason)}
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
      {/* MODAL: REACTIVATE */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-200" />
                <h3 className="font-bold text-base">Reactivate Beneficiary</h3>
              </div>
              <button onClick={() => setShowReactivateModal(false)} className="text-emerald-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
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
                  placeholder="State the reason for reactivation..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowReactivateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || reactivateMutation.isPending}
                  onClick={() => reactivateMutation.mutate(actionReason)}
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
      {/* MODAL: ARCHIVE */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Archive className="w-5 h-5 text-slate-300" />
                <h3 className="font-bold text-base">Archive Beneficiary (Admin)</h3>
              </div>
              <button onClick={() => setShowArchiveModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl">
                Archiving retains all historical ledgers and survey parcels for audit purposes while removing the profile from active operations.
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Archival Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="State the reason for permanent archival..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowArchiveModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={!actionReason.trim() || archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate(actionReason)}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {archiveMutation.isPending ? 'Archiving...' : 'Confirm Archival'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBeneficiaryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminBeneficiaryDetailContent />
    </Suspense>
  );
}
