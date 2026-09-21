'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Phone, Search, UserCheck, AlertCircle, ArrowRight, PlusCircle, FileText } from 'lucide-react';
import Link from 'next/link';
import { formatAcres } from '@/lib/utils';

export default function NewBeneficiaryPage() {
  const router = useRouter();

  // Step 1: Phone Lookup State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  // Form State for new beneficiary
  const [name, setName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressLine3, setAddressLine3] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [panchayatId, setPanchayatId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [pincode, setPincode] = useState('642001');
  const [locationDirection, setLocationDirection] = useState('NORTH');
  const [locationDescription, setLocationDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch geographic hierarchy for dropdowns
  const { data: districts } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data;
    },
  });

  const { data: panchayats } = useQuery({
    queryKey: ['panchayats', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const res = await apiClient.get('/locations/panchayats', { params: { districtId } });
      return res.data;
    },
    enabled: !!districtId,
  });

  const { data: villages } = useQuery({
    queryKey: ['villages', panchayatId],
    queryFn: async () => {
      if (!panchayatId) return [];
      const res = await apiClient.get('/locations/villages', { params: { panchayatId } });
      return res.data;
    },
    enabled: !!panchayatId,
  });

  const handlePhoneLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const res = await apiClient.get('/beneficiaries/lookup', {
        params: { phone: phoneNumber.trim() },
      });
      setLookupResult(res.data);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error looking up phone number');
    } finally {
      setSearching(false);
    }
  };

  const handleCreateBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await apiClient.post('/beneficiaries', {
        name,
        phoneNumber: phoneNumber.trim(),
        addressLine1,
        addressLine2: addressLine2 || undefined,
        addressLine3: addressLine3 || undefined,
        districtId,
        panchayatId,
        villageId,
        pincode,
        locationDirection,
        locationDescription: locationDescription || undefined,
      });

      router.push(`/beneficiaries/${res.data.beneficiary_id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register beneficiary');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Beneficiary Onboarding</h1>
        <p className="text-sm text-slate-500 mt-1">
          Two-step verification workflow: Phone lookup prevents duplicate records before onboarding
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Phone Lookup Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Step 1: Phone Number Lookup</h2>
            <p className="text-xs text-slate-500">Check if farmer is already registered in the registry</p>
          </div>
        </div>

        <form onSubmit={handlePhoneLookup} className="flex gap-3">
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              required
              placeholder="Enter 10-digit mobile number (e.g. 9876543210)"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setHasSearched(false);
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition flex items-center space-x-2 shrink-0 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>{searching ? 'Searching...' : 'Lookup Phone'}</span>
          </button>
        </form>
      </div>

      {/* Case A: Existing Beneficiary Found! */}
      {hasSearched && lookupResult?.found && (
        <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                  Existing Beneficiary Found
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {lookupResult.beneficiary.name}
                </h3>
                <p className="text-xs text-slate-600 font-mono">
                  Permanent UUID: {lookupResult.beneficiary.beneficiary_id}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/80 p-4 rounded-lg text-xs border border-emerald-100">
            <div>
              <span className="text-slate-400">Phone:</span>
              <div className="font-semibold text-slate-800">{lookupResult.beneficiary.phone_number}</div>
            </div>
            <div>
              <span className="text-slate-400">Location:</span>
              <div className="font-semibold text-slate-800">
                {lookupResult.beneficiary.village?.name}, {lookupResult.beneficiary.district?.name}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Total Active Land:</span>
              <div className="font-semibold text-emerald-700">
                {formatAcres(lookupResult.beneficiary.total_land_acres)}
              </div>
            </div>
            <div>
              <span className="text-slate-400">Active Land Holdings:</span>
              <div className="font-semibold text-slate-800">
                {lookupResult.beneficiary.landHoldings?.length || 0} Holdings
              </div>
            </div>
            <div>
              <span className="text-slate-400">Water Applications:</span>
              <div className="font-semibold text-slate-800">
                {lookupResult.beneficiary.waterApplications?.length || 0} Applications
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200/60">
            <p className="text-xs text-emerald-800 font-medium mb-3">
              This beneficiary is already registered. To avoid duplication, choose an action below:
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/beneficiaries/${lookupResult.beneficiary.beneficiary_id}`}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg transition inline-flex items-center space-x-1"
              >
                <span>View Full Dossier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href={`/beneficiaries/${lookupResult.beneficiary.beneficiary_id}?tab=land`}
                className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-lg transition inline-flex items-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add New Land Holding</span>
              </Link>
              <Link
                href={`/water/applications/new?beneficiaryId=${lookupResult.beneficiary.beneficiary_id}`}
                className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold rounded-lg transition inline-flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Create Water Application</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Case B: New Beneficiary Registration Form */}
      {hasSearched && !lookupResult?.found && (
        <form onSubmit={handleCreateBeneficiary} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Step 2: Beneficiary Profile Registration</h2>
              <p className="text-xs text-slate-500">
                Phone number <span className="font-mono font-semibold text-slate-800">{phoneNumber}</span> is not registered. Complete farmer details below.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. K. Ramasamy Gounder"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                District *
              </label>
              <select
                required
                value={districtId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setPanchayatId('');
                  setVillageId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
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
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Panchayat *
              </label>
              <select
                required
                disabled={!districtId}
                value={panchayatId}
                onChange={(e) => {
                  setPanchayatId(e.target.value);
                  setVillageId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white disabled:opacity-50"
              >
                <option value="">Select Panchayat</option>
                {panchayats?.map((p: any) => (
                  <option key={p.panchayat_id} value={p.panchayat_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Village *
              </label>
              <select
                required
                disabled={!panchayatId}
                value={villageId}
                onChange={(e) => setVillageId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white disabled:opacity-50"
              >
                <option value="">Select Village</option>
                {villages?.map((v: any) => (
                  <option key={v.village_id} value={v.village_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Pincode *
              </label>
              <input
                type="text"
                required
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="642001"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 1 (Street / Landmark) *
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Door No, Street Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Location Direction *
              </label>
              <select
                value={locationDirection}
                onChange={(e) => setLocationDirection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none bg-white"
              >
                <option value="NORTH">NORTH</option>
                <option value="SOUTH">SOUTH</option>
                <option value="EAST">EAST</option>
                <option value="WEST">WEST</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Location Description
              </label>
              <input
                type="text"
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="e.g. Near main canal feeder sluice"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? 'Creating Profile...' : 'Complete Registration & Proceed'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
