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
  Info,
  Sparkles,
  RefreshCw,
  Loader2,
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
  const [showEditLandModal, setShowEditLandModal] = useState(false);
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

  // Edit Land Form State
  const [editingLandId, setEditingLandId] = useState('');
  const [editLandProjectId, setEditLandProjectId] = useState('');
  const [editLandDeclaredArea, setEditLandDeclaredArea] = useState('');
  const [editLandParcels, setEditLandParcels] = useState<
    Array<{ surveyNumber: string; subdivisionNumber: string; area: string }>
  >([{ surveyNumber: '', subdivisionNumber: '', area: '' }]);
  const [editLandError, setEditLandError] = useState<string | null>(null);
  const [isSubmittingEditLand, setIsSubmittingEditLand] = useState(false);

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Water Application Modal State
  const [showAddWaterAppModal, setShowAddWaterAppModal] = useState(false);
  const [waterAppLandId, setWaterAppLandId] = useState('');
  const [waterAppProjectId, setWaterAppProjectId] = useState('');
  const [waterAppRequiredLitres, setWaterAppRequiredLitres] = useState('');
  const [waterAppRemarks, setWaterAppRemarks] = useState('');
  const [waterAppError, setWaterAppError] = useState<string | null>(null);
  const [isSubmittingWaterApp, setIsSubmittingWaterApp] = useState(false);

  // Real-time Modal Parcel Availability Cache
  const [modalParcelAvailability, setModalParcelAvailability] = useState<{
    [key: string]: { checking: boolean; available?: boolean; message?: string; owner?: string };
  }>({});
  const modalAvailabilityTimers = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  const checkModalParcelAvailability = (key: string, survey: string, sub: string, currentParcelId?: string) => {
    const sTrim = survey.trim();
    const subTrim = sub.trim();
    if (!sTrim || !subTrim) {
      setModalParcelAvailability((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    if (modalAvailabilityTimers.current[key]) {
      clearTimeout(modalAvailabilityTimers.current[key]);
    }

    setModalParcelAvailability((prev) => ({
      ...prev,
      [key]: { checking: true },
    }));

    modalAvailabilityTimers.current[key] = setTimeout(async () => {
      try {
        const res = await apiClient.post('/land/parcels/check-availability', {
          surveyNumber: sTrim,
          subdivisionNumber: subTrim,
          currentParcelId: currentParcelId || undefined,
        });
        setModalParcelAvailability((prev) => ({
          ...prev,
          [key]: {
            checking: false,
            available: res.data.available,
            message: res.data.message,
            owner: res.data.existingOwner,
          },
        }));
      } catch {
        setModalParcelAvailability((prev) => ({
          ...prev,
          [key]: { checking: false, available: false, message: 'Failed to verify parcel' },
        }));
      }
    }, 300);
  };

  // Safe Deletion Modals State
  const [holdingToDelete, setHoldingToDelete] = useState<any | null>(null);
  const [deleteHoldingError, setDeleteHoldingError] = useState<string | null>(null);
  const [isDeletingHolding, setIsDeletingHolding] = useState(false);

  const [appToDelete, setAppToDelete] = useState<any | null>(null);
  const [deleteAppError, setDeleteAppError] = useState<string | null>(null);
  const [isDeletingApp, setIsDeletingApp] = useState(false);

  // 1. Lightweight Beneficiary Overview Query (Always fresh server state)
  const { data: b, isLoading, refetch } = useQuery({
    queryKey: ['admin-beneficiary-overview', id],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/beneficiaries/${id}/overview`);
        return res.data;
      } catch {
        const res = await apiClient.get(`/beneficiaries/${id}`);
        return res.data;
      }
    },
    enabled: !!id,
  });

  // 2. Tab Queries (Synchronized dynamically without stale cache lock)
  const { data: landData, isLoading: isLandLoading } = useQuery({
    queryKey: ['beneficiary-land', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/land`);
      return res.data;
    },
    enabled: !!id && (activeTab === 'land' || showAddWaterAppModal),
  });

  const { data: waterData, isLoading: isWaterLoading } = useQuery({
    queryKey: ['beneficiary-water', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/water`);
      return res.data;
    },
    enabled: !!id && activeTab === 'water',
  });

  // Canonical Eligible Holdings Query for Water Quota Application
  const { data: eligibleHoldingsData, isLoading: isEligibleHoldingsLoading } = useQuery({
    queryKey: ['eligible-holdings', id],
    queryFn: async () => {
      const res = await apiClient.get(`/water/eligible-holdings/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const eligibleHoldings: any[] = Array.isArray(eligibleHoldingsData)
    ? eligibleHoldingsData
    : (eligibleHoldingsData?.eligible_holdings || []);

  const { data: billingData, isLoading: isBillingLoading } = useQuery({
    queryKey: ['beneficiary-billing', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/billing`);
      return res.data;
    },
    enabled: !!id && activeTab === 'billing',
  });

  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['beneficiary-payments', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/payments`);
      return res.data;
    },
    enabled: !!id && (activeTab === 'billing' || activeTab === 'payments'),
  });

  const { data: infraData, isLoading: isInfraLoading } = useQuery({
    queryKey: ['beneficiary-infra', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/infrastructure`);
      return res.data;
    },
    enabled: !!id && activeTab === 'infrastructure',
  });

  const { data: extensionsData, isLoading: isExtensionsLoading } = useQuery({
    queryKey: ['beneficiary-extensions', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/extensions`);
      return res.data;
    },
    enabled: !!id && activeTab === 'extensions',
  });

  const { data: documentsData, isLoading: isDocumentsLoading } = useQuery({
    queryKey: ['beneficiary-documents', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}/documents`);
      return res.data;
    },
    enabled: !!id && activeTab === 'documents',
  });

  // 3. History Query (Lazy)
  const { data: historyLogs, isLoading: isHistoryLoading } = useQuery({
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

  // Projects Query for Scheme Selection
  const { data: projects } = useQuery({
    queryKey: ['active-projects'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/projects/active');
        return res.data;
      } catch {
        const res = await apiClient.get('/projects');
        return res.data;
      }
    },
  });

  // Live Section 28 Preview Query for Water Application Modal
  const { data: waterAppPreview } = useQuery({
    queryKey: ['previewAllotment', id, waterAppProjectId, waterAppLandId],
    queryFn: async () => {
      if (!id || !waterAppProjectId) return null;
      try {
        const res = await apiClient.get('/water/preview-allotment', {
          params: {
            beneficiaryId: id,
            projectId: waterAppProjectId,
            landId: waterAppLandId || undefined,
          },
        });
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id && !!waterAppProjectId && showAddWaterAppModal,
  });

  // Populate Edit Modal
  const openEditModal = () => {
    if (!b) return;
    setEditName(b.name || '');
    setEditPhone(b.phone_number || '');
    setEditEmail(b.email || '');
    setEditAddress1(b.address_line_1 || b.address_line1 || '');
    setEditAddress2(b.address_line_2 || b.address_line2 || '');
    setEditAddress3(b.address_line_3 || b.address_line3 || '');
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
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

    const targetProject = selectedProjectId;
    if (!targetProject) {
      setLandFormError('Project Scheme is required. Please select an active scheme.');
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

    const seenParcels = new Set<string>();
    for (const p of parsedParcels) {
      const key = `${p.surveyNumber.toUpperCase()}#${p.subdivisionNumber.toUpperCase()}`;
      if (seenParcels.has(key)) {
        setLandFormError(
          `Duplicate parcel detected: Survey ${p.surveyNumber} / Subdivision ${p.subdivisionNumber} is specified more than once for this land holding.`,
        );
        return;
      }
      seenParcels.add(key);
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water', id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowAddLandModal(false);
      setDeclaredTotalArea('');
      setParcels([{ surveyNumber: '', subdivisionNumber: '', area: '' }]);
    } catch (err: any) {
      setLandFormError(err.response?.data?.message || 'Error adding land holding');
    }
  };

  // Open Edit Land Modal Helper
  const openEditLandModal = (lh: any) => {
    setEditingLandId(lh.land_id || lh.holding_id);
    setEditLandProjectId(lh.project_id || lh.project?.project_id || '');
    setEditLandDeclaredArea(String(lh.declared_total_area || ''));
    if (lh.parcels && lh.parcels.length > 0) {
      setEditLandParcels(
        lh.parcels.map((p: any) => ({
          surveyNumber: p.survey_number || '',
          subdivisionNumber: p.subdivision_number || '',
          area: String(p.area || ''),
        })),
      );
    } else {
      setEditLandParcels([{ surveyNumber: '', subdivisionNumber: '', area: '' }]);
    }
    setEditLandError(null);
    setShowEditLandModal(true);
  };

  // Edit Land Submit Handler
  const handleEditLandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditLandError(null);

    const declared = parseFloat(editLandDeclaredArea);
    if (isNaN(declared) || declared <= 0) {
      setEditLandError('Please enter a valid declared total area');
      return;
    }

    const filteredParcels = editLandParcels.filter(
      (p) => p.surveyNumber.trim() || p.subdivisionNumber.trim() || p.area.trim(),
    );

    let parsedParcels: any[] = [];
    if (filteredParcels.length > 0) {
      parsedParcels = filteredParcels.map((p) => ({
        surveyNumber: p.surveyNumber.trim(),
        subdivisionNumber: p.subdivisionNumber.trim(),
        area: parseFloat(p.area) || 0,
      }));

      for (const p of parsedParcels) {
        if (!p.surveyNumber || !p.subdivisionNumber || p.area <= 0) {
          setEditLandError('All survey parcels must have survey number, subdivision, and positive area');
          return;
        }
      }

      const seen = new Set<string>();
      for (const p of parsedParcels) {
        const key = `${p.surveyNumber.toUpperCase()}#${p.subdivisionNumber.toUpperCase()}`;
        if (seen.has(key)) {
          setEditLandError(`Duplicate parcel detected in form: Survey ${p.surveyNumber} / Subdivision ${p.subdivisionNumber}`);
          return;
        }
        seen.add(key);
      }

      const sum = parsedParcels.reduce((acc, p) => acc + p.area, 0);
      if (Math.abs(sum - declared) > 0.001) {
        setEditLandError(
          `Sum of parcels (${sum.toFixed(2)} ac) does not match declared total area (${declared.toFixed(2)} ac)`,
        );
        return;
      }
    }

    setIsSubmittingEditLand(true);
    try {
      await apiClient.patch(`/land/holdings/${editingLandId}`, {
        projectId: editLandProjectId || undefined,
        declaredTotalArea: declared,
        parcels: parsedParcels,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water', id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowEditLandModal(false);
    } catch (err: any) {
      setEditLandError(err.response?.data?.message || 'Failed to update land holding');
    } finally {
      setIsSubmittingEditLand(false);
    }
  };

  // Safe Land Holding Deletion Handler
  const handleDeleteHolding = async () => {
    if (!holdingToDelete) return;
    setIsDeletingHolding(true);
    setDeleteHoldingError(null);
    try {
      const landId = holdingToDelete.land_id || holdingToDelete.holding_id;
      await apiClient.delete(`/land/holdings/${landId}`);
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water', id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setHoldingToDelete(null);
    } catch (err: any) {
      setDeleteHoldingError(err.response?.data?.message || 'Cannot delete land holding because it is referenced by existing records.');
    } finally {
      setIsDeletingHolding(false);
    }
  };

  // Safe Water Application Deletion / Cancellation Handler
  const handleDeleteWaterApp = async () => {
    if (!appToDelete) return;
    setIsDeletingApp(true);
    setDeleteAppError(null);
    try {
      const appId = appToDelete.application_id || appToDelete.id;
      if (appToDelete.status === 'DRAFT') {
        await apiClient.delete(`/water/applications/${appId}`);
      } else {
        await apiClient.post(`/water/applications/${appId}/cancel`, {
          reason: 'Administrative cancellation via Beneficiary Dossier',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land', id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setAppToDelete(null);
    } catch (err: any) {
      setDeleteAppError(err.response?.data?.message || 'Cannot delete water application because it has dependent historical or financial records.');
    } finally {
      setIsDeletingApp(false);
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
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-billing', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-payments', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowPaymentModal(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  // Open Add Water Application Modal helper
  const openAddWaterAppModal = (preselectedLandId?: string) => {
    setWaterAppError(null);
    setWaterAppRemarks('');
    setWaterAppRequiredLitres('');

    // Determine eligible holdings from canonical query or fallback
    const available = Array.isArray(eligibleHoldings) && eligibleHoldings.length > 0
      ? eligibleHoldings
      : (Array.isArray(landHoldings) && landHoldings.length > 0 ? landHoldings : (landData?.holdings || []));

    const targetLandId = preselectedLandId || (available.length > 0 ? (available[0].land_id || available[0].holding_id) : '');
    setWaterAppLandId(targetLandId);

    const targetHolding = available.find((l: any) => (l.land_id || l.holding_id) === targetLandId);
    if (targetHolding?.project_id) {
      setWaterAppProjectId(targetHolding.project_id);
    } else if (projects?.length > 0) {
      setWaterAppProjectId(projects[0].project_id);
    }

    setShowAddWaterAppModal(true);
  };

  // Add Water Application Submit Handler
  const handleAddWaterAppSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWaterAppError(null);

    if (!waterAppLandId) {
      setWaterAppError('Please select a valid eligible land holding for this water application.');
      return;
    }

    if (!waterAppProjectId) {
      setWaterAppError('Please select a project scheme');
      return;
    }

    const litres = parseFloat(waterAppRequiredLitres);
    if (isNaN(litres) || litres <= 0) {
      setWaterAppError('Please enter a valid required water volume in litres');
      return;
    }

    setIsSubmittingWaterApp(true);
    try {
      await apiClient.post('/water/applications', {
        beneficiaryId: id,
        landId: waterAppLandId,
        projectId: waterAppProjectId,
        requiredLitres: litres,
        remarks: waterAppRemarks.trim() || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land', id] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings', id] });
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-history', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      setShowAddWaterAppModal(false);
      setWaterAppRequiredLitres('');
      setWaterAppRemarks('');
      setWaterAppLandId('');
      setWaterAppError(null);
    } catch (err: any) {
      setWaterAppError(err.response?.data?.message || 'Failed to submit water application');
    } finally {
      setIsSubmittingWaterApp(false);
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

  // Tab-specific datasets (Lazy queried on demand or fallback to overview)
  const landHoldings = landData || b?.landHoldings || [];
  const waterApplications = waterData?.waterApplications || b?.waterApplications || [];
  const waterAllotments = waterData?.waterAllotments || b?.waterAllotments || [];
  const developmentBills = billingData?.developmentBills || b?.developmentBills || [];
  const runningBills = billingData?.runningBills || b?.runningBills || [];
  const paymentsList = paymentsData?.items || b?.payments || [];
  const infrastructuresList = infraData || b?.infrastructures || [];
  const extensionsList = extensionsData || b?.extensions || [];
  const documentsList = documentsData || b?.documents || [];

  // Calculated KPI aggregates
  const totalLandAcres = b?.metrics?.totalLandAcres
    ? parseFloat(b.metrics.totalLandAcres)
    : (landHoldings
        ?.filter((l: any) => l.status === 'ACTIVE')
        .reduce((acc: number, curr: any) => acc + (parseFloat(curr.declared_total_area) || 0), 0) || 0);

  const totalRequiredWater = waterApplications
    ?.filter((a: any) => !['REJECTED', 'CANCELLED', 'VOIDED'].includes(a.status))
    .reduce(
      (acc: number, curr: any) => acc + (parseFloat(curr.required_litres) || 0),
      0,
    ) || 0;

  const totalApprovedWater = b?.metrics?.approvedLitresTotal
    ? parseFloat(b.metrics.approvedLitresTotal)
    : (waterAllotments
        ?.filter((a: any) => a.approval_status === 'APPROVED')
        .reduce(
          (acc: number, curr: any) => acc + (parseFloat(curr.approved_litres) || 0),
          0,
        ) || 0);

  const totalDevCost = b?.metrics?.billsTotalAmount
    ? parseFloat(b.metrics.billsTotalAmount)
    : (developmentBills?.reduce(
        (acc: number, curr: any) => acc + (parseFloat(curr.total_amount) || parseFloat(curr.development_cost) || 0),
        0,
      ) || 0);

  const totalPaid = b?.metrics?.totalPaid
    ? parseFloat(b.metrics.totalPaid)
    : (paymentsList
        ?.filter((p: any) => !p.is_reversal && ['VERIFIED', 'POSTED', 'PAID', 'COMPLETED'].includes(p.status))
        .reduce(
          (acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0),
          0,
        ) || (developmentBills?.reduce(
          (acc: number, curr: any) => acc + (parseFloat(curr.amount_paid) || 0),
          0,
        ) || 0));

  const totalPending = b?.metrics?.pendingBalance
    ? parseFloat(b.metrics.pendingBalance)
    : Math.max(0, totalDevCost - totalPaid);

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
          { id: 'land', label: `Land (${landHoldings?.length || b?.metrics?.activeHoldingsCount || 0})`, icon: Layers },
          { id: 'water', label: `Water (${waterApplications?.length || b?.metrics?.waterApplicationsCount || 0})`, icon: Droplet },
          { id: 'billing', label: `Billing (${developmentBills?.length || 0})`, icon: Receipt },
          { id: 'payments', label: `Payments & Installments`, icon: CreditCard },
          { id: 'infrastructure', label: `Infrastructure (${infrastructuresList?.length || b?.metrics?.infrastructureCount || 0})`, icon: Building2 },
          { id: 'extensions', label: `Extensions (${extensionsList?.length || 0})`, icon: ArrowUpRight },
          { id: 'documents', label: `Documents (${documentsList?.length || 0})`, icon: FileText },
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
                <span className="text-slate-900 font-medium">{b.address_line_1 || b.address_line1 || '—'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500">Address Line 2:</span>
                <span className="text-slate-900 font-medium">{b.address_line_2 || b.address_line2 || '—'}</span>
              </div>
              {(b.address_line_3 || b.address_line3) && (
                <div className="py-2.5 flex justify-between">
                  <span className="text-slate-500">Address Line 3:</span>
                  <span className="text-slate-900 font-medium">{b.address_line_3 || b.address_line3}</span>
                </div>
              )}
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
            {landHoldings?.length > 0 ? (
              landHoldings.map((lh: any, idx: number) => {
                const hasParcels = lh.parcels && lh.parcels.length > 0;
                const totalParcelsArea = hasParcels
                  ? lh.parcels.reduce((acc: number, curr: any) => acc + (parseFloat(curr.area) || 0), 0)
                  : 0;
                const declaredAreaNum = parseFloat(lh.declared_total_area) || 0;
                const isAreaMatch = hasParcels && Math.abs(totalParcelsArea - declaredAreaNum) < 0.0001;
                const diffArea = totalParcelsArea - declaredAreaNum;

                return (
                  <div
                    key={lh.land_id || lh.holding_id || idx}
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
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 text-[11px] font-semibold">
                              Scheme: {lh.project?.project_name || 'Kongu Basin Scheme'} ({lh.project?.project_code || 'KB-IRR-2026'})
                            </span>
                            <span className="font-mono text-slate-400">
                              UUID: {(lh.land_id || lh.holding_id || '').slice(0, 8)}...
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {!hasParcels ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg" title="No subdivision parcels recorded yet for this land holding">
                            <Info className="w-3.5 h-3.5 mr-1 text-slate-500" /> Parcels Not Recorded
                          </span>
                        ) : isAreaMatch ? (
                          <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Area Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg" title={`Sum of parcels (${totalParcelsArea.toFixed(2)} ac) differs from declared area (${declaredAreaNum.toFixed(2)} ac)`}>
                            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500" /> Area Mismatch ({diffArea > 0 ? `+${diffArea.toFixed(2)}` : diffArea.toFixed(2)} ac)
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-lg border ${getStatusBadgeClass(lh.status)}`}>
                          {lh.status}
                        </span>
                        {(isAdmin || user?.role === 'FIELD_OFFICER') && (
                          <div className="flex items-center space-x-1 ml-1">
                            <button
                              onClick={() => openEditLandModal(lh)}
                              className="inline-flex items-center px-2.5 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition shadow-sm"
                              title="Edit declared area, scheme, or parcels"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setHoldingToDelete(lh);
                                  setDeleteHoldingError(null);
                                }}
                                className="inline-flex items-center px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition shadow-sm"
                                title="Delete or Archive Land Holding"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SF Parcels Breakdown */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Survey & Subdivision Parcels ({lh.parcels?.length || 0})
                      </div>
                      {hasParcels ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {lh.parcels?.map((p: any) => (
                            <div
                              key={p.parcel_id || `${p.survey_number}-${p.subdivision_number}`}
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
                                <div className="text-[10px] text-slate-400">{p.status || 'ACTIVE'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                          <Info className="w-4 h-4 text-slate-400" />
                          <span>No SF/subdivision parcels recorded for this land holding. Click "Edit" above to record survey parcels.</span>
                        </div>
                      )}
                    </div>

                    {/* Water Application Status for this Land Holding */}
                    {(() => {
                      const holdingApp = waterApplications?.find(
                        (a: any) => a.land_id === (lh.land_id || lh.holding_id) && !['REJECTED', 'CANCELLED', 'VOIDED'].includes(a.status),
                      );
                      if (holdingApp) {
                        return (
                          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-sky-900 text-xs flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Droplet className="w-4 h-4 text-sky-600 shrink-0" />
                              <span>
                                <strong>Water Application Active:</strong> #{holdingApp.application_id.slice(0, 8)} ({holdingApp.status}) • Quota: {formatLitres(holdingApp.required_litres)}
                              </span>
                            </div>
                            <button
                              onClick={() => setActiveTab('water')}
                              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[11px] transition shrink-0 ml-2"
                            >
                              View Application &rarr;
                            </button>
                          </div>
                        );
                      } else if (lh.status === 'ACTIVE') {
                        return (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              <span>
                                <strong>Eligible for Water Quota:</strong> No active water application linked to this land holding.
                              </span>
                            </div>
                            {(isAdmin || user?.role === 'FIELD_OFFICER') && (
                              <button
                                onClick={() => openAddWaterAppModal(lh.land_id || lh.holding_id)}
                                className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-bold text-[11px] transition shrink-0 ml-2"
                              >
                                + Apply for Water Quota
                              </button>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Historical Protection Notice */}
                    {waterAllotments?.length > 0 && (
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Water Applications & Allocation History</h3>
              <p className="text-xs text-slate-500">
                Formal water quotas calculated per acre tariff and government allotment orders
              </p>
            </div>
            {(isAdmin || user?.role === 'FIELD_OFFICER') && (
              <button
                onClick={() => openAddWaterAppModal()}
                className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Water Application
              </button>
            )}
          </div>

          <div className="space-y-4">
            {waterApplications?.length > 0 ? (
              waterApplications.map((app: any) => (
                <div
                  key={app.application_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                        <span>Water Application #{app.application_id.slice(0, 8)}</span>
                        {app.project && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 font-mono text-[11px]">
                            {app.project.project_code || app.project.project_name}
                          </span>
                        )}
                        {app.land_id && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
                            Holding #{app.land_id.slice(0, 8)} {app.landHolding?.declared_total_area ? `(${formatAcres(app.landHolding.declared_total_area)})` : ''}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        Submitted: {formatDate(app.created_at)} {app.created_by ? `• By ${app.created_by}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadgeClass(app.status)}`}>
                        {app.status}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => {
                            setAppToDelete(app);
                            setDeleteAppError(null);
                          }}
                          className="inline-flex items-center px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold transition"
                          title={app.status === 'DRAFT' ? 'Delete Draft Application' : 'Cancel Application'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
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
                        {formatLitres(app.calculated_litres || app.required_litres)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Rate at Application:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        ₹{Number(app.rate_snapshot?.rate_per_litre || 0.05).toFixed(2)}/L
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Review Status:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {app.status}
                      </div>
                    </div>
                  </div>

                  {app.remarks && (
                    <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 italic">
                      Remarks: &quot;{app.remarks}&quot;
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-4">
                <Droplet className="w-12 h-12 mx-auto text-sky-400 opacity-80" />
                <div>
                  <p className="font-bold text-slate-800 text-sm">No water applications registered</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Submit the farmer&apos;s crop water requirement to calculate baseline quotas and initiate the allotment approval workflow.
                  </p>
                </div>
                {(isAdmin || user?.role === 'FIELD_OFFICER') && (
                  <button
                    onClick={() => openAddWaterAppModal()}
                    className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Submit First Water Application
                  </button>
                )}
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
            {developmentBills?.length > 0 ? (
              developmentBills.map((bill: any) => (
                <div
                  key={bill.bill_id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        Bill #{bill.bill_number || bill.bill_id.slice(0, 8)}
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
                        {formatLitres(bill.approved_litres_snapshot ?? bill.approved_litres ?? 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Historical Rate:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        ₹{Number(bill.development_cost_per_litre_snapshot ?? bill.rate_applied_per_litre ?? 0).toFixed(2)}/L
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Total Development Cost:</span>
                      <div className="font-bold text-slate-900 text-sm mt-0.5">
                        {formatCurrency(bill.total_amount ?? bill.development_cost ?? 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Outstanding Balance:</span>
                      <div className="font-bold text-amber-700 text-sm mt-0.5">
                        {formatCurrency(bill.pending_amount ?? (parseFloat(bill.total_amount || bill.development_cost || '0') - parseFloat(bill.amount_paid || '0')))}
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
          {(developmentBills?.[0]?.installments?.length > 0 || b.developmentBills?.[0]?.installments?.length > 0) && (
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
                    {(developmentBills[0] || b.developmentBills[0]).installments.map((inst: any) => {
                      const getMilestoneLabel = (num: number) => {
                        switch (num) {
                          case 1:
                            return 'Stage 1: Application Approval & Allocation';
                          case 2:
                            return 'Stage 2: Infrastructure Pipeline Commencement';
                          case 3:
                            return 'Stage 3: Intermediate Pipeline Laying & Distribution';
                          case 4:
                            return 'Stage 4: Outlet Connection & Pressure Testing';
                          case 5:
                            return 'Stage 5: Final Commissioning & Supply Activation';
                          default:
                            return `Milestone Stage #${num}`;
                        }
                      };

                      return (
                        <tr key={inst.installment_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3.5 font-bold text-slate-900">
                            #{inst.installment_number}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-slate-800">
                            {inst.milestone_name || getMilestoneLabel(inst.installment_number)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono">
                            {inst.percentage}%
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-900">
                            {formatCurrency(inst.amount_due ?? inst.amount ?? 0)}
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
                                  const due = parseFloat(inst.amount_due || inst.amount || '0');
                                  const paid = parseFloat(inst.amount_paid || '0');
                                  setPaymentAmount(String(Math.max(0, due - paid)));
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
                      );
                    })}
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
                  {paymentsList?.length > 0 ? (
                    paymentsList.map((p: any) => (
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
            {infrastructuresList?.length > 0 ? (
              infrastructuresList.map((infra: any) => (
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
            {extensionsList?.length > 0 ? (
              extensionsList.map((ext: any) => (
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
                <label className="block font-bold text-slate-700 mb-1">
                  Project Scheme * <span className="text-[11px] text-slate-400 font-normal">(Select active scheme)</span>
                </label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">-- Select Project Scheme --</option>
                  {projects?.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} ({p.project_code}) {p.status === 'INACTIVE' ? ' - [Inactive]' : ''}
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

                {parcels.map((p, idx) => {
                  const sNorm = p.surveyNumber.trim().toUpperCase();
                  const subNorm = p.subdivisionNumber.trim().toUpperCase();
                  const isComplete = !!(sNorm && subNorm);

                  const isDup =
                    isComplete &&
                    parcels.some(
                      (other, oIdx) =>
                        oIdx !== idx &&
                        other.surveyNumber.trim().toUpperCase() === sNorm &&
                        other.subdivisionNumber.trim().toUpperCase() === subNorm,
                    );

                  const pKey = `add_${idx}`;
                  const avail = modalParcelAvailability[pKey];

                  const isInvalid = isDup || (avail && avail.available === false);
                  const isValid = !isDup && avail && avail.available === true && isComplete;

                  return (
                    <div key={idx} className="space-y-1">
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border ${
                          isInvalid
                            ? 'border-rose-400 bg-rose-50/40'
                            : isValid
                            ? 'border-emerald-400 bg-emerald-50/20'
                            : 'border-slate-200'
                        } items-center`}
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
                              checkModalParcelAvailability(pKey, e.target.value, p.subdivisionNumber);
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
                              checkModalParcelAvailability(pKey, p.surveyNumber, e.target.value);
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

                      {/* Visual Real-time Verification Badge */}
                      {isDup ? (
                        <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                          ✕ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is duplicated in this land holding.
                        </p>
                      ) : avail?.checking ? (
                        <p className="text-[11px] text-slate-500 px-2 flex items-center">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin text-slate-400 shrink-0" />
                          Checking parcel availability...
                        </p>
                      ) : avail && avail.available === false ? (
                        <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                          ✕ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is already registered in the system.
                        </p>
                      ) : isValid ? (
                        <p className="text-[11px] text-emerald-600 font-semibold px-2 flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500 shrink-0" />
                          ✓ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is available
                        </p>
                      ) : (sNorm || subNorm) ? (
                        <p className="text-[11px] text-slate-400 px-2">
                          Enter both Survey and Subdivision to verify availability.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
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

      {/* MODAL: EDIT LAND HOLDING */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showEditLandModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">Edit Land Holding & Parcels</h3>
              </div>
              <button onClick={() => setShowEditLandModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditLandSubmit} className="p-6 space-y-4 text-xs">
              {editLandError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editLandError}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Project Scheme *
                </label>
                <select
                  required
                  value={editLandProjectId}
                  onChange={(e) => setEditLandProjectId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                >
                  <option value="">-- Select Project Scheme --</option>
                  {projects?.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} ({p.project_code}) {p.status === 'INACTIVE' ? ' - [Inactive]' : ''}
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
                  value={editLandDeclaredArea}
                  onChange={(e) => setEditLandDeclaredArea(e.target.value)}
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
                      setEditLandParcels([...editLandParcels, { surveyNumber: '', subdivisionNumber: '', area: '' }])
                    }
                    className="text-sky-600 font-bold hover:underline flex items-center"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Parcel
                  </button>
                </div>

                {editLandParcels.map((p: any, idx) => {
                  const sNorm = p.surveyNumber.trim().toUpperCase();
                  const subNorm = p.subdivisionNumber.trim().toUpperCase();
                  const isComplete = !!(sNorm && subNorm);

                  const isDup =
                    isComplete &&
                    editLandParcels.some(
                      (other: any, oIdx) =>
                        oIdx !== idx &&
                        other.surveyNumber.trim().toUpperCase() === sNorm &&
                        other.subdivisionNumber.trim().toUpperCase() === subNorm,
                    );

                  const pKey = `edit_${idx}`;
                  const avail = modalParcelAvailability[pKey];

                  const isInvalid = isDup || (avail && avail.available === false);
                  const isValid = !isDup && avail && avail.available === true && isComplete;

                  return (
                    <div key={idx} className="space-y-1">
                      <div
                        className={`grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-slate-50 rounded-xl border ${
                          isInvalid
                            ? 'border-rose-400 bg-rose-50/40'
                            : isValid
                            ? 'border-emerald-400 bg-emerald-50/20'
                            : 'border-slate-200'
                        } items-center`}
                      >
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="Survey No (e.g. 101)"
                            value={p.surveyNumber}
                            onChange={(e) => {
                              const updated = [...editLandParcels];
                              updated[idx].surveyNumber = e.target.value;
                              setEditLandParcels(updated);
                              checkModalParcelAvailability(pKey, e.target.value, p.subdivisionNumber, p.parcel_id);
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <input
                            type="text"
                            placeholder="Subdivision (e.g. 1A)"
                            value={p.subdivisionNumber}
                            onChange={(e) => {
                              const updated = [...editLandParcels];
                              updated[idx].subdivisionNumber = e.target.value;
                              setEditLandParcels(updated);
                              checkModalParcelAvailability(pKey, p.surveyNumber, e.target.value, p.parcel_id);
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div className="sm:col-span-3">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Area (ac)"
                            value={p.area}
                            onChange={(e) => {
                              const updated = [...editLandParcels];
                              updated[idx].area = e.target.value;
                              setEditLandParcels(updated);
                            }}
                            className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => setEditLandParcels(editLandParcels.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700"
                            title="Remove parcel"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </div>
                      </div>

                      {/* Visual Real-time Verification Badge */}
                      {isDup ? (
                        <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                          ✕ Duplicate parcel: Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is already entered for this holding.
                        </p>
                      ) : avail?.checking ? (
                        <p className="text-[11px] text-slate-500 px-2 flex items-center">
                          <RefreshCw className="w-3 h-3 mr-1 animate-spin text-slate-400 shrink-0" />
                          Checking parcel availability...
                        </p>
                      ) : avail && avail.available === false ? (
                        <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                          ✕ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is already registered in the system.
                        </p>
                      ) : isValid ? (
                        <p className="text-[11px] text-emerald-600 font-semibold px-2 flex items-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500 shrink-0" />
                          ✓ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is available
                        </p>
                      ) : (sNorm || subNorm) ? (
                        <p className="text-[11px] text-slate-400 px-2">
                          Enter both Survey and Subdivision to verify availability.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditLandModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditLand}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {isSubmittingEditLand ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: ADD WATER APPLICATION */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showAddWaterAppModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center space-x-2">
                <Droplet className="w-5 h-5 text-sky-400" />
                <h3 className="font-bold text-base">New Water Application</h3>
              </div>
              <button onClick={() => setShowAddWaterAppModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddWaterAppSubmit} className="p-6 space-y-5 text-xs">
              {waterAppError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{waterAppError}</span>
                </div>
              )}

              {/* Beneficiary Summary Badge */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{b.name}</div>
                  <div className="text-slate-500 text-[11px] font-mono mt-0.5">
                    Phone: {b.phone_number} • Passbook: {b.passbook_number || 'N/A'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Verified Land</div>
                  <div className="text-emerald-700 font-extrabold text-sm">
                    {formatAcres(b.total_land_acres || totalLandAcres)}
                  </div>
                </div>
              </div>

              {/* Land Holding Selector (Core Rule: One Application per Land Holding) */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-700">
                  Select Eligible Land Holding * <span className="text-[11px] text-slate-500 font-normal">(Holdings with fulfilled or active water allocations are excluded)</span>
                </label>
                {isEligibleHoldingsLoading ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs flex items-center justify-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Verifying land holding quota eligibility...</span>
                  </div>
                ) : eligibleHoldings.length === 0 ? (
                  <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 text-center">
                    <div className="font-bold text-amber-900 text-xs flex items-center justify-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>No land holdings are currently eligible for a new water application.</span>
                    </div>
                    <p className="text-[11px] text-amber-800/90 leading-relaxed max-w-md mx-auto">
                      Existing approved or active water allocations must be completed, cancelled, or otherwise become eligible before a new application can be created.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {eligibleHoldings.map((lh: any, idx: number) => {
                      const isSelected = waterAppLandId === (lh.land_id || lh.holding_id);

                      return (
                        <div
                          key={lh.land_id || lh.holding_id || idx}
                          onClick={() => {
                            setWaterAppLandId(lh.land_id || lh.holding_id);
                            if (lh.project_id) {
                              setWaterAppProjectId(lh.project_id);
                            }
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-500/20 shadow-sm'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start space-x-2.5">
                            <input
                              type="radio"
                              name="selectedLandHolding"
                              checked={isSelected}
                              onChange={() => {
                                setWaterAppLandId(lh.land_id || lh.holding_id);
                                if (lh.project_id) {
                                  setWaterAppProjectId(lh.project_id);
                                }
                              }}
                              className="mt-0.5 text-sky-600 focus:ring-sky-500"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-xs">
                                Holding #{idx + 1} ({formatAcres(lh.declared_total_area)})
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                Parcels: {lh.parcels?.map((p: any) => `SF ${p.survey_number}/${p.subdivision_number}`).join(', ') || 'No parcels'}
                              </div>
                            </div>
                          </div>

                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Available for Application
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Project Scheme Selector */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Project Scheme * <span className="text-[11px] text-slate-400 font-normal">(Designated irrigation scheme)</span>
                </label>
                <select
                  required
                  value={waterAppProjectId}
                  onChange={(e) => setWaterAppProjectId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                >
                  <option value="">-- Select Project Scheme --</option>
                  {projects?.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} ({p.project_code}) {p.status === 'INACTIVE' ? ' - [Inactive]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 28 Live Calculation Preview */}
              {waterAppPreview && (
                <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-900 text-xs flex items-center space-x-1.5">
                      <Droplet className="w-3.5 h-3.5 text-sky-600" />
                      <span>Section 28 Tariff Quota Preview</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setWaterAppRequiredLitres(waterAppPreview.calculated_allotted_litres)}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 bg-sky-100/80 hover:bg-sky-200/80 px-2 py-0.5 rounded transition"
                    >
                      Use Calculated Quota &rarr;
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 uppercase">Active Land</div>
                      <div className="font-bold text-slate-800">{formatAcres(waterAppPreview.total_land_acres)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 uppercase">Tariff / Acre</div>
                      <div className="font-bold text-slate-800">{formatLitres(waterAppPreview.litres_per_acre)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 uppercase">Baseline Quota</div>
                      <div className="font-extrabold text-sky-700">{formatLitres(waterAppPreview.calculated_allotted_litres)}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-sky-100">
                      <div className="text-[10px] text-slate-400 uppercase">Dev Rate / L</div>
                      <div className="font-bold text-emerald-700">₹{Number(waterAppPreview.development_cost_per_litre).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Required Litres Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700">
                    Required Water Volume (Litres) *
                  </label>
                  {waterAppRequiredLitres && (
                    <span className="text-[11px] font-mono text-slate-500">
                      {formatLitres(waterAppRequiredLitres)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="1"
                  min="1"
                  required
                  placeholder="e.g. 50000"
                  value={waterAppRequiredLitres}
                  onChange={(e) => setWaterAppRequiredLitres(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Beneficiary requirement requested. Final quota is approved by administrators during review.
                </p>
              </div>

              {/* Cultivation / Season Remarks */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Remarks / Season Requirements <span className="text-[11px] text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Kharif crop pulses and irrigation across SF 101/1A"
                  value={waterAppRemarks}
                  onChange={(e) => setWaterAppRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddWaterAppModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingWaterApp}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {isSubmittingWaterApp ? 'Submitting Application...' : 'Submit Water Application'}
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
      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE / ARCHIVE LAND HOLDING */}
      {/* ──────────────────────────────────────────────────────────── */}
      {holdingToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">Delete Land Holding</h3>
              </div>
              <button onClick={() => setHoldingToDelete(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deleteHoldingError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Historical Deletion Protection</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{deleteHoldingError}</p>
                </div>
              ) : (() => {
                const landId = holdingToDelete.land_id || holdingToDelete.holding_id;
                const hasApps = waterApplications?.some((a: any) => a.land_id === landId);
                const isLinked = hasApps || (waterAllotments?.length > 0 && waterAllotments.some((al: any) => al.land_id === landId));

                if (isLinked) {
                  return (
                    <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl space-y-1.5">
                      <div className="font-bold flex items-center space-x-1">
                        <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Protected Historical Record</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        This land holding has linked historical water applications or quota records and cannot be permanently deleted.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-slate-700 font-medium">
                      Are you sure you want to permanently delete this land holding?
                    </p>
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="font-bold text-slate-900">
                        Holding #{holdingToDelete.land_id?.slice(0, 8) || holdingToDelete.holding_id?.slice(0, 8)} ({formatAcres(holdingToDelete.declared_total_area)})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Parcels: {holdingToDelete.parcels?.map((p: any) => `SF ${p.survey_number}/${p.subdivision_number}`).join(', ') || 'None'}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      This will permanently remove this land holding because it has no linked historical records.
                    </p>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setHoldingToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                {(() => {
                  const landId = holdingToDelete.land_id || holdingToDelete.holding_id;
                  const hasApps = waterApplications?.some((a: any) => a.land_id === landId);
                  const isLinked = hasApps || (waterAllotments?.length > 0 && waterAllotments.some((al: any) => al.land_id === landId));

                  if (isLinked) {
                    return (
                      <button
                        type="button"
                        onClick={() => setHoldingToDelete(null)}
                        className="px-5 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold transition"
                      >
                        Understood
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      disabled={isDeletingHolding}
                      onClick={handleDeleteHolding}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                    >
                      {isDeletingHolding ? 'Deleting...' : 'Delete Land Holding'}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: DELETE / CANCEL WATER APPLICATION */}
      {/* ──────────────────────────────────────────────────────────── */}
      {appToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden text-xs">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-base">
                  {appToDelete.status === 'DRAFT' ? 'Delete Draft Application' : 'Cancel Water Application'}
                </h3>
              </div>
              <button onClick={() => setAppToDelete(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {deleteAppError ? (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl space-y-1">
                  <div className="font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Protected Record</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">{deleteAppError}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-700 font-medium">
                    {appToDelete.status === 'DRAFT'
                      ? 'Permanently remove this draft water application?'
                      : 'Cancel this water application? This will release the land holding for a new quota application.'}
                  </p>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="font-bold text-slate-900">
                      Water Application #{appToDelete.application_id?.slice(0, 8)} ({appToDelete.status})
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Quota Request: {formatLitres(appToDelete.required_litres)} • Scheme: {appToDelete.project?.project_name || 'Kongu Scheme'}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAppToDelete(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isDeletingApp}
                  onClick={handleDeleteWaterApp}
                  className={`px-5 py-2 text-white rounded-xl font-bold shadow transition disabled:opacity-50 ${
                    appToDelete.status === 'DRAFT' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isDeletingApp
                    ? 'Processing...'
                    : appToDelete.status === 'DRAFT'
                    ? 'Delete Draft'
                    : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminBeneficiaryDetailManager() {
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
