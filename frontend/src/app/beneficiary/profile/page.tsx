'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  User,
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Save,
  Building,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export default function BeneficiaryProfilePage() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['beneficiary-me'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/me');
      return res.data;
    },
  });

  const b = profile?.beneficiary;
  const completion = profile?.completionPercent ?? 100;
  const checklist = profile?.checklist || [];

  const [formData, setFormData] = useState({
    districtId: '',
    panchayatId: '',
    villageId: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    pincode: '',
    locationDirection: 'NORTH',
    locationDescription: '',
  });

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync form state when profile data arrives
  useEffect(() => {
    if (b) {
      setFormData({
        districtId: b.district_id || '',
        panchayatId: b.panchayat_id || '',
        villageId: b.village_id || '',
        addressLine1: b.address_line_1 || '',
        addressLine2: b.address_line_2 || '',
        addressLine3: b.address_line_3 || '',
        pincode: b.pincode || '',
        locationDirection: b.location_direction || 'NORTH',
        locationDescription: b.location_description || '',
      });
    }
  }, [b]);

  // Fetch Districts
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data;
    },
  });

  // Fetch Panchayats when districtId changes
  const { data: panchayats } = useQuery({
    queryKey: ['panchayats', formData.districtId],
    queryFn: async () => {
      if (!formData.districtId) return [];
      const res = await apiClient.get(`/locations/panchayats?districtId=${formData.districtId}`);
      return res.data;
    },
    enabled: !!formData.districtId,
  });

  // Fetch Villages when panchayatId changes
  const { data: villages } = useQuery({
    queryKey: ['villages', formData.panchayatId],
    queryFn: async () => {
      if (!formData.panchayatId) return [];
      const res = await apiClient.get(`/locations/villages?panchayatId=${formData.panchayatId}`);
      return res.data;
    },
    enabled: !!formData.panchayatId,
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.patch('/beneficiary/me', payload);
      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg('Profile details successfully saved and verified!');
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['beneficiary-me'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-dashboard'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile. Please check your entries.');
      setSuccessMsg(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload: any = {
      addressLine1: formData.addressLine1 || undefined,
      addressLine2: formData.addressLine2 || undefined,
      addressLine3: formData.addressLine3 || undefined,
      districtId: formData.districtId || undefined,
      panchayatId: formData.panchayatId || undefined,
      villageId: formData.villageId || undefined,
      pincode: formData.pincode || undefined,
      locationDirection: formData.locationDirection,
      locationDescription: formData.locationDescription || undefined,
    };

    updateProfileMutation.mutate(payload);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beneficiary Profile &amp; Location Setup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Complete your administrative hierarchy and address details to register survey parcels and water quotas
        </p>
      </div>

      {/* Completion Status Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <span>Profile Readiness Score</span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                  completion === 100
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {completion}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              5 key milestones (20% each) must be verified before quota approvals.
            </p>
          </div>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              completion === 100 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${completion}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {checklist.map((item: any) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex items-start space-x-2.5 ${
                item.completed
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <CheckCircle2
                className={`w-4 h-4 mt-0.5 shrink-0 ${
                  item.completed ? 'text-emerald-600' : 'text-slate-400'
                }`}
              />
              <div className="text-xs">
                <div className="font-semibold">{item.label}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {item.completed ? 'Completed' : 'Pending'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 p-4 rounded-xl text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 p-4 rounded-xl text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Verified Identity (Read-only) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <User className="w-5 h-5 text-slate-600" />
            <h2 className="text-base font-bold text-slate-900">Personal Identity (Verified)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Full Legal Name</span>
              <div className="text-sm font-bold text-slate-800 mt-1">{b?.name || '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Mobile Phone</span>
              <div className="text-sm font-bold font-mono text-slate-800 mt-1">{b?.phone_number || '—'}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <span className="font-semibold text-slate-500 uppercase tracking-wider">Email Address</span>
              <div className="text-sm font-bold text-slate-800 mt-1 truncate">{b?.email || '—'}</div>
            </div>
          </div>
        </div>

        {/* Section 2: Administrative Revenue Hierarchy */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Revenue Jurisdiction (Cascading)</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* District */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                District *
              </label>
              <select
                required
                value={formData.districtId}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    districtId: e.target.value,
                    panchayatId: '',
                    villageId: '',
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              >
                <option value="">-- Select District --</option>
                {districts?.map((d: any) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Panchayat */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Panchayat / Block *
              </label>
              <select
                required
                disabled={!formData.districtId}
                value={formData.panchayatId}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    panchayatId: e.target.value,
                    villageId: '',
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Select Panchayat --</option>
                {panchayats?.map((p: any) => (
                  <option key={p.panchayat_id} value={p.panchayat_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Village */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Revenue Village *
              </label>
              <select
                required
                disabled={!formData.panchayatId}
                value={formData.villageId}
                onChange={(e) => setFormData({ ...formData, villageId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">-- Select Village --</option>
                {villages?.map((v: any) => (
                  <option key={v.village_id} value={v.village_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Physical Address & Location */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <MapPin className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Address &amp; Field Coordinates</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 1 (Door No, Street) *
              </label>
              <input
                type="text"
                required
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                placeholder="Door 4/12, Main Road"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 2 (Area / Locality)
              </label>
              <input
                type="text"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
                placeholder="Post Office Area"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 3 (Landmark)
              </label>
              <input
                type="text"
                value={formData.addressLine3}
                onChange={(e) => setFormData({ ...formData, addressLine3: e.target.value })}
                placeholder="Near Water Tank"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Postal PIN Code (6 Digits) *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="641604"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Geographic Direction / Orientation *
              </label>
              <div className="relative">
                <Compass className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  required
                  value={formData.locationDirection}
                  onChange={(e) => setFormData({ ...formData, locationDirection: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                >
                  <option value="NORTH">North (North Canal Zone)</option>
                  <option value="SOUTH">South (South Canal Zone)</option>
                  <option value="EAST">East (East Basin Zone)</option>
                  <option value="WEST">West (West Basin Zone)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Location Description / Landmark
              </label>
              <input
                type="text"
                value={formData.locationDescription}
                onChange={(e) => setFormData({ ...formData, locationDescription: e.target.value })}
                placeholder="e.g. 500m West of Main Canal Valve"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>All updates are cryptographically hashed and audit logged</span>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-amber-600/20 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{updateProfileMutation.isPending ? 'Saving Details...' : 'Save Profile Details'}</span>
            </button>
            <Link
              href="/beneficiary/land/new"
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition"
            >
              <span>Next: Add Land</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
