'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
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
  X,
  Trash2,
} from 'lucide-react';

function BeneficiaryDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Modals state
  const [showAddLandModal, setShowAddLandModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);

  // Beneficiary Dossier Query
  const { data: b, isLoading } = useQuery({
    queryKey: ['beneficiary', id],
    queryFn: async () => {
      const res = await apiClient.get(`/beneficiaries/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  // Projects Query (for adding land / applications)
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await apiClient.get('/projects');
      return res.data;
    },
  });

  // Active Rate for preview
  const { data: activeRate } = useQuery({
    queryKey: ['activeRate', projects?.[0]?.project_id],
    queryFn: async () => {
      if (!projects?.[0]?.project_id) return null;
      const res = await apiClient.get('/rates/active', {
        params: { projectId: projects[0].project_id },
      });
      return res.data;
    },
    enabled: !!projects?.[0]?.project_id,
  });

  // Add Land Form State
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [declaredTotalArea, setDeclaredTotalArea] = useState('');
  const [parcels, setParcels] = useState<Array<{ surveyNumber: string; subdivisionNumber: string; area: string }>>([
    { surveyNumber: '', subdivisionNumber: '', area: '' },
  ]);
  const [landFormError, setLandFormError] = useState<string | null>(null);

  // Add Parcel Row
  const addParcelRow = () => {
    setParcels([...parcels, { surveyNumber: '', subdivisionNumber: '', area: '' }]);
  };

  const removeParcelRow = (index: number) => {
    if (parcels.length > 1) {
      setParcels(parcels.filter((_, i) => i !== index));
    }
  };

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
      area: parseFloat(p.area),
    }));

    for (const p of parsedParcels) {
      if (!p.surveyNumber || !p.subdivisionNumber || isNaN(p.area) || p.area <= 0) {
        setLandFormError('All parcels must have a survey number, subdivision, and positive area');
        return;
      }
    }

    const sumAreas = parsedParcels.reduce((acc, p) => acc + p.area, 0);
    if (Math.abs(sumAreas - declared) > 0.0001) {
      setLandFormError(
        `Validation Failed: Sum of parcels (${sumAreas.toFixed(4)} acres) does not match declared total (${declared.toFixed(4)} acres).`,
      );
      return;
    }

    try {
      await apiClient.post('/land/holdings', {
        beneficiaryId: id,
        projectId: targetProject,
        declaredTotalArea: declared,
        parcels: parsedParcels,
      });

      queryClient.invalidateQueries({ queryKey: ['beneficiary', id] });
      setShowAddLandModal(false);
      setDeclaredTotalArea('');
      setParcels([{ surveyNumber: '', subdivisionNumber: '', area: '' }]);
    } catch (err: any) {
      setLandFormError(err.response?.data?.message || 'Failed to add land holding');
    }
  };

  // Record Payment Form State
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('UPI');
  const [payReference, setPayReference] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    try {
      await apiClient.post('/payments', {
        beneficiaryId: id,
        installmentId: selectedInstallmentId,
        amount: parseFloat(payAmount),
        paymentMode: payMode,
        paymentReference: payReference || undefined,
        remarks: payRemarks || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['beneficiary', id] });
      setShowPaymentModal(false);
      setPayAmount('');
      setPayReference('');
      setPayRemarks('');
      setSelectedInstallmentId(null);
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment');
    }
  };

  // Extension Form State
  const [extArea, setExtArea] = useState('');
  const [extLitres, setExtLitres] = useState('');
  const [extRemarks, setExtRemarks] = useState('');
  const [extensionError, setExtensionError] = useState<string | null>(null);

  const handleExtensionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtensionError(null);

    const allotment = b?.waterAllotments?.[0];
    if (!allotment) {
      setExtensionError('No active water allotment found to extend.');
      return;
    }

    try {
      await apiClient.post('/extensions', {
        beneficiaryId: id,
        originalAllotmentId: allotment.allotment_id,
        requestedAdditionalArea: parseFloat(extArea),
        requestedAdditionalLitres: parseFloat(extLitres),
        remarks: extRemarks || undefined,
      });

      queryClient.invalidateQueries({ queryKey: ['beneficiary', id] });
      setShowExtensionModal(false);
      setExtArea('');
      setExtLitres('');
      setExtRemarks('');
    } catch (err: any) {
      setExtensionError(err.response?.data?.message || 'Failed to submit extension request');
    }
  };

  // Infrastructure Status Update Mutation
  const updateInfraStatus = useMutation({
    mutationFn: async ({ infraId, status }: { infraId: string; status: string }) => {
      await apiClient.patch(`/infrastructure/${infraId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary', id] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure-list'] });
      queryClient.invalidateQueries({ queryKey: ['infrastructure-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-infrastructure'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-running-bills'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!b) {
    return (
      <div className="p-8 text-center text-slate-500">
        Beneficiary record not found.
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'land', label: `Land (${b.landHoldings?.length || 0})`, icon: Layers },
    { id: 'water', label: `Water (${b.waterApplications?.length || 0})`, icon: Droplet },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'payments', label: `Payments (${b.payments?.length || 0})`, icon: CreditCard },
    { id: 'infrastructure', label: 'Infrastructure', icon: Building2 },
    { id: 'extensions', label: `Extensions (${b.extensions?.length || 0})`, icon: ArrowUpRight },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'history', label: `History (${b.history?.length || 0})`, icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Beneficiary Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start space-x-4">
          <div className="w-14 h-14 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0">
            {b.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">{b.name}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getStatusBadgeClass(b.status)}`}>
                {b.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center space-x-1 font-mono">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{b.phone_number}</span>
              </span>
              <span className="flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{b.village?.name}, {b.panchayat?.name}, {b.district?.name} ({b.pincode})</span>
              </span>
              <span className="flex items-center space-x-1">
                <Compass className="w-3.5 h-3.5 text-slate-400" />
                <span>Facing: {b.location_direction}</span>
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-1">
              UUID: {b.beneficiary_id}
            </div>
          </div>
        </div>

        {/* Quick Summary Badge */}
        <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
          <div>
            <div className="text-slate-400">Total Land</div>
            <div className="text-base font-bold text-emerald-700">{formatAcres(b.total_land_acres)}</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="text-slate-400">Approved Litres</div>
            <div className="text-base font-bold text-blue-700">
              {b.waterAllotments?.[0] ? formatLitres(b.waterAllotments[0].approved_litres) : 'None'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 flex space-x-2 overflow-x-auto shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-3 text-xs font-semibold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Farmer Demographics & Contact
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Full Legal Name:</span>
                <div className="font-semibold text-slate-800 text-sm mt-0.5">{b.name}</div>
              </div>
              <div>
                <span className="text-slate-400">Primary Phone:</span>
                <div className="font-semibold text-slate-800 text-sm mt-0.5 font-mono">{b.phone_number}</div>
              </div>
              <div>
                <span className="text-slate-400">District:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.district?.name}</div>
              </div>
              <div>
                <span className="text-slate-400">Panchayat:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.panchayat?.name}</div>
              </div>
              <div>
                <span className="text-slate-400">Village:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.village?.name}</div>
              </div>
              <div>
                <span className="text-slate-400">Postal Code:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.pincode}</div>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">Street Address:</span>
                <div className="font-medium text-slate-800 mt-0.5">
                  {[b.address_line_1, b.address_line_2, b.address_line_3].filter(Boolean).join(', ')}
                </div>
              </div>
              <div>
                <span className="text-slate-400">Location Direction:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.location_direction}</div>
              </div>
              <div>
                <span className="text-slate-400">Location Notes:</span>
                <div className="font-medium text-slate-800 mt-0.5">{b.location_description || 'None provided'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider pb-2 border-b border-slate-100">
              Operational Water Dossier Summary
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Total Land Area (Calculated):</span>
                <span className="font-bold text-emerald-700 text-sm">{formatAcres(b.total_land_acres)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Active Land Holdings:</span>
                <span className="font-semibold text-slate-800">{b.landHoldings?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Water Allotment Status:</span>
                <span className="font-semibold text-slate-800">
                  {b.waterAllotments?.[0]?.approval_status || 'Pending Application'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Approved Litres:</span>
                <span className="font-bold text-blue-700">
                  {b.waterAllotments?.[0] ? formatLitres(b.waterAllotments[0].approved_litres) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Infrastructure State:</span>
                <span className="font-semibold text-purple-700">
                  {b.infrastructures?.[0]?.status || 'Not Initialized'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LAND HOLDINGS & SF PARCELS */}
      {activeTab === 'land' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Land Holdings & SF Subdivision Parcels</h3>
              <p className="text-xs text-slate-500">
                Sum of parcels must match declared total area. Total beneficiary land is computed across all active holdings.
              </p>
            </div>
            <button
              onClick={() => setShowAddLandModal(true)}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Land Holding</span>
            </button>
          </div>

          {/* Holdings Cards */}
          {b.landHoldings && b.landHoldings.length > 0 ? (
            b.landHoldings.map((holding: any, index: number) => (
              <div key={holding.land_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                      #{index + 1}
                    </span>
                    <span className="font-bold text-slate-800 text-sm">
                      Holding ID: {holding.land_id.slice(0, 8)}...
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClass(holding.status)}`}>
                      {holding.status}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-slate-500 mr-2">Project: {holding.project?.project_name}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      Declared Area: {formatAcres(holding.declared_total_area)}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    SF / Subdivision Parcels Breakdown
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Survey Number (SF)</th>
                          <th className="px-3 py-2">Subdivision Number</th>
                          <th className="px-3 py-2">Area</th>
                          <th className="px-3 py-2">Unit</th>
                          <th className="px-3 py-2">Recorded At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {holding.parcels?.map((parcel: any) => (
                          <tr key={parcel.parcel_id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-bold text-slate-800">{parcel.survey_number}</td>
                            <td className="px-3 py-2.5 font-mono text-slate-700">{parcel.subdivision_number}</td>
                            <td className="px-3 py-2.5 font-semibold text-emerald-700">
                              {Number(parcel.area).toFixed(4)}
                            </td>
                            <td className="px-3 py-2.5 text-slate-500">{parcel.area_unit}</td>
                            <td className="px-3 py-2.5 text-slate-400">{formatDate(parcel.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
              No land holdings registered yet. Click &ldquo;Add Land Holding&rdquo; to begin survey registration.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WATER APPLICATIONS & ALLOTMENT */}
      {activeTab === 'water' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Water Applications & Allotment Quotas</h3>
              <p className="text-xs text-slate-500">
                Required litres (farmer request), Calculated allotment (land &times; rate), and Approved litres (Admin decision)
              </p>
            </div>
            <Link
              href={`/water/applications/new?beneficiaryId=${id}`}
              className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Water Application</span>
            </Link>
          </div>

          {/* Rate and Land Calculation Display Card (Section 28 in spec) */}
          <div className="bg-sky-50 border border-sky-200 p-5 rounded-xl">
            <h4 className="text-xs font-bold text-sky-900 uppercase tracking-wider mb-3">
              Official Allotment Calculation Framework
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-sky-100 shadow-sm">
                <span className="text-slate-500">Total Verified Land</span>
                <div className="text-base font-bold text-slate-900 mt-0.5">{formatAcres(b.total_land_acres)}</div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-sky-100 shadow-sm">
                <span className="text-slate-500">Active Tariff (Litres/Acre)</span>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {activeRate ? formatLitres(activeRate.litres_per_acre) : '10,000 L'} / acre
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-sky-100 shadow-sm">
                <span className="text-slate-500">Calculated Allotment</span>
                <div className="text-base font-bold text-sky-700 mt-0.5">
                  {formatLitres(parseFloat(b.total_land_acres || '0') * (activeRate ? parseFloat(activeRate.litres_per_acre) : 10000))}
                </div>
              </div>
              <div className="p-3 bg-white rounded-lg border border-sky-100 shadow-sm">
                <span className="text-slate-500">Development Cost Rate</span>
                <div className="text-base font-bold text-emerald-700 mt-0.5">
                  ₹{activeRate ? Number(activeRate.development_cost_per_litre).toFixed(2) : '2.00'} / L
                </div>
              </div>
            </div>
          </div>

          {/* Allotment Records */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 font-bold text-sm text-slate-900">
              Submitted Applications History
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Required Litres (Farmer)</th>
                    <th className="px-4 py-3">Calculated Allotment</th>
                    <th className="px-4 py-3">Approved Litres</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.waterApplications?.length > 0 ? (
                    b.waterApplications.map((app: any) => (
                      <tr key={app.application_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono">{formatDate(app.application_date)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">
                          {formatLitres(app.required_litres)}
                        </td>
                        <td className="px-4 py-3 text-sky-700 font-semibold">
                          {app.allotment ? formatLitres(app.allotment.calculated_allotted_litres) : '—'}
                        </td>
                        <td className="px-4 py-3 text-blue-700 font-bold">
                          {app.allotment ? formatLitres(app.allotment.approved_litres) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClass(app.status)}`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {app.status === 'SUBMITTED' && user?.role === 'ADMIN' && (
                            <Link
                              href="/water/approvals"
                              className="px-3 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded font-semibold transition"
                            >
                              Approve
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No water applications on file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: BILLING & INSTALLMENTS */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Development Bills & 5 Installments</h3>
              <p className="text-xs text-slate-500">
                Five-stage installment schedule snapshot. Installment 1 = 2.5%, remaining sum to 100%.
              </p>
            </div>
          </div>

          {b.developmentBills && b.developmentBills.length > 0 ? (
            b.developmentBills.map((bill: any) => (
              <div key={bill.bill_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">Development Bill</span>
                    <span className="text-xs text-slate-400 font-mono ml-2">ID: {bill.bill_id.slice(0, 8)}...</span>
                  </div>
                  <div className="flex items-center space-x-4 text-xs">
                    <div>
                      <span className="text-slate-400">Total Due:</span>{' '}
                      <span className="font-bold text-slate-900">{formatCurrency(bill.total_amount)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Paid:</span>{' '}
                      <span className="font-bold text-emerald-700">{formatCurrency(bill.amount_paid)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Pending:</span>{' '}
                      <span className="font-bold text-rose-600">{formatCurrency(bill.pending_amount)}</span>
                    </div>
                    <span className={`px-2 py-0.5 font-semibold rounded border ${getStatusBadgeClass(bill.status)}`}>
                      {bill.status}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    5-Stage Installments Breakdown
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                        <tr>
                          <th className="px-3 py-2">Stage</th>
                          <th className="px-3 py-2">Share (%)</th>
                          <th className="px-3 py-2">Due Date</th>
                          <th className="px-3 py-2">Amount Due</th>
                          <th className="px-3 py-2">Paid</th>
                          <th className="px-3 py-2">Pending</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2 text-right">Pay Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bill.installments?.map((inst: any) => (
                          <tr key={inst.installment_id} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5 font-bold text-slate-800">
                              Installment {inst.installment_number}
                            </td>
                            <td className="px-3 py-2.5 font-semibold text-slate-600">{inst.percentage}%</td>
                            <td className="px-3 py-2.5 font-mono text-slate-600">{formatDate(inst.due_date)}</td>
                            <td className="px-3 py-2.5 font-semibold text-slate-900">{formatCurrency(inst.amount_due)}</td>
                            <td className="px-3 py-2.5 text-emerald-700 font-semibold">{formatCurrency(inst.amount_paid)}</td>
                            <td className="px-3 py-2.5 text-rose-600 font-bold">{formatCurrency(inst.pending_amount)}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getStatusBadgeClass(inst.status)}`}>
                                {inst.status}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {Number(inst.pending_amount) > 0 && (user?.role === 'ACCOUNTS' || user?.role === 'ADMIN') && (
                                <button
                                  onClick={() => {
                                    setSelectedInstallmentId(inst.installment_id);
                                    setPayAmount(inst.pending_amount);
                                    setShowPaymentModal(true);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition text-[11px]"
                                >
                                  Pay ₹
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
              No development bills issued yet. Billing is automatically generated when water application is approved.
            </div>
          )}

          {/* Running Bills Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Recurring Running Charges Bills</h4>
                <p className="text-xs text-slate-500">Maintenance charges generated after infrastructure commissioning</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Period</th>
                    <th className="px-4 py-2.5">Approved Litres</th>
                    <th className="px-4 py-2.5">Rate / L</th>
                    <th className="px-4 py-2.5">Amount Due</th>
                    <th className="px-4 py-2.5">Paid</th>
                    <th className="px-4 py-2.5">Pending</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.runningBills && b.runningBills.length > 0 ? (
                    b.runningBills.map((rb: any) => (
                      <tr key={rb.running_bill_id}>
                        <td className="px-4 py-3 font-semibold">{rb.billing_period}</td>
                        <td className="px-4 py-3">{formatLitres(rb.approved_litres_snapshot)}</td>
                        <td className="px-4 py-3">₹{Number(rb.running_cost_per_litre_snapshot).toFixed(2)}</td>
                        <td className="px-4 py-3 font-bold">{formatCurrency(rb.amount_due)}</td>
                        <td className="px-4 py-3 text-emerald-700">{formatCurrency(rb.amount_paid)}</td>
                        <td className="px-4 py-3 text-rose-600 font-bold">{formatCurrency(rb.pending_amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getStatusBadgeClass(rb.status)}`}>
                            {rb.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                        No running charges billed yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PAYMENTS LEDGER */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Payments Ledger</h3>
              <p className="text-xs text-slate-500">Immutable transaction log with unique system receipts</p>
            </div>
            {(user?.role === 'ACCOUNTS' || user?.role === 'ADMIN') && (
              <button
                onClick={() => {
                  setSelectedInstallmentId(null);
                  setPayAmount('');
                  setShowPaymentModal(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Record Payment</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Receipt No</th>
                    <th className="px-4 py-3">Payment Date</th>
                    <th className="px-4 py-3">Mode</th>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Recorded By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.payments && b.payments.length > 0 ? (
                    b.payments.map((p: any) => (
                      <tr key={p.payment_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-sky-700">{p.receipt_number}</td>
                        <td className="px-4 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{p.payment_mode}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{p.payment_reference || '—'}</td>
                        <td className="px-4 py-3 font-bold text-emerald-700 text-sm">
                          {formatCurrency(p.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getStatusBadgeClass(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{p.recorded_by}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                        No payments recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: INFRASTRUCTURE */}
      {activeTab === 'infrastructure' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Infrastructure Execution & Commissioning</h3>
              <p className="text-xs text-slate-500">
                Pipeline execution lifecycle. Running charges cannot be generated until status is COMMISSIONED.
              </p>
            </div>
          </div>

          {(() => {
            const list = (b.infrastructures && b.infrastructures.length > 0)
              ? b.infrastructures
              : (b.waterAllotments?.map((a: any) => a.infrastructure).filter(Boolean) || []);
            const canManageInfra = ['ADMIN', 'FIELD_OFFICER', 'ACCOUNTS'].includes(user?.role || '');

            if (list.length === 0) {
              return (
                <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
                  Infrastructure lifecycle record will be initialized upon water application approval.
                </div>
              );
            }

            return list.map((infra: any) => (
              <div key={infra.infrastructure_id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-slate-900">Canal Grid Distribution Network</h4>
                      <p className="text-xs text-slate-500">Infrastructure ID: {infra.infrastructure_id}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 font-bold text-xs rounded-full border ${getStatusBadgeClass(infra.status)}`}>
                    {infra.status}
                  </span>
                </div>

                {/* Lifecycle Milestones Progression */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold">1. Planned</span>
                    <div className="font-semibold text-slate-800 mt-1">{formatDate(infra.planned_date)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">2. Construction Start</span>
                    <div className="font-semibold text-slate-800 mt-1">{formatDate(infra.construction_start_date)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">3. Completed</span>
                    <div className="font-semibold text-slate-800 mt-1">{formatDate(infra.completion_date)}</div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold">4. Commissioned</span>
                    <div className="font-bold text-emerald-700 mt-1">{formatDate(infra.commissioned_date)}</div>
                  </div>
                </div>

                {/* Operations Status Transitions */}
                {canManageInfra && (
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">Operations Transitions:</span>
                    {infra.status === 'PLANNED' && (
                      <button
                        onClick={() =>
                          updateInfraStatus.mutate({ infraId: infra.infrastructure_id, status: 'UNDER_CONSTRUCTION' })
                        }
                        disabled={updateInfraStatus.isPending}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                      >
                        Start Construction &rarr;
                      </button>
                    )}
                    {infra.status === 'UNDER_CONSTRUCTION' && (
                      <button
                        onClick={() =>
                          updateInfraStatus.mutate({ infraId: infra.infrastructure_id, status: 'COMPLETED' })
                        }
                        disabled={updateInfraStatus.isPending}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                      >
                        Mark Completed &rarr;
                      </button>
                    )}
                    {infra.status === 'COMPLETED' && (
                      <button
                        onClick={() =>
                          updateInfraStatus.mutate({ infraId: infra.infrastructure_id, status: 'COMMISSIONED' })
                        }
                        disabled={updateInfraStatus.isPending}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold transition disabled:opacity-50"
                      >
                        Commission Grid (Enables Running Bills) &rarr;
                      </button>
                    )}
                    {infra.status === 'COMMISSIONED' && (
                      <span className="text-xs text-emerald-700 font-bold flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Fully Commissioned & Running
                      </span>
                    )}
                  </div>
                )}
              </div>
            ));
          })()}
        </div>
      )}

      {/* TAB 7: EXTENSIONS */}
      {activeTab === 'extensions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Land & Water Extensions</h3>
              <p className="text-xs text-slate-500">
                Independent extension transactions. Approving an extension NEVER mutates the original historical allotment.
              </p>
            </div>
            {b.waterAllotments?.length > 0 && (
              <button
                onClick={() => setShowExtensionModal(true)}
                className="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Request Extension</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Requested Date</th>
                    <th className="px-4 py-3">Requested Additional</th>
                    <th className="px-4 py-3">Approved Additional</th>
                    <th className="px-4 py-3">Extension Cost</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.extensions && b.extensions.length > 0 ? (
                    b.extensions.map((ext: any) => (
                      <tr key={ext.extension_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono">{formatDate(ext.requested_at)}</td>
                        <td className="px-4 py-3">
                          <div>{formatAcres(ext.requested_additional_area)}</div>
                          <div className="text-slate-400 font-semibold">{formatLitres(ext.requested_additional_litres)}</div>
                        </td>
                        <td className="px-4 py-3">
                          {ext.approved_additional_area ? (
                            <>
                              <div className="font-semibold text-emerald-700">{formatAcres(ext.approved_additional_area)}</div>
                              <div className="text-blue-700 font-bold">{formatLitres(ext.approved_additional_litres)}</div>
                            </>
                          ) : (
                            'Pending'
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {ext.extension_cost ? formatCurrency(ext.extension_cost) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${getStatusBadgeClass(ext.status)}`}>
                            {ext.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{ext.approved_by || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                        No extension requests on file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: DOCUMENTS */}
      {activeTab === 'documents' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Legal Documents & Land Records Dossier</h3>
          <p className="text-xs text-slate-500">
            Document records verifying ownership, patta passbook, and water usage NOC.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-sky-600" />
                <div>
                  <div className="font-bold text-slate-800">Patta & Chitta Land Record</div>
                  <div className="text-slate-400">Verified by Revenue Department</div>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                Verified
              </span>
            </div>

            <div className="p-4 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3">
                <FileText className="w-5 h-5 text-sky-600" />
                <div>
                  <div className="font-bold text-slate-800">Water Allocation Application Agreement</div>
                  <div className="text-slate-400">Signed with terms of 5-stage payment</div>
                </div>
              </div>
              <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                Archived
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 9: HISTORY & AUDIT LOG */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Complete Historical Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Immutable PostgreSQL audit log of all creations, approvals, rate snapshots, payments, and state transitions
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Entity Type</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {b.history && b.history.length > 0 ? (
                    b.history.map((log: any) => (
                      <tr key={log.audit_id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getStatusBadgeClass(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{log.entity_type}</td>
                        <td className="px-4 py-3 text-slate-600">{log.user?.email || 'System'}</td>
                        <td className="px-4 py-3 text-slate-600 max-w-md truncate">{log.reason || '—'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                        No audit events recorded for this beneficiary.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD LAND HOLDING WITH PARCELS */}
      {showAddLandModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Add Land Holding & SF Parcels</h3>
              <button onClick={() => setShowAddLandModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {landFormError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {landFormError}
              </div>
            )}

            <form onSubmit={handleAddLandSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Project *</label>
                <select
                  value={selectedProjectId || projects?.[0]?.project_id || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  {projects?.map((p: any) => (
                    <option key={p.project_id} value={p.project_id}>
                      {p.project_name} ({p.project_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Declared Total Area (Acres) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 5.0000"
                  value={declaredTotalArea}
                  onChange={(e) => setDeclaredTotalArea(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700 uppercase">
                    SF / Subdivision Parcels (Sum must equal Declared Area) *
                  </label>
                  <button
                    type="button"
                    onClick={addParcelRow}
                    className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    + Add Parcel
                  </button>
                </div>

                <div className="space-y-2">
                  {parcels.map((parcel, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Survey No (e.g. 101)"
                        required
                        value={parcel.surveyNumber}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].surveyNumber = e.target.value;
                          setParcels(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Subdivision (e.g. 1A)"
                        required
                        value={parcel.subdivisionNumber}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].subdivisionNumber = e.target.value;
                          setParcels(updated);
                        }}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="Area (Acres)"
                        required
                        value={parcel.area}
                        onChange={(e) => {
                          const updated = [...parcels];
                          updated[idx].area = e.target.value;
                          setParcels(updated);
                        }}
                        className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                      />
                      {parcels.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeParcelRow(idx)}
                          className="p-2 text-rose-500 hover:text-rose-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-xs flex justify-between border border-slate-200">
                <span className="text-slate-500">Sum of Parcels:</span>
                <span className="font-bold text-slate-800">
                  {parcels.reduce((acc, p) => acc + (parseFloat(p.area) || 0), 0).toFixed(4)} Acres
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddLandModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  Save Land Holding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD PAYMENT */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Record Payment Transaction</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {paymentError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Amount in INR *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 1400.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Payment Mode *
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="UPI">UPI (GPay / PhonePe / BHIM)</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="CASH">Cash Deposit</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="DD">Demand Draft</option>
                  <option value="ONLINE">Online Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Payment Reference / UTR No
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI/123456789 or Cheque 0045"
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Installment settlement"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
                >
                  Generate Receipt & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REQUEST EXTENSION */}
      {showExtensionModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Request Water / Land Extension</h3>
              <button onClick={() => setShowExtensionModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {extensionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs">
                {extensionError}
              </div>
            )}

            <form onSubmit={handleExtensionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Requested Additional Land (Acres) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  placeholder="e.g. 1.5000"
                  value={extArea}
                  onChange={(e) => setExtArea(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Requested Additional Litres *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={extLitres}
                  onChange={(e) => setExtLitres(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Reason / Cultivation Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acquisition of adjacent patta land"
                  value={extRemarks}
                  onChange={(e) => setExtRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowExtensionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
                >
                  Submit Extension Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BeneficiaryDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500">
          Loading beneficiary details...
        </div>
      }
    >
      <BeneficiaryDetailPageContent />
    </Suspense>
  );
}
