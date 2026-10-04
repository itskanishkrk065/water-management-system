'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatLitres, formatDate } from '@/lib/utils';
import {
  CalendarDays,
  Plus,
  Search,
  Filter,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  CreditCard,
  Receipt,
  Download,
  Building2,
  ArrowRight,
  Eye,
  Sliders,
  Check,
  FileCheck2,
  Droplets,
  Layers,
  Activity,
  User,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export default function RunningBillsManager() {
  const queryClient = useQueryClient();

  // Tab State: 'month-end' | 'overview' | 'usage' | 'bills' | 'payments'
  const [activeTab, setActiveTab] = useState<'month-end' | 'overview' | 'usage' | 'bills' | 'payments'>('month-end');

  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<string>('2026-10');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');

  // Month-End Specific State (CRITICAL: durable draft inputs state)
  const [monthEndPage, setMonthEndPage] = useState(1);
  const [monthEndSearch, setMonthEndSearch] = useState('');
  const [monthEndQuickFilter, setMonthEndQuickFilter] = useState('ALL');
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});
  const [showBatchConfirmModal, setShowBatchConfirmModal] = useState(false);
  const [batchResultSummary, setBatchResultSummary] = useState<any | null>(null);

  // Modals
  const [showRecordUsageModal, setShowRecordUsageModal] = useState(false);
  const [usageStep, setUsageStep] = useState<number>(1);
  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [selectedAllotment, setSelectedAllotment] = useState<any | null>(null);
  const [usageEntryMode, setUsageEntryMode] = useState<'DIRECT' | 'METER_READING'>('DIRECT');
  const [actualUsageLitres, setActualUsageLitres] = useState<string>('');
  const [prevMeter, setPrevMeter] = useState<string>('');
  const [currMeter, setCurrMeter] = useState<string>('');
  const [collectionDate, setCollectionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [usageNotes, setUsageNotes] = useState<string>('');
  const [usageError, setUsageError] = useState<string | null>(null);

  // Bill Detail Modal State
  const [detailBillId, setDetailBillId] = useState<string | null>(null);

  // Payment Modal State
  const [payModalBill, setPayModalBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payCollector, setPayCollector] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  // ESC Key Modal Listener (UX-ESC-001..007)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showRecordUsageModal) {
          setShowRecordUsageModal(false);
        }
        if (payModalBill) {
          setPayModalBill(null);
        }
        if (detailBillId) {
          setDetailBillId(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRecordUsageModal, payModalBill, detailBillId]);

  // Load draftInputs from localStorage when period changes (CRITICAL: durable draft persistence)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(`watergrid_drafts_${selectedBillingPeriod}`);
      if (saved) {
        setDraftInputs(JSON.parse(saved));
      } else {
        setDraftInputs({});
      }
    } catch {}
  }, [selectedBillingPeriod]);

  // Durable draft update helper that updates state and syncs to localStorage
  const updateDraftInput = (allotmentId: string, val: string) => {
    setDraftInputs((prev) => {
      const updated = { ...prev, [allotmentId]: val };
      try {
        localStorage.setItem(`watergrid_drafts_${selectedBillingPeriod}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Fetch Eligible Beneficiaries for Month-End Running Billing
  const { data: eligibleData, isLoading: isEligibleLoading, refetch: refetchEligible } = useQuery({
    queryKey: [
      'eligible-beneficiaries-month-end',
      monthEndPage,
      monthEndSearch,
      monthEndQuickFilter,
      selectedBillingPeriod,
      selectedDistrictId,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/billing/running-charges/eligible-beneficiaries', {
        params: {
          page: monthEndPage,
          limit: 15,
          search: monthEndSearch.trim() || undefined,
          entryStatus: monthEndQuickFilter !== 'ALL' ? monthEndQuickFilter : undefined,
          billingPeriod: selectedBillingPeriod,
          districtId: selectedDistrictId || undefined,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'month-end' || activeTab === 'overview',
  });

  // Seed draftInputs from API if not already edited locally
  React.useEffect(() => {
    if (eligibleData?.items) {
      setDraftInputs((prev) => {
        let changed = false;
        const next = { ...prev };
        eligibleData.items.forEach((item: any) => {
          if (
            next[item.allotmentId] === undefined &&
            item.enteredConsumptionLiters !== null &&
            item.enteredConsumptionLiters !== undefined
          ) {
            next[item.allotmentId] = String(item.enteredConsumptionLiters);
            changed = true;
          }
        });
        if (changed) {
          try {
            localStorage.setItem(`watergrid_drafts_${selectedBillingPeriod}`, JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });
    }
  }, [eligibleData, selectedBillingPeriod]);

  // Save Drafts Mutation
  const saveDraftsMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(draftInputs)
        .filter(([_, val]) => val !== undefined && val !== null && val.trim() !== '')
        .map(([allotmentId, val]) => ({
          allotmentId,
          actualMonthlyConsumptionLiters: parseFloat(val),
        }))
        .filter((e) => !isNaN(e.actualMonthlyConsumptionLiters));

      const res = await apiClient.post('/billing/running-charges/save-drafts', {
        billingPeriod: selectedBillingPeriod,
        entries,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      alert(`Draft saved successfully for ${data.savedCount} beneficiaries.`);
      queryClient.invalidateQueries({ queryKey: ['eligible-beneficiaries-month-end'] });
    },
  });

  // Generate Batch Running Bills Mutation
  const generateBatchBillsMutation = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(draftInputs)
        .filter(([_, val]) => val !== undefined && val !== null && val.trim() !== '')
        .map(([allotmentId, val]) => ({
          allotmentId,
          actualMonthlyConsumptionLiters: parseFloat(val),
        }))
        .filter((e) => !isNaN(e.actualMonthlyConsumptionLiters));

      if (entries.length === 0) {
        throw new Error('No monthly consumption values entered to generate bills.');
      }

      const res = await apiClient.post('/billing/running-charges/generate-batch', {
        billingPeriod: selectedBillingPeriod,
        entries,
      });
      return res.data;
    },
    onSuccess: (data: any) => {
      setBatchResultSummary(data);
      setShowBatchConfirmModal(false);
      queryClient.invalidateQueries({ queryKey: ['eligible-beneficiaries-month-end'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
      queryClient.invalidateQueries({ queryKey: ['water-usage-list'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to generate running bills batch');
    },
  });

  // 1. Fetch Calendar Periods (Part 4, 5)
  const { data: periodsData } = useQuery({
    queryKey: ['billing-calendar-periods'],
    queryFn: async () => {
      const res = await apiClient.get('/billing/calendar/periods');
      return res.data || [];
    },
  });

  // 2. Fetch Summary Metrics for Selected Period (Part 20, 21)
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['running-bills-summary', selectedBillingPeriod, selectedDistrictId],
    queryFn: async () => {
      const res = await apiClient.get('/billing/running-bills/summary', {
        params: {
          billingPeriod: selectedBillingPeriod || undefined,
          districtId: selectedDistrictId || undefined,
        },
      });
      return res.data;
    },
  });

  // 3. Fetch Water Usage Records (Part 34)
  const { data: usageData, isLoading: isUsageLoading, refetch: refetchUsage } = useQuery({
    queryKey: ['water-usage-list', page, search, selectedBillingPeriod, selectedDistrictId, selectedStatus],
    queryFn: async () => {
      const res = await apiClient.get('/billing/usage', {
        params: {
          page,
          limit: 15,
          search: search.trim() || undefined,
          billingPeriod: selectedBillingPeriod || undefined,
          districtId: selectedDistrictId || undefined,
          status: selectedStatus || undefined,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'usage' || activeTab === 'overview',
  });

  // 4. Fetch Running Bills Table (Part 35)
  const { data: billsData, isLoading: isBillsLoading, refetch: refetchBills } = useQuery({
    queryKey: ['running-bills-list', page, search, selectedStatus, selectedBillingPeriod, selectedDistrictId],
    queryFn: async () => {
      const res = await apiClient.get('/billing/running-bills', {
        params: {
          page,
          limit: 15,
          search: search.trim() || undefined,
          status: selectedStatus || undefined,
          billingPeriod: selectedBillingPeriod || undefined,
          districtId: selectedDistrictId || undefined,
        },
      });
      return res.data;
    },
    enabled: activeTab === 'bills' || activeTab === 'overview' || activeTab === 'payments',
  });

  // 5. Fetch Beneficiary Allotments for Usage Recording search
  const { data: allotmentResults, isLoading: isSearchingAllotments } = useQuery({
    queryKey: ['search-allotments-for-usage', beneficiarySearch],
    queryFn: async () => {
      if (!beneficiarySearch || beneficiarySearch.trim().length < 2) return [];
      const res = await apiClient.get('/reports/find', {
        params: { search: beneficiarySearch.trim(), limit: 10 },
      });
      return res.data?.items || [];
    },
    enabled: showRecordUsageModal && usageStep === 1 && beneficiarySearch.trim().length >= 2,
  });

  // 6. Fetch Single Bill Detail
  const { data: billDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['running-bill-detail', detailBillId],
    queryFn: async () => {
      if (!detailBillId) return null;
      const res = await apiClient.get(`/billing/running-bills/${detailBillId}`);
      return res.data;
    },
    enabled: Boolean(detailBillId),
  });

  // 7. Eligibility Query for Modal Step 2
  const { data: eligibility, isLoading: isCheckingEligibility } = useQuery({
    queryKey: ['allotment-eligibility', selectedAllotment?.allotment_id, selectedBillingPeriod],
    queryFn: async () => {
      if (!selectedAllotment?.allotment_id) return null;
      const res = await apiClient.get(`/billing/eligibility/${selectedAllotment.allotment_id}`, {
        params: { billingPeriod: selectedBillingPeriod },
      });
      return res.data;
    },
    enabled: Boolean(selectedAllotment?.allotment_id),
  });

  // Mutations
  const recordUsageMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/billing/usage', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-usage-list'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
      setShowRecordUsageModal(false);
      resetUsageForm();
    },
    onError: (err: any) => {
      setUsageError(err.response?.data?.message || err.message || 'Failed to record usage');
    },
  });

  const generateBillMutation = useMutation({
    mutationFn: async (usageId: string) => {
      const res = await apiClient.post(`/billing/usage/${usageId}/generate-bill`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-usage-list'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to generate bill');
    },
  });

  const payBillMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post(`/payments/running-bills/${payModalBill.running_bill_id}/pay`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['water-usage-list'] });
      setPayModalBill(null);
      setPayAmount('');
      setPayRef('');
      setPayRemarks('');
      setPayError(null);
    },
    onError: (err: any) => {
      setPayError(err.response?.data?.message || err.message || 'Failed to record payment');
    },
  });

  const reconcileCalendarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/calendar/reconcile');
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['billing-calendar-periods'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      alert(`Calendar reconciled! Current period: ${data.currentPeriod}.`);
    },
  });

  const resetUsageForm = () => {
    setUsageStep(1);
    setBeneficiarySearch('');
    setSelectedAllotment(null);
    setUsageEntryMode('DIRECT');
    setActualUsageLitres('');
    setPrevMeter('');
    setCurrMeter('');
    setUsageNotes('');
    setUsageError(null);
  };

  // Compute calculated preview litres and amount in modal
  const computedUsageLitres = usageEntryMode === 'DIRECT'
    ? (parseFloat(actualUsageLitres) || 0)
    : Math.max(0, (parseFloat(currMeter) || 0) - (parseFloat(prevMeter) || 0));

  const applicableRate = parseFloat(eligibility?.runningRatePerLitre || '0.50');
  const calculatedPreviewAmount = computedUsageLitres * applicableRate;

  return (
    <div className="space-y-6">
      {/* ── Top Header & Global Period Selector ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg text-white">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl">
              <Droplets className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">WaterGrid Running Charges &amp; Operations</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Usage-based monthly collection: Commissioned Infrastructure &rarr; Field Meter Verification &rarr; Single Running Tariff &rarr; Bill &rarr; Payment Ledger
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Monthly Period Dropdown (Part 4, 20) */}
          <div className="flex items-center space-x-2 bg-slate-800/90 border border-slate-700 px-3 py-1.5 rounded-xl">
            <CalendarDays className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="text-xs text-slate-400 font-medium">Period:</span>
            <select
              value={selectedBillingPeriod}
              onChange={(e) => {
                setSelectedBillingPeriod(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer"
            >
              {periodsData && periodsData.length > 0 ? (
                periodsData.map((p: any) => (
                  <option key={p.period_code} value={p.period_code} className="bg-slate-900 text-white">
                    {p.period_code} {p.status === 'OPEN' ? '(Current Active)' : `(${p.status})`}
                  </option>
                ))
              ) : (
                <option value="2026-10">2026-10 (October 2026)</option>
              )}
            </select>
          </div>

          <button
            onClick={() => reconcileCalendarMutation.mutate()}
            disabled={reconcileCalendarMutation.isPending}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
            title="Reconcile offline calendar clock"
          >
            <RefreshCw className={`w-4 h-4 ${reconcileCalendarMutation.isPending ? 'animate-spin' : ''}`} />
          </button>

          {/* Primary Action Button (Part 33) */}
          <button
            onClick={() => {
              resetUsageForm();
              setShowRecordUsageModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Record Water Usage</span>
          </button>
        </div>
      </div>

      {/* ── KPI Cards (Part 20, Part 33) ──────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Billed</div>
          <div className="text-lg font-bold text-slate-900 font-mono">
            {formatCurrency(summary?.financials?.totalBilled || '0')}
          </div>
          <div className="text-[10px] text-slate-400">
            {summary?.financials?.totalBills || 0} Bills Generated
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Total Paid</div>
          <div className="text-lg font-bold text-emerald-600 font-mono">
            {formatCurrency(summary?.financials?.totalPaid || '0')}
          </div>
          <div className="text-[10px] text-slate-400">
            {summary?.operations?.billsFullyPaid || 0} Bills Fully Settled
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Total Pending</div>
          <div className="text-lg font-bold text-amber-600 font-mono">
            {formatCurrency(summary?.financials?.totalPending || '0')}
          </div>
          <div className="text-[10px] text-slate-400">
            {summary?.operations?.billsPendingPayment || 0} Outstanding
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider">Overdue</div>
          <div className="text-lg font-bold text-rose-600 font-mono">
            {formatCurrency(summary?.financials?.totalOverdue || '0')}
          </div>
          <div className="text-[10px] text-slate-400">Past payment due date</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">Usage Recorded</div>
          <div className="text-lg font-bold text-sky-600 font-mono">
            {summary?.operations?.usageRecorded || 0}
          </div>
          <div className="text-[10px] text-slate-400">
            {formatLitres(summary?.usage?.totalActualUsageLitres || '0')}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Awaiting Collection</div>
          <div className="text-lg font-bold text-indigo-600 font-mono">
            {summary?.operations?.awaitingCollection || 0}
          </div>
          <div className="text-[10px] text-slate-400">
            Of {summary?.operations?.eligibleBeneficiaries || 0} Commissioned
          </div>
        </div>
      </div>

      {/* ── Main Module Navigation Tabs (Part 33) ──────────────────────── */}
      <div className="flex items-center space-x-1 border-b border-slate-200">
        {[
          { id: 'month-end', label: 'Month-End Running Billing', icon: CalendarDays },
          { id: 'overview', label: 'Overview & Position', icon: Activity },
          { id: 'usage', label: `Usage Collection (${summary?.operations?.usageRecorded || 0})`, icon: Droplets },
          { id: 'bills', label: `Running Bills (${summary?.financials?.totalBills || 0})`, icon: Receipt },
          { id: 'payments', label: 'Payments Ledger', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition -mb-[1px] ${
                isActive
                  ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── TAB: MONTH-END CUMULATIVE RUNNING BILLING ──────────────────── */}
      {activeTab === 'month-end' && (
        <div className="space-y-6">
          {/* Banner & Action Bar */}
          <div className="bg-sky-950/40 border border-sky-800/60 p-4 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sky-100">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 bg-sky-500/20 text-sky-300 font-bold text-[11px] rounded-md uppercase tracking-wider">
                  Authoritative Business Model
                </span>
                <span className="text-xs font-semibold text-sky-200">
                  {selectedBillingPeriod} ({eligibleData?.meta?.daysInPeriod || 30} Days in Period)
                </span>
              </div>
              <h2 className="text-base font-bold text-white">Month-End Cumulative Water Delivery Billing</h2>
              <p className="text-xs text-sky-200/80">
                Monthly entitled quantity = <strong>Daily Approved Quota &times; Days in Billing Period</strong>.
                Enter actual cumulative monthly litres delivered for each beneficiary. Tolerance (&plusmn;3%) provides validation without altering entered values.
              </p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={() => saveDraftsMutation.mutate()}
                disabled={saveDraftsMutation.isPending}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-700/50 font-semibold rounded-xl text-xs transition flex items-center space-x-1.5"
              >
                <span>Save Draft Entries</span>
              </button>

              <button
                onClick={() => setShowBatchConfirmModal(true)}
                disabled={generateBatchBillsMutation.isPending}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
              >
                <span>Generate Running Bills</span>
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Quick Filter Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
                <span className="text-slate-400 font-medium mr-1 flex items-center space-x-1">
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filter:</span>
                </span>
                {[
                  { id: 'ALL', label: 'ALL' },
                  { id: 'PENDING_ENTRY', label: 'PENDING ENTRY' },
                  { id: 'ENTERED', label: 'ENTERED' },
                  { id: 'WITHIN_TOLERANCE', label: 'WITHIN TOLERANCE' },
                  { id: 'BELOW_TOLERANCE', label: 'BELOW TOLERANCE' },
                  { id: 'ABOVE_TOLERANCE', label: 'ABOVE TOLERANCE' },
                  { id: 'BILL_GENERATED', label: 'BILL GENERATED' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setMonthEndQuickFilter(f.id);
                      setMonthEndPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition whitespace-nowrap ${
                      monthEndQuickFilter === f.id
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, phone, code..."
                  value={monthEndSearch}
                  onChange={(e) => {
                    setMonthEndSearch(e.target.value);
                    setMonthEndPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                />
                {monthEndSearch && (
                  <button
                    onClick={() => setMonthEndSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Eligible Beneficiaries Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">Eligible Beneficiaries Grid</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  ({eligibleData?.meta?.total || 0} total)
                </span>
              </div>
              <div className="text-[11px] text-sky-700 font-medium bg-sky-50 px-2.5 py-1 rounded-md border border-sky-100">
                &check; Pagination &amp; Filter changes preserve entered values
              </div>
            </div>

            {isEligibleLoading ? (
              <div className="p-12 text-center text-xs text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-500" />
                <p>Loading eligible beneficiaries...</p>
              </div>
            ) : eligibleData?.items?.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-600">No matching eligible beneficiaries found</p>
                <p className="text-[11px] text-slate-400">Try adjusting filters or selected billing period.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Beneficiary</th>
                      <th className="py-3 px-4 text-right">Daily Quota</th>
                      <th className="py-3 px-4 text-center">Days</th>
                      <th className="py-3 px-4 text-right">Monthly Entitlement</th>
                      <th className="py-3 px-4 text-center min-w-[160px]">Actual Monthly Litres</th>
                      <th className="py-3 px-4 text-center">Variance &amp; Tolerance</th>
                      <th className="py-3 px-4 text-right">Running Bill Amount</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eligibleData.items.map((item: any) => {
                      const enteredVal = draftInputs[item.allotmentId] ?? (item.enteredConsumptionLiters !== null ? String(item.enteredConsumptionLiters) : '');
                      const numEntered = parseFloat(enteredVal);
                      const hasEntered = !isNaN(numEntered) && enteredVal.trim() !== '';

                      const dailyQuota = item.approvedDailyQuotaLiters || 0;
                      const entitlement = item.monthlyEntitlementLiters || (dailyQuota * (item.daysInPeriod || 30));
                      const rate = item.runningRatePerLiter || 0.5;

                      const minTol = entitlement * 0.97;
                      const maxTol = entitlement * 1.03;
                      const variance = hasEntered ? numEntered - entitlement : 0;
                      const variancePct = entitlement > 0 ? (variance / entitlement) * 100 : 0;

                      let tolStatus: 'WITHIN_TOLERANCE' | 'BELOW_TOLERANCE' | 'ABOVE_TOLERANCE' = 'WITHIN_TOLERANCE';
                      if (hasEntered) {
                        if (numEntered < minTol) tolStatus = 'BELOW_TOLERANCE';
                        else if (numEntered > maxTol) tolStatus = 'ABOVE_TOLERANCE';
                      }

                      const calculatedBill = hasEntered ? numEntered * rate : null;

                      return (
                        <tr key={item.allotmentId} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4 space-y-0.5">
                            <div className="font-bold text-slate-900">{item.beneficiaryName}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.beneficiaryCode} &bull; {item.villageName || item.districtName || 'N/A'}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-medium text-slate-700">
                            {dailyQuota.toLocaleString()} L/day
                          </td>

                          <td className="py-3 px-4 text-center font-mono text-slate-600">
                            {item.daysInPeriod}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-sky-700">
                            {entitlement.toLocaleString()} L
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.alreadyBilled ? (
                              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                                {numEntered.toLocaleString()} L
                              </span>
                            ) : (
                              <input
                                type="number"
                                placeholder="Enter monthly litres..."
                                value={enteredVal}
                                onChange={(e) => updateDraftInput(item.allotmentId, e.target.value)}
                                className={`w-36 px-3 py-1.5 text-center font-mono font-bold text-slate-900 border rounded-xl focus:outline-none focus:ring-2 transition ${
                                  hasEntered
                                    ? tolStatus === 'WITHIN_TOLERANCE'
                                      ? 'border-emerald-400 bg-emerald-50/30 focus:ring-emerald-400'
                                      : tolStatus === 'ABOVE_TOLERANCE'
                                      ? 'border-amber-500 bg-amber-50/40 focus:ring-amber-500'
                                      : 'border-yellow-400 bg-yellow-50/30 focus:ring-yellow-400'
                                    : 'border-slate-300 bg-white focus:ring-sky-500'
                                }`}
                              />
                            )}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {hasEntered ? (
                              <div className="space-y-0.5">
                                <div className="text-[10px] font-mono text-slate-500">
                                  {variance >= 0 ? `+${variance.toLocaleString()}` : variance.toLocaleString()} L ({variancePct >= 0 ? `+${variancePct.toFixed(2)}` : variancePct.toFixed(2)}%)
                                </div>
                                <span
                                  className={`inline-block px-2.5 py-0.5 text-[10px] font-extrabold rounded-md uppercase tracking-wider ${
                                    tolStatus === 'WITHIN_TOLERANCE'
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                      : tolStatus === 'ABOVE_TOLERANCE'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                  }`}
                                >
                                  {tolStatus.replace('_', ' ')}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-normal">Pending Input</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {calculatedBill !== null ? formatCurrency(calculatedBill) : '—'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {item.alreadyBilled ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-lg border border-emerald-200">
                                BILLED ({item.existingBillNumber})
                              </span>
                            ) : hasEntered ? (
                              <span className="px-2.5 py-1 bg-sky-50 text-sky-700 font-bold text-[10px] rounded-lg border border-sky-200">
                                DRAFT ENTERED
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-[10px] rounded-lg border border-slate-200">
                                PENDING
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Footer */}
            {eligibleData?.meta?.totalPages > 1 && (
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <div>
                  Page <strong>{monthEndPage}</strong> of <strong>{eligibleData.meta.totalPages}</strong> ({eligibleData.meta.total} eligible)
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setMonthEndPage((p) => Math.max(1, p - 1))}
                    disabled={monthEndPage <= 1}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setMonthEndPage((p) => Math.min(eligibleData.meta.totalPages, p + 1))}
                    disabled={monthEndPage >= eligibleData.meta.totalPages}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold hover:bg-slate-100 disabled:opacity-40 transition"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 1: OVERVIEW & POSITION ─────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <CreditCard className="w-4 h-4 text-sky-600" />
                <span>Financial Position ({selectedBillingPeriod})</span>
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Total Bills Issued:</span>
                <span className="font-bold text-slate-900 font-mono">{summary?.financials?.totalBills || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Gross Billed Liability:</span>
                <span className="font-bold text-slate-900 font-mono">{formatCurrency(summary?.financials?.totalBilled || '0')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Collected Receipts:</span>
                <span className="font-bold text-emerald-600 font-mono">{formatCurrency(summary?.financials?.totalPaid || '0')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Outstanding Balance:</span>
                <span className="font-bold text-amber-600 font-mono">{formatCurrency(summary?.financials?.totalPending || '0')}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Overdue (Past Due Date):</span>
                <span className="font-bold text-rose-600 font-mono">{formatCurrency(summary?.financials?.totalOverdue || '0')}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Activity className="w-4 h-4 text-indigo-600" />
                <span>Field Collection Operations</span>
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Commissioned Infrastructure:</span>
                <span className="font-bold text-slate-900 font-mono">{summary?.operations?.eligibleBeneficiaries || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Actual Usage Logged:</span>
                <span className="font-bold text-sky-600 font-mono">{summary?.operations?.usageRecorded || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Pending Field Visits:</span>
                <span className="font-bold text-indigo-600 font-mono">{summary?.operations?.awaitingCollection || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Running Bills Generated:</span>
                <span className="font-bold text-slate-900 font-mono">{summary?.operations?.billsGenerated || 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Collection Coverage:</span>
                <span className="font-bold text-slate-900 font-mono">
                  {summary?.operations?.eligibleBeneficiaries > 0
                    ? `${Math.round(((summary?.operations?.usageRecorded || 0) / summary.operations.eligibleBeneficiaries) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <Droplets className="w-4 h-4 text-sky-600" />
                <span>Water Consumption Metrics</span>
              </h2>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Total Water Consumed:</span>
                <span className="font-bold text-sky-700 font-mono">{formatLitres(summary?.usage?.totalActualUsageLitres || '0')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Average Monthly Usage:</span>
                <span className="font-bold text-slate-900 font-mono">{formatLitres(summary?.usage?.averageUsageLitres || '0')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Metered Beneficiaries:</span>
                <span className="font-bold text-slate-900 font-mono">{summary?.usage?.beneficiariesCollected || 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Authoritative Formula:</span>
                <span className="font-mono text-[11px] text-slate-600">Actual Usage &times; Rate</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: USAGE COLLECTION (Part 34) ─────────────────────────── */}
      {activeTab === 'usage' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Droplets className="w-5 h-5 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">Physical Water Usage Collection Records</h2>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search beneficiary or agent..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 w-56"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Commissioned</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Actual Usage</th>
                  <th className="py-3 px-4">Collection Date</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Bill</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isUsageLoading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">Loading usage records...</td>
                  </tr>
                ) : usageData?.items?.length > 0 ? (
                  usageData.items.map((rec: any) => {
                    const isBilled = Boolean(rec.runningBill || rec.status === 'BILLED');
                    return (
                      <tr key={rec.usage_id} className="hover:bg-slate-50 transition">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{rec.beneficiary?.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{rec.beneficiary?.phone_number}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {rec.beneficiary?.village?.name || '—'}, {rec.beneficiary?.district?.name || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                          {formatDate(rec.allotment?.infrastructure?.commissioned_date)}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800 font-mono">
                          {rec.billingPeriod?.period_code}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 font-mono text-sm">
                          {formatLitres(rec.actual_usage_litres)}
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-[11px]">
                          {formatDate(rec.collection_date)}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {rec.collectionAgent?.full_name || 'Field Officer'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="py-3 px-4 font-mono text-xs">
                          {rec.runningBill ? (
                            <span className="font-semibold text-sky-700">#{rec.runningBill.bill_number}</span>
                          ) : (
                            <span className="text-slate-400">Not Generated</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1">
                          {!isBilled && rec.status !== 'VOIDED' && rec.status !== 'REQUIRES_REVIEW' && (
                            <button
                              onClick={() => generateBillMutation.mutate(rec.usage_id)}
                              disabled={generateBillMutation.isPending}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-[11px] font-semibold transition"
                            >
                              Generate Bill
                            </button>
                          )}
                          {isBilled && rec.runningBill && rec.runningBill.status !== 'PAID' && (
                            <button
                              onClick={() => {
                                setPayModalBill(rec.runningBill);
                                setPayAmount(rec.runningBill.pending_amount?.toString() || '');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition"
                            >
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      No usage records found for billing period {selectedBillingPeriod}. Click <strong>Record Water Usage</strong> to log physical visits.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: RUNNING BILLS (Part 35) ────────────────────────────── */}
      {activeTab === 'bills' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">Authoritative Running Charges Bills</h2>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Search bill number or beneficiary..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Actual Usage</th>
                  <th className="py-3 px-4 text-right">Rate/L</th>
                  <th className="py-3 px-4 text-right">Amount Due</th>
                  <th className="py-3 px-4 text-right">Paid</th>
                  <th className="py-3 px-4 text-right">Pending</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isBillsLoading ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">Loading running bills...</td>
                  </tr>
                ) : billsData?.items?.length > 0 ? (
                  billsData.items.map((bill: any) => (
                    <tr key={bill.running_bill_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-sky-700">
                        #{bill.bill_number || bill.running_bill_id.slice(0, 8)}
                        {bill.is_legacy && (
                          <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-sans">LEGACY</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{bill.beneficiary?.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{bill.beneficiary?.phone_number}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">
                        {bill.billing_period}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {bill.actual_usage_litres_snapshot ? formatLitres(bill.actual_usage_litres_snapshot) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{Number(bill.running_cost_per_litre_snapshot || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(bill.amount_due)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(bill.amount_paid)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-600">
                        {formatCurrency(bill.pending_amount)}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                        {formatDate(bill.due_date)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="py-3 px-4 text-right space-x-1">
                        <button
                          onClick={() => setDetailBillId(bill.running_bill_id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition"
                        >
                          View
                        </button>
                        {bill.status !== 'PAID' && (
                          <button
                            onClick={() => {
                              setPayModalBill(bill);
                              setPayAmount(bill.pending_amount?.toString() || '');
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold transition"
                          >
                            Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No running bills found for billing period {selectedBillingPeriod}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: PAYMENTS LEDGER (Part 22) ─────────────────────────── */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Running Charges Settlement Ledger</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Beneficiary</th>
                  <th className="py-3 px-4">Bill Number</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billsData?.items?.flatMap((b: any) =>
                  (b.payments || []).map((p: any) => (
                    <tr key={p.payment_id} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-700">#{p.receipt_number}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{b.beneficiary?.name}</td>
                      <td className="py-3 px-4 font-mono text-sky-700">#{b.bill_number}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">{p.payment_mode}</td>
                      <td className="py-3 px-4 text-center"><StatusBadge status={p.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: 5-STEP RECORD WATER USAGE (Part 10) ────────────────── */}
      {showRecordUsageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Droplets className="w-5 h-5 text-sky-600" />
                  <span>Field Visit: Record Actual Water Usage</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Step {usageStep} of 5 &bull; Monthly Billing Period: {selectedBillingPeriod}</p>
              </div>
              <button onClick={() => setShowRecordUsageModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {usageError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{usageError}</span>
              </div>
            )}

            {/* STEP 1: Select Beneficiary */}
            {usageStep === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Search Beneficiary</label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Type beneficiary name, phone, or village..."
                      value={beneficiarySearch}
                      onChange={(e) => setBeneficiarySearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {allotmentResults && allotmentResults.length > 0 ? (
                    allotmentResults.map((item: any) => (
                      <div
                        key={item.beneficiary_id}
                        onClick={() => {
                          const allot = item.allotment || { allotment_id: item.allotment_id || item.water_allotment_id, ...item };
                          setSelectedAllotment(allot);
                          setUsageStep(2);
                        }}
                        className="p-3 hover:bg-sky-50 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{item.name}</div>
                          <div className="text-slate-400 text-[11px] font-mono">{item.phone_number} &bull; {item.village?.name || 'Village'}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-sky-600" />
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      {beneficiarySearch.length < 2 ? 'Type at least 2 characters to search' : 'No matching beneficiaries found'}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Eligibility Check */}
            {usageStep === 2 && (
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Beneficiary:</span>
                    <span className="font-bold text-slate-900">{selectedAllotment?.name || eligibility?.beneficiaryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Infrastructure Status:</span>
                    <span className={`font-bold ${eligibility?.infrastructureStatus === 'COMMISSIONED' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {eligibility?.infrastructureStatus || 'Checking...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Commissioned Date:</span>
                    <span className="font-mono text-slate-700">{formatDate(eligibility?.commissionedDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Running Charges Start:</span>
                    <span className="font-mono text-slate-700">{formatDate(eligibility?.runningChargeStartDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Approved Allocation:</span>
                    <span className="font-mono font-bold text-slate-900">{formatLitres(eligibility?.approvedLitres || '0')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Running Rate:</span>
                    <span className="font-mono font-bold text-sky-700">₹{eligibility?.runningRatePerLitre || '0.50'}/L</span>
                  </div>
                </div>

                {!eligibility?.eligible && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Not Eligible for Running Charges</span>
                    </div>
                    <div>{eligibility?.reason}</div>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button onClick={() => setUsageStep(1)} className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold">
                    Back
                  </button>
                  <button
                    onClick={() => setUsageStep(3)}
                    disabled={!eligibility?.eligible}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold"
                  >
                    Proceed to Record Usage &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Record Usage */}
            {usageStep === 3 && (
              <div className="space-y-4">
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    onClick={() => setUsageEntryMode('DIRECT')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      usageEntryMode === 'DIRECT' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
                    }`}
                  >
                    Mode A: Direct Usage Entry
                  </button>
                  <button
                    onClick={() => setUsageEntryMode('METER_READING')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                      usageEntryMode === 'METER_READING' ? 'bg-white shadow-xs text-sky-700' : 'text-slate-500'
                    }`}
                  >
                    Mode B: Meter Reading
                  </button>
                </div>

                {usageEntryMode === 'DIRECT' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Actual Water Usage (Litres) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 42500"
                      value={actualUsageLitres}
                      onChange={(e) => setActualUsageLitres(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Previous Meter (L)</label>
                      <input
                        type="number"
                        placeholder="e.g. 12500000"
                        value={prevMeter}
                        onChange={(e) => setPrevMeter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Current Meter (L)</label>
                      <input
                        type="number"
                        placeholder="e.g. 12542500"
                        value={currMeter}
                        onChange={(e) => setCurrMeter(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Collection Date</label>
                    <input
                      type="date"
                      value={collectionDate}
                      onChange={(e) => setCollectionDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Field Notes</label>
                    <input
                      type="text"
                      placeholder="Optional remarks"
                      value={usageNotes}
                      onChange={(e) => setUsageNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button onClick={() => setUsageStep(2)} className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold">
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (computedUsageLitres < 0 || isNaN(computedUsageLitres)) {
                        setUsageError('Please enter a valid water usage quantity.');
                        return;
                      }
                      setUsageError(null);
                      setUsageStep(4);
                    }}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold"
                  >
                    Preview Calculation &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 4: Calculation Preview (Part 1, 10) */}
            {usageStep === 4 && (
              <div className="space-y-4">
                <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-bold text-sky-950 uppercase tracking-wider">Calculation Breakdown</div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Actual Water Consumed:</span>
                      <span className="font-mono font-bold text-slate-900">{formatLitres(computedUsageLitres)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Authoritative Running Rate:</span>
                      <span className="font-mono font-bold text-sky-700">₹{applicableRate.toFixed(2)}/L</span>
                    </div>
                    <div className="pt-2 border-t border-sky-200 flex justify-between text-sm">
                      <span className="font-bold text-slate-900">Total Running Bill:</span>
                      <span className="font-mono font-bold text-emerald-700">{formatCurrency(calculatedPreviewAmount)}</span>
                    </div>
                  </div>
                </div>

                {computedUsageLitres > (parseFloat(eligibility?.approvedLitres) || 0) && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                    <div className="font-bold flex items-center space-x-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>Warning: Usage Exceeds Approved Allocation</span>
                    </div>
                    <p>
                      Approved: {formatLitres(eligibility?.approvedLitres)} &bull; Actual: {formatLitres(computedUsageLitres)}.
                      This usage record will be flagged as <strong>REQUIRES_REVIEW</strong>.
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-2">
                  <button onClick={() => setUsageStep(3)} className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-semibold">
                    Back
                  </button>
                  <button onClick={() => setUsageStep(5)} className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold">
                    Confirm &amp; Save &rarr;
                  </button>
                </div>
              </div>
            )}

            {/* STEP 5: Confirm (Part 10: Save Usage OR Save & Generate Bill) */}
            {usageStep === 5 && (
              <div className="space-y-4">
                <div className="text-center py-4 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-900">Confirm Usage Recording</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    You are recording {formatLitres(computedUsageLitres)} for {selectedAllotment?.name || eligibility?.beneficiaryName} in period {selectedBillingPeriod}.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <button
                    onClick={() =>
                      recordUsageMutation.mutate({
                        allotmentId: selectedAllotment?.allotment_id || eligibility?.allotmentId,
                        billingPeriod: selectedBillingPeriod,
                        usageEntryMode,
                        actualUsageLitres: usageEntryMode === 'DIRECT' ? parseFloat(actualUsageLitres) : undefined,
                        previousMeterReading: usageEntryMode === 'METER_READING' ? parseFloat(prevMeter) : undefined,
                        currentMeterReading: usageEntryMode === 'METER_READING' ? parseFloat(currMeter) : undefined,
                        collectionDate,
                        notes: usageNotes,
                        generateBillImmediately: false,
                      })
                    }
                    disabled={recordUsageMutation.isPending}
                    className="flex-1 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Save Usage Only
                  </button>

                  <button
                    onClick={() =>
                      recordUsageMutation.mutate({
                        allotmentId: selectedAllotment?.allotment_id || eligibility?.allotmentId,
                        billingPeriod: selectedBillingPeriod,
                        usageEntryMode,
                        actualUsageLitres: usageEntryMode === 'DIRECT' ? parseFloat(actualUsageLitres) : undefined,
                        previousMeterReading: usageEntryMode === 'METER_READING' ? parseFloat(prevMeter) : undefined,
                        currentMeterReading: usageEntryMode === 'METER_READING' ? parseFloat(currMeter) : undefined,
                        collectionDate,
                        notes: usageNotes,
                        generateBillImmediately: true,
                      })
                    }
                    disabled={recordUsageMutation.isPending}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md"
                  >
                    Save &amp; Generate Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL: RECORD RUNNING BILL PAYMENT (Part 24, 25) ───────────── */}
      {payModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Record Running Bill Payment</h3>
              </div>
              <button onClick={() => setPayModalBill(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{payError}</span>
              </div>
            )}

            <div className="bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Bill Number:</span>
                <span className="font-mono font-bold text-sky-700">#{payModalBill.bill_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary:</span>
                <span className="font-bold text-slate-900">{payModalBill.beneficiary?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Billing Period:</span>
                <span className="font-mono text-slate-700">{payModalBill.billing_period}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Due:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(payModalBill.amount_due)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Already Paid:</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(payModalBill.amount_paid)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                <span className="font-bold text-slate-900">Remaining Balance:</span>
                <span className="font-mono font-bold text-amber-600">{formatCurrency(payModalBill.pending_amount)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Mode</label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="DD">Demand Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reference / UTR</label>
                  <input
                    type="text"
                    placeholder="Optional for cash"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Collector / Remarks</label>
                <input
                  type="text"
                  placeholder="Field collector name or receipt note"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setPayModalBill(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  payBillMutation.mutate({
                    amount: parseFloat(payAmount),
                    paymentMode: payMode,
                    paymentReference: payRef,
                    remarks: payRemarks,
                  })
                }
                disabled={payBillMutation.isPending || !payAmount}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md"
              >
                {payBillMutation.isPending ? 'Processing...' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BILL DETAILS & CALCULATION BREAKDOWN ───────────────── */}
      {detailBillId && billDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  Running Bill #{billDetail.bill_number}
                </h3>
                <p className="text-xs text-slate-400">Billing Period: {billDetail.billing_period}</p>
              </div>
              <button onClick={() => setDetailBillId(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary:</span>
                <span className="font-bold text-slate-900">{billDetail.beneficiary?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Actual Usage Logged:</span>
                <span className="font-mono font-bold text-slate-900">
                  {billDetail.actual_usage_litres_snapshot ? formatLitres(billDetail.actual_usage_litres_snapshot) : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Running Cost / Litre:</span>
                <span className="font-mono font-bold text-sky-700">₹{billDetail.running_cost_per_litre_snapshot}/L</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tariff Version:</span>
                <span className="font-mono text-slate-700">{billDetail.tariff_version || 'STANDARD'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="font-bold text-slate-900">Total Billed:</span>
                <span className="font-mono font-bold text-slate-900">{formatCurrency(billDetail.amount_due)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-emerald-600">Total Paid:</span>
                <span className="font-mono font-bold text-emerald-600">{formatCurrency(billDetail.amount_paid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-amber-600">Remaining Balance:</span>
                <span className="font-mono font-bold text-amber-600">{formatCurrency(billDetail.pending_amount)}</span>
              </div>
            </div>

            {billDetail.payments && billDetail.payments.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800">Payment Allocations</div>
                <div className="space-y-1 text-xs">
                  {billDetail.payments.map((p: any) => (
                    <div key={p.payment_id} className="flex justify-between p-2 bg-slate-50 rounded-lg font-mono">
                      <span>#{p.receipt_number} ({p.payment_mode})</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setDetailBillId(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BATCH BILL GENERATION CONFIRMATION MODAL ────────────────────── */}
      {showBatchConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Receipt className="w-5 h-5 text-sky-600" />
                <span>Confirm Running Bills Generation</span>
              </h3>
              <button onClick={() => setShowBatchConfirmModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                You are generating authoritative running bills for period <strong>{selectedBillingPeriod}</strong>.
              </p>
              <div className="bg-sky-50 border border-sky-100 p-3 rounded-xl space-y-1 text-slate-800 font-mono text-xs">
                <div>Entered Beneficiaries: <strong>{Object.keys(draftInputs).filter((k) => draftInputs[k]?.trim()).length}</strong></div>
                <div>Billing Period: <strong>{selectedBillingPeriod}</strong></div>
              </div>
              <p className="text-slate-500">
                Only beneficiaries with entered monthly litres will be processed. Un-entered beneficiaries remain pending.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowBatchConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Cancel
              </button>
              <button
                onClick={() => generateBatchBillsMutation.mutate()}
                disabled={generateBatchBillsMutation.isPending}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5"
              >
                {generateBatchBillsMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Generate Bills Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BATCH GENERATION RESULT SUMMARY MODAL ───────────────────────── */}
      {batchResultSummary && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Batch Generation Summary</span>
              </h3>
              <button onClick={() => setBatchResultSummary(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                <div className="text-[10px] text-emerald-700 font-bold uppercase">Generated</div>
                <div className="text-base font-extrabold text-emerald-700 font-mono">{batchResultSummary.generatedCount || 0}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                <div className="text-[10px] text-slate-600 font-bold uppercase">Already Billed</div>
                <div className="text-base font-extrabold text-slate-700 font-mono">{batchResultSummary.alreadyBilledCount || 0}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                <div className="text-[10px] text-amber-700 font-bold uppercase">Out of Tol</div>
                <div className="text-base font-extrabold text-amber-700 font-mono">{batchResultSummary.requiresReviewCount || 0}</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
                <div className="text-[10px] text-rose-700 font-bold uppercase">Failed</div>
                <div className="text-base font-extrabold text-rose-700 font-mono">{batchResultSummary.failedCount || 0}</div>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="py-2 px-3">Beneficiary</th>
                    <th className="py-2 px-3 text-right">Bill Number</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-center">Tolerance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchResultSummary.details?.map((d: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-medium text-slate-900">{d.beneficiaryName || d.allotmentId}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-700">{d.billNumber || d.status}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {d.amountDue !== undefined ? formatCurrency(d.amountDue) : '—'}
                      </td>
                      <td className="py-2 px-3 text-center text-[10px] font-bold">
                        {d.toleranceStatus ? (
                          <span className={d.toleranceStatus === 'WITHIN_TOLERANCE' ? 'text-emerald-600' : 'text-amber-600'}>
                            {d.toleranceStatus}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBatchResultSummary(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
