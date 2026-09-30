'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Phone,
  Search,
  UserCheck,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  PlusCircle,
  FileText,
  CheckCircle2,
  Layers,
  Droplet,
  Trash2,
  Plus,
  Info,
  AlertTriangle,
  User,
  MapPin,
  Check,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { formatAcres, formatLitres } from '@/lib/utils';

interface OnboardingParcel {
  surveyNumber: string;
  subdivisionNumber: string;
  area: string;
}

interface OnboardingHolding {
  projectId: string;
  declaredTotalArea: string;
  parcels: OnboardingParcel[];
}

interface OnboardingWaterApp {
  enabled: boolean;
  requiredLitres: string;
  remarks: string;
}

export default function NewBeneficiaryPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Wizard Step: 1 = Phone Lookup, 2 = Identity & Location, 3 = Land Holdings & Parcels, 4 = Water Applications, 5 = Review & Submit
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Step 1: Phone Lookup State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);

  // Step 2: Beneficiary Details & Location State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [addressLine3, setAddressLine3] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [pincode, setPincode] = useState('642001');
  const [locationDirection, setLocationDirection] = useState('NORTH');
  const [locationDescription, setLocationDescription] = useState('');

  // Step 3: Land Holdings & Parcels State
  const [holdings, setHoldings] = useState<OnboardingHolding[]>([
    {
      projectId: '',
      declaredTotalArea: '',
      parcels: [{ surveyNumber: '', subdivisionNumber: '', area: '' }],
    },
  ]);

  // Real-time Parcel Availability Cache: key = `${hIdx}_${pIdx}`
  const [parcelAvailability, setParcelAvailability] = useState<{
    [key: string]: { checking: boolean; available?: boolean; message?: string; owner?: string };
  }>({});

  // Debounce ref for availability checks
  const availabilityTimers = React.useRef<{ [key: string]: NodeJS.Timeout }>({});

  const checkAvailability = (key: string, survey: string, sub: string) => {
    const sTrim = survey.trim();
    const subTrim = sub.trim();
    if (!sTrim || !subTrim) {
      setParcelAvailability((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    if (availabilityTimers.current[key]) {
      clearTimeout(availabilityTimers.current[key]);
    }

    setParcelAvailability((prev) => ({
      ...prev,
      [key]: { checking: true },
    }));

    availabilityTimers.current[key] = setTimeout(async () => {
      try {
        const res = await apiClient.post('/land/parcels/check-availability', {
          surveyNumber: sTrim,
          subdivisionNumber: subTrim,
        });
        setParcelAvailability((prev) => ({
          ...prev,
          [key]: {
            checking: false,
            available: res.data.available,
            message: res.data.message,
            owner: res.data.existingOwner,
          },
        }));
      } catch (err: any) {
        setParcelAvailability((prev) => ({
          ...prev,
          [key]: { checking: false, available: false, message: 'Failed to verify parcel' },
        }));
      }
    }, 300);
  };

  // Step 4: Water Quota Applications State (indexed by holding)
  const [waterApps, setWaterApps] = useState<OnboardingWaterApp[]>([
    { enabled: false, requiredLitres: '', remarks: '' },
  ]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Districts
  const { data: districts, isLoading: districtsLoading } = useQuery({
    queryKey: ['districts'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data;
    },
  });

  // Fetch Blocks when districtId changes
  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['blocks', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const res = await apiClient.get(`/locations/districts/${districtId}/blocks`);
      return res.data;
    },
    enabled: !!districtId,
  });

  // Fetch Villages when blockId changes
  const { data: villageData, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages', blockId, villageSearch],
    queryFn: async () => {
      if (!blockId) return { items: [] };
      const res = await apiClient.get(`/locations/blocks/${blockId}/villages`, {
        params: {
          search: villageSearch.trim() || undefined,
          limit: 100,
        },
      });
      return res.data;
    },
    enabled: !!blockId,
  });

  const villages = Array.isArray(villageData) ? villageData : villageData?.items || [];

  // Fetch Projects for Scheme Selection
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

  // Set default project ID on first holding once projects load
  React.useEffect(() => {
    if (projects && projects.length > 0) {
      setHoldings((prev) =>
        prev.map((h) => (!h.projectId ? { ...h, projectId: projects[0].project_id } : h)),
      );
    }
  }, [projects]);

  // Handle Step 1 Phone Lookup
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
      if (!res.data.found) {
        setCurrentStep(2);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error looking up phone number');
    } finally {
      setSearching(false);
    }
  };

  // Land Holdings helpers
  const addHolding = () => {
    const defaultProj = projects && projects.length > 0 ? projects[0].project_id : '';
    setHoldings((prev) => [
      ...prev,
      {
        projectId: defaultProj,
        declaredTotalArea: '',
        parcels: [{ surveyNumber: '', subdivisionNumber: '', area: '' }],
      },
    ]);
    setWaterApps((prev) => [...prev, { enabled: false, requiredLitres: '', remarks: '' }]);
  };

  const removeHolding = (index: number) => {
    setHoldings((prev) => prev.filter((_, i) => i !== index));
    setWaterApps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateHolding = (index: number, field: keyof OnboardingHolding, value: any) => {
    setHoldings((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addParcel = (holdingIdx: number) => {
    setHoldings((prev) => {
      const updated = [...prev];
      updated[holdingIdx] = {
        ...updated[holdingIdx],
        parcels: [
          ...updated[holdingIdx].parcels,
          { surveyNumber: '', subdivisionNumber: '', area: '' },
        ],
      };
      return updated;
    });
  };

  const removeParcel = (holdingIdx: number, parcelIdx: number) => {
    setHoldings((prev) => {
      const updated = [...prev];
      updated[holdingIdx] = {
        ...updated[holdingIdx],
        parcels: updated[holdingIdx].parcels.filter((_, i) => i !== parcelIdx),
      };
      return updated;
    });
  };

  const updateParcel = (
    holdingIdx: number,
    parcelIdx: number,
    field: keyof OnboardingParcel,
    value: string,
  ) => {
    setHoldings((prev) => {
      const updated = [...prev];
      const pList = [...updated[holdingIdx].parcels];
      const currentP = { ...pList[parcelIdx], [field]: value };
      pList[parcelIdx] = currentP;
      updated[holdingIdx] = { ...updated[holdingIdx], parcels: pList };
      return updated;
    });

    // Immediate check availability
    const pKey = `${holdingIdx}_${parcelIdx}`;
    const targetH = holdings[holdingIdx];
    const targetP = targetH?.parcels[parcelIdx];
    const sVal = field === 'surveyNumber' ? value : targetP?.surveyNumber || '';
    const subVal = field === 'subdivisionNumber' ? value : targetP?.subdivisionNumber || '';
    checkAvailability(pKey, sVal, subVal);
  };

  const updateWaterApp = (index: number, field: keyof OnboardingWaterApp, value: any) => {
    setWaterApps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Validate Step 2 (Identity & Location)
  const validateStep2 = () => {
    if (!name.trim()) return 'Please enter the beneficiary full name.';
    if (!districtId) return 'Please select a district.';
    if (!blockId) return 'Please select a block.';
    if (!villageId) return 'Please select a revenue village.';
    if (!addressLine1.trim()) return 'Please enter address line 1.';
    if (!pincode.trim() || pincode.trim().length !== 6) return 'Please enter a valid 6-digit postal PIN code.';
    return null;
  };

  // Validate Step 3 (Land Holdings & Parcels)
  const validateStep3 = () => {
    if (holdings.length === 0) return null; // Land is optional during initial onboarding if not known yet
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      if (!h.projectId) return `Holding #${i + 1}: Please select a project scheme.`;
      const declared = parseFloat(h.declaredTotalArea);
      if (isNaN(declared) || declared <= 0) {
        return `Holding #${i + 1}: Please enter a valid declared total area in acres.`;
      }

      // Check parcels if entered per holding
      const filledParcels = h.parcels.filter(
        (p) => p.surveyNumber.trim() || p.subdivisionNumber.trim() || p.area.trim(),
      );
      if (filledParcels.length > 0) {
        for (const p of filledParcels) {
          if (!p.surveyNumber.trim() || !p.subdivisionNumber.trim() || !p.area.trim()) {
            return `Holding #${i + 1}: All recorded parcels must have a Survey Number, Subdivision Number, and positive Area.`;
          }
          if (parseFloat(p.area) <= 0) {
            return `Holding #${i + 1}: Parcel area must be greater than zero.`;
          }
        }

        const sum = filledParcels.reduce((acc, p) => acc + (parseFloat(p.area) || 0), 0);
        if (Math.abs(sum - declared) > 0.001) {
          return `Holding #${i + 1}: Sum of parcels (${sum.toFixed(2)} ac) does not match declared area (${declared.toFixed(2)} ac).`;
        }
      }
    }

    // Check duplicate survey + subdivision across ALL holdings in onboarding request
    const seenAcrossAll = new Set<string>();
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i];
      const filledParcels = h.parcels.filter(
        (p) => p.surveyNumber.trim() || p.subdivisionNumber.trim() || p.area.trim(),
      );
      for (let j = 0; j < filledParcels.length; j++) {
        const p = filledParcels[j];
        const sTrim = p.surveyNumber.trim();
        const subTrim = p.subdivisionNumber.trim();
        if (sTrim && subTrim) {
          const key = `${sTrim.toUpperCase()}#${subTrim.toUpperCase()}`;
          if (seenAcrossAll.has(key)) {
            return `Duplicate parcel detected in form: Survey ${sTrim} / Subdivision ${subTrim} cannot be registered multiple times.`;
          }
          seenAcrossAll.add(key);

          // Check if DB availability check flagged this parcel as already taken in DB
          const pKey = `${i}_${j}`;
          const dbCheck = parcelAvailability[pKey];
          if (dbCheck && dbCheck.available === false) {
            return `Survey ${sTrim} / Subdivision ${subTrim} is already registered in the system. Please review parcel details before proceeding.`;
          }
        }
      }
    }
    return null;
  };

  // Validate Step 4 (Water Quota Applications)
  const validateStep4 = () => {
    for (let i = 0; i < waterApps.length; i++) {
      const w = waterApps[i];
      if (w.enabled) {
        const litres = parseFloat(w.requiredLitres);
        if (isNaN(litres) || litres <= 0) {
          return `Water Application for Holding #${i + 1}: Please enter a valid required water volume in litres.`;
        }
      }
    }
    return null;
  };

  const handleNext = () => {
    setError(null);
    if (currentStep === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      const err = validateStep3();
      if (err) {
        setError(err);
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      const err = validateStep4();
      if (err) {
        setError(err);
        return;
      }
      setCurrentStep(5);
    }
  };

  // Final Atomic Submission
  const handleCompleteSubmission = async () => {
    setError(null);
    setSubmitting(true);

    try {
      // 1. Prepare holdings payload
      const preparedHoldings = holdings
        .filter((h) => parseFloat(h.declaredTotalArea) > 0 && h.projectId)
        .map((h) => {
          const validParcels = h.parcels
            .filter((p) => p.surveyNumber.trim() && p.subdivisionNumber.trim() && parseFloat(p.area) > 0)
            .map((p) => ({
              surveyNumber: p.surveyNumber.trim(),
              subdivisionNumber: p.subdivisionNumber.trim(),
              area: parseFloat(p.area),
            }));

          return {
            projectId: h.projectId,
            declaredTotalArea: parseFloat(h.declaredTotalArea),
            parcels: validParcels,
          };
        });

      // 2. Prepare water applications payload
      const preparedWaterApps: any[] = [];
      waterApps.forEach((w, idx) => {
        if (w.enabled && parseFloat(w.requiredLitres) > 0 && idx < preparedHoldings.length) {
          preparedWaterApps.push({
            holdingIndex: idx,
            requiredLitres: parseFloat(w.requiredLitres),
            remarks: w.remarks.trim() || undefined,
          });
        }
      });

      const payload = {
        name: name.trim(),
        phoneNumber: phoneNumber.trim(),
        email: email.trim() || undefined,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        addressLine3: addressLine3.trim() || undefined,
        districtId,
        blockId,
        villageId,
        pincode: pincode.trim(),
        locationDirection,
        locationDescription: locationDescription.trim() || undefined,
        holdings: preparedHoldings.length > 0 ? preparedHoldings : undefined,
        waterApplications: preparedWaterApps.length > 0 ? preparedWaterApps : undefined,
      };

      const res = await apiClient.post('/beneficiaries/complete-onboarding', payload);
      
      // Invalidate queries so lists and stats update immediately without manual reload
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      
      router.push(`/beneficiaries/${res.data.beneficiary_id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete beneficiary onboarding');
      setSubmitting(false);
    }
  };

  // Selected names for review
  const selectedDistrictName = districts?.find((d: any) => d.district_id === districtId)?.name || '';
  const selectedBlockName = blocks?.find((b: any) => b.block_id === blockId)?.name || '';
  const selectedVillageName = villages?.find((v: any) => v.village_id === villageId)?.name || '';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Beneficiary Onboarding</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Atomic multi-step registration workflow: Personal Dossier &rarr; Land Holdings &rarr; Subdivision Parcels &rarr; Water Quotas
        </p>
      </div>

      {/* Progress Steps Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { num: 1, title: 'Phone Lookup' },
            { num: 2, title: 'Profile & Location' },
            { num: 3, title: 'Land & Parcels' },
            { num: 4, title: 'Water Quotas' },
            { num: 5, title: 'Review & Submit' },
          ].map((s, i, arr) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition ${
                    currentStep === s.num
                      ? 'bg-sky-600 text-white shadow-sm'
                      : currentStep > s.num
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`hidden sm:inline text-xs font-semibold ${
                    currentStep === s.num
                      ? 'text-slate-900'
                      : currentStep > s.num
                      ? 'text-emerald-700'
                      : 'text-slate-400'
                  }`}
                >
                  {s.title}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${
                    currentStep > s.num ? 'bg-emerald-300' : 'bg-slate-100'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STEP 1: PHONE NUMBER LOOKUP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                1
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Step 1: Phone Number Pre-Verification</h2>
                <p className="text-xs text-slate-500">Check duplicate registry before starting registration</p>
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
                    setLookupResult(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-2 shrink-0 disabled:opacity-50 shadow-sm"
              >
                <Search className="w-4 h-4" />
                <span>{searching ? 'Checking...' : 'Lookup Phone'}</span>
              </button>
            </form>
          </div>

          {/* Case A: Existing Beneficiary Found */}
          {hasSearched && lookupResult?.found && (
            <div className="bg-emerald-50 border-2 border-emerald-200 p-6 rounded-2xl space-y-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded">
                      Beneficiary Already Registered
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {lookupResult.beneficiary.name}
                    </h3>
                    <p className="text-xs text-slate-600 font-mono">
                      UUID: {lookupResult.beneficiary.beneficiary_id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white/80 p-4 rounded-xl text-xs border border-emerald-100">
                <div>
                  <span className="text-slate-400 text-[11px]">Phone:</span>
                  <div className="font-semibold text-slate-800">{lookupResult.beneficiary.phone_number}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Location:</span>
                  <div className="font-semibold text-slate-800">
                    {lookupResult.beneficiary.village?.name}, {lookupResult.beneficiary.district?.name}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Total Active Land:</span>
                  <div className="font-semibold text-emerald-700">
                    {formatAcres(lookupResult.beneficiary.total_land_acres)}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Active Land Holdings:</span>
                  <div className="font-semibold text-slate-800">
                    {lookupResult.beneficiary.landHoldings?.length || 0} Holdings
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Water Applications:</span>
                  <div className="font-semibold text-slate-800">
                    {lookupResult.beneficiary.waterApplications?.length || 0} Applications
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200/60">
                <p className="text-xs text-emerald-900 font-semibold mb-3">
                  This phone number is already registered in the system. Duplicate records are prevented:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/beneficiaries/${lookupResult.beneficiary.beneficiary_id}`}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition inline-flex items-center space-x-1"
                  >
                    <span>Open Existing Profile</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Link>
                  <Link
                    href={`/beneficiaries/${lookupResult.beneficiary.beneficiary_id}?tab=land`}
                    className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl transition inline-flex items-center space-x-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5 mr-1" />
                    <span>Add Land Holding to Profile</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STEP 2: BENEFICIARY PROFILE & LOCATION */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentStep === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center space-x-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
              2
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Step 2: Beneficiary Details & Location Hierarchy</h2>
              <p className="text-xs text-slate-500">
                Phone <span className="font-mono font-bold text-slate-800">{phoneNumber}</span> is available for new registration
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Full Legal Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. K. Ramasamy Gounder"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Email Address (Optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@water.gov"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            {/* Cascading Location Hierarchy */}
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                District *
              </label>
              <select
                required
                value={districtId}
                onChange={(e) => {
                  setDistrictId(e.target.value);
                  setBlockId('');
                  setVillageId('');
                  setVillageSearch('');
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">{districtsLoading ? 'Loading districts...' : '-- Select District --'}</option>
                {districts?.map((d: any) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.name} {d.lgd_district_code ? `(LGD ${d.lgd_district_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Block *
              </label>
              <select
                required
                disabled={!districtId || blocksLoading}
                value={blockId}
                onChange={(e) => {
                  setBlockId(e.target.value);
                  setVillageId('');
                  setVillageSearch('');
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
              >
                <option value="">
                  {!districtId ? 'First select District' : blocksLoading ? 'Loading blocks...' : '-- Select Block --'}
                </option>
                {blocks?.map((b: any) => (
                  <option key={b.block_id} value={b.block_id}>
                    {b.name} {b.lgd_block_code ? `(LGD ${b.lgd_block_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block font-bold text-slate-700 uppercase tracking-wider">
                  Revenue Village *
                </label>
                {blockId && (
                  <div className="flex items-center space-x-1 text-xs text-slate-500">
                    <Search className="w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter village..."
                      value={villageSearch}
                      onChange={(e) => setVillageSearch(e.target.value)}
                      className="px-2 py-0.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>
                )}
              </div>
              <select
                required
                disabled={!blockId || villagesLoading}
                value={villageId}
                onChange={(e) => setVillageId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:outline-none transition"
              >
                <option value="">
                  {!blockId
                    ? 'First select Block'
                    : villagesLoading
                    ? 'Loading villages...'
                    : villages.length === 0
                    ? 'No villages found'
                    : '-- Select Village --'}
                </option>
                {villages.map((v: any) => (
                  <option key={v.village_id} value={v.village_id}>
                    {v.name} {v.lgd_village_code ? `(LGD ${v.lgd_village_code})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Postal PIN Code *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="642001"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Location Direction *
              </label>
              <select
                value={locationDirection}
                onChange={(e) => setLocationDirection(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="NORTH">NORTH</option>
                <option value="SOUTH">SOUTH</option>
                <option value="EAST">EAST</option>
                <option value="WEST">WEST</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 1 (Street / Door Number) *
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Door No, Street Name"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Address Line 2 (Locality / Area)
              </label>
              <input
                type="text"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Locality area"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                Landmark / Location Description
              </label>
              <input
                type="text"
                value={locationDescription}
                onChange={(e) => setLocationDescription(e.target.value)}
                placeholder="e.g. Near main canal feeder sluice"
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <span>Proceed to Land Holdings</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STEP 3: LAND HOLDINGS & PARCELS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentStep === 3 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Step 3: Agricultural Land Holdings & Parcels</h2>
              <p className="text-xs text-slate-500">
                Register one or more land holdings under approved project schemes with subdivision parcel reconciliation
              </p>
            </div>
            <button
              type="button"
              onClick={addHolding}
              className="inline-flex items-center px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Another Land Holding
            </button>
          </div>

          {holdings.map((h, hIdx) => {
            const hasParcels = h.parcels && h.parcels.some((p) => p.surveyNumber.trim() || p.area.trim());
            const sumParcels = h.parcels.reduce((acc, p) => acc + (parseFloat(p.area) || 0), 0);
            const declaredNum = parseFloat(h.declaredTotalArea) || 0;
            const isMatch = hasParcels && Math.abs(sumParcels - declaredNum) < 0.0001;
            const diff = sumParcels - declaredNum;

            return (
              <div
                key={hIdx}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                      #{hIdx + 1}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Land Holding #{hIdx + 1}</h3>
                      <span className="text-[11px] text-slate-400">Agricultural Title & Parcel Records</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {!hasParcels ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg">
                        <Info className="w-3.5 h-3.5 mr-1 text-slate-500" /> Parcels Not Recorded
                      </span>
                    ) : isMatch ? (
                      <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Area Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500" /> Area Mismatch ({diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} ac)
                      </span>
                    )}

                    {holdings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeHolding(hIdx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Remove this holding"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Project Scheme *
                    </label>
                    <select
                      required
                      value={h.projectId}
                      onChange={(e) => updateHolding(hIdx, 'projectId', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium"
                    >
                      <option value="">-- Select Project Scheme --</option>
                      {projects?.map((p: any) => (
                        <option key={p.project_id} value={p.project_id}>
                          {p.project_name} ({p.project_code})
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
                      placeholder="e.g. 5.70"
                      value={h.declaredTotalArea}
                      onChange={(e) => updateHolding(hIdx, 'declaredTotalArea', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                    />
                  </div>
                </div>

                {/* SF/Subdivision Parcels breakdown */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">
                      Survey & Subdivision Parcels ({h.parcels.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => addParcel(hIdx)}
                      className="text-sky-600 font-bold hover:underline flex items-center"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Parcel
                    </button>
                  </div>

                  <div className="space-y-2">
                    {h.parcels.map((p, pIdx) => {
                      const sNorm = p.surveyNumber.trim().toUpperCase();
                      const subNorm = p.subdivisionNumber.trim().toUpperCase();
                      const isComplete = !!(sNorm && subNorm);
                      
                      // Check duplicate within the entire form
                      const isInFormDup =
                        isComplete &&
                        holdings.some((otherH, oHIdx) =>
                          otherH.parcels.some(
                            (otherP, oPIdx) =>
                              !(oHIdx === hIdx && oPIdx === pIdx) &&
                              otherP.surveyNumber.trim().toUpperCase() === sNorm &&
                              otherP.subdivisionNumber.trim().toUpperCase() === subNorm,
                          ),
                        );

                      const pKey = `${hIdx}_${pIdx}`;
                      const avail = parcelAvailability[pKey];

                      const isInvalid = isInFormDup || (avail && avail.available === false);
                      const isValid = !isInFormDup && avail && avail.available === true && isComplete;

                      return (
                        <div key={pIdx} className="space-y-1">
                          <div
                            className={`grid grid-cols-1 sm:grid-cols-12 gap-2 p-2.5 bg-slate-50 rounded-xl border ${
                              isInvalid
                                ? 'border-rose-400 bg-rose-50/40'
                                : isValid
                                ? 'border-emerald-400 bg-emerald-50/20'
                                : 'border-slate-200'
                            } items-center text-xs`}
                          >
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                placeholder="Survey No (e.g. 101)"
                                value={p.surveyNumber}
                                onChange={(e) => updateParcel(hIdx, pIdx, 'surveyNumber', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                placeholder="Subdivision (e.g. 1A)"
                                value={p.subdivisionNumber}
                                onChange={(e) => updateParcel(hIdx, pIdx, 'subdivisionNumber', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                              />
                            </div>
                            <div className="sm:col-span-3">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="Area (ac)"
                                value={p.area}
                                onChange={(e) => updateParcel(hIdx, pIdx, 'area', e.target.value)}
                                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                              />
                            </div>
                            <div className="sm:col-span-1 text-center">
                              {h.parcels.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeParcel(hIdx, pIdx)}
                                  className="text-rose-500 hover:text-rose-700"
                                  title="Remove parcel"
                                >
                                  <Trash2 className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Visual Real-Time Availability & Duplicate Indicator */}
                          {isInFormDup ? (
                            <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                              ✕ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is duplicated in this registration form.
                            </p>
                          ) : avail?.checking ? (
                            <p className="text-[11px] text-slate-500 px-2 flex items-center">
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin text-slate-400 shrink-0" />
                              Checking parcel availability...
                            </p>
                          ) : avail && avail.available === false ? (
                            <p className="text-[11px] text-rose-600 font-semibold px-2 flex items-center">
                              <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500 shrink-0" />
                              ✕ Survey {p.surveyNumber.trim()} / Subdivision {p.subdivisionNumber.trim()} is already registered for another holding.
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
                </div>
              </div>
            );
          })}

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <span>Proceed to Water Applications</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STEP 4: WATER QUOTA APPLICATIONS */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentStep === 4 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Step 4: Water Quota Applications</h2>
            <p className="text-xs text-slate-500">
              Optionally submit crop requirement applications for registered land holdings during onboarding
            </p>
          </div>

          <div className="space-y-4">
            {holdings.map((h, hIdx) => {
              const proj = projects?.find((p: any) => p.project_id === h.projectId);
              const w = waterApps[hIdx] || { enabled: false, requiredLitres: '', remarks: '' };

              return (
                <div
                  key={hIdx}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs">
                        <Droplet className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">
                          Holding #{hIdx + 1} ({formatAcres(h.declaredTotalArea || '0')})
                        </h3>
                        <span className="text-[11px] text-slate-500">
                          Scheme: {proj?.project_name || 'Kongu Basin Scheme'}
                        </span>
                      </div>
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={w.enabled}
                        onChange={(e) => updateWaterApp(hIdx, 'enabled', e.target.checked)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                      />
                      <span>Create Water Application</span>
                    </label>
                  </div>

                  {w.enabled ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Required Water Volume (Litres) *
                        </label>
                        <input
                          type="number"
                          step="100"
                          required
                          placeholder="e.g. 10000"
                          value={w.requiredLitres}
                          onChange={(e) => updateWaterApp(hIdx, 'requiredLitres', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Application Remarks / Crop Type (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sugarcane / Coconut irrigation"
                          value={w.remarks}
                          onChange={(e) => updateWaterApp(hIdx, 'remarks', e.target.value)}
                          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      No water application selected for this holding. You can also apply later from the beneficiary profile.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-sm transition"
            >
              <span>Review Complete Registration</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* STEP 5: REVIEW & ATOMIC SUBMIT */}
      {/* ──────────────────────────────────────────────────────────── */}
      {currentStep === 5 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Step 5: Review & Final Registration</h2>
            <p className="text-xs text-slate-500">
              Verify all beneficiary details, agricultural parcels, and water quotas before atomic database commitment
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6 text-xs">
            {/* Beneficiary Identity & Location Dossier */}
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                <User className="w-4 h-4 text-sky-600" />
                <span>Beneficiary & Location Dossier</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3">
                <div>
                  <span className="text-slate-400 text-[11px]">Full Name:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{name}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Phone Number:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5 font-mono">{phoneNumber}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Email:</span>
                  <div className="font-medium text-slate-800 mt-0.5">{email || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Revenue Location:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {selectedVillageName}, {selectedBlockName}, {selectedDistrictName}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">PIN Code & Direction:</span>
                  <div className="font-semibold text-slate-800 mt-0.5">
                    {pincode} ({locationDirection})
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px]">Address:</span>
                  <div className="font-medium text-slate-700 mt-0.5">{addressLine1}</div>
                </div>
              </div>
            </div>

            {/* Land Holdings Summary */}
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                <Layers className="w-4 h-4 text-emerald-600" />
                <span>Land Holdings ({holdings.length})</span>
              </div>
              <div className="space-y-3 pt-3">
                {holdings.map((h, idx) => {
                  const proj = projects?.find((p: any) => p.project_id === h.projectId);
                  const validParcels = h.parcels.filter((p) => p.surveyNumber.trim());

                  return (
                    <div
                      key={idx}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-slate-900">
                          Holding #{idx + 1}: {formatAcres(h.declaredTotalArea || '0')} • {proj?.project_name || 'Kongu Basin Scheme'}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {validParcels.length > 0
                            ? `Parcels (${validParcels.length}): ${validParcels
                                .map((p) => `SF ${p.surveyNumber}/${p.subdivisionNumber} (${p.area} ac)`)
                                .join(', ')}`
                            : 'No subdivision parcels breakdown recorded'}
                        </div>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready to Register
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Water Applications Summary */}
            <div>
              <div className="flex items-center space-x-2 pb-2 border-b border-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                <Droplet className="w-4 h-4 text-sky-600" />
                <span>Water Quota Applications</span>
              </div>
              <div className="space-y-2 pt-3">
                {waterApps.some((w) => w.enabled) ? (
                  waterApps.map((w, idx) => {
                    if (!w.enabled) return null;
                    return (
                      <div
                        key={idx}
                        className="p-3 bg-sky-50/70 border border-sky-200 rounded-xl flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-2">
                          <Droplet className="w-4 h-4 text-sky-600 shrink-0" />
                          <span className="font-semibold text-sky-950">
                            Holding #{idx + 1} Quota Request: {formatLitres(w.requiredLitres)}
                          </span>
                        </div>
                        {w.remarks && (
                          <span className="text-[11px] text-sky-700 italic">&quot;{w.remarks}&quot;</span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-slate-400 italic">No water quota applications submitted during onboarding.</p>
                )}
              </div>
            </div>

            {/* Atomic Guarantee Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Atomic Transaction Guaranteed:</strong> Beneficiary, Land Holdings, Subdivision Parcels, and Water Applications are committed together. If any item fails validation, all operations are safely rolled back.
              </span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCurrentStep(4)}
              className="inline-flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleCompleteSubmission}
              className="inline-flex items-center px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Registering Dossier...' : 'Save & Complete Registration'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
