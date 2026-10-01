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
} from 'lucide-react';
import StatusBadge from '@/components/ui/StatusBadge';

export default function RunningBillsManager() {
  const queryClient = useQueryClient();

  // Filter & Pagination State
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  // Modal States
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [genPeriod, setGenPeriod] = useState('2026-10');
  const [genStartDate, setGenStartDate] = useState('2026-10-01');
  const [genEndDate, setGenEndDate] = useState('2026-10-31');
  const [genDueDate, setGenDueDate] = useState('2026-11-15');
  const [selectedAllotments, setSelectedAllotments] = useState<string[]>([]);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Detail Modal State
  const [detailBillId, setDetailBillId] = useState<string | null>(null);

  // Payment Modal State
  const [payModalBill, setPayModalBill] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [payCollector, setPayCollector] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payError, setPayError] = useState<string | null>(null);

  // 1. Fetch Summary Metrics
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

  // 2. Fetch Running Bills Table
  const { data: billsData, isLoading: isBillsLoading, isFetching: isBillsFetching, refetch: refetchBills } = useQuery({
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
  });

  // 3. Fetch Districts for Filtering
  const { data: districts } = useQuery({
    queryKey: ['districts-list'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts');
      return res.data || [];
    },
  });

  // 4. Fetch Single Bill Detail
  const { data: selectedBillDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['running-bill-detail', detailBillId],
    queryFn: async () => {
      if (!detailBillId) return null;
      const res = await apiClient.get(`/billing/running-bills/${detailBillId}`);
      return res.data;
    },
    enabled: !!detailBillId,
  });

  // 5. Preview Generation Query
  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } = useQuery({
    queryKey: ['running-bills-preview', genPeriod, genStartDate, genEndDate],
    queryFn: async () => {
      const res = await apiClient.post('/billing/running-bills/preview', {
        billingPeriod: genPeriod,
        billingPeriodStart: genStartDate ? new Date(genStartDate).toISOString() : undefined,
        billingPeriodEnd: genEndDate ? new Date(genEndDate).toISOString() : undefined,
      });
      return res.data;
    },
    enabled: showGenerateModal,
  });

  // 6. Batch Generation Mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/billing/running-bills/batch-generate', {
        billingPeriod: genPeriod,
        billingPeriodStart: genStartDate ? new Date(genStartDate).toISOString() : undefined,
        billingPeriodEnd: genEndDate ? new Date(genEndDate).toISOString() : undefined,
        dueDate: genDueDate ? new Date(genDueDate).toISOString() : undefined,
        allotmentIds: selectedAllotments.length > 0 ? selectedAllotments : undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowGenerateModal(false);
      setSelectedAllotments([]);
      setGenerateError(null);
    },
    onError: (err: any) => {
      setGenerateError(err.response?.data?.message || 'Failed to batch generate running bills');
    },
  });

  // 7. Record Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!payModalBill) return;
      const res = await apiClient.post('/payments/record', {
        runningBillId: payModalBill.running_bill_id,
        beneficiaryId: payModalBill.beneficiary_id,
        amount: Number(payAmount),
        paymentMode: payMode,
        paymentReference: payRef || undefined,
        collectorName: payCollector || undefined,
        remarks: payRemarks || undefined,
        paymentDate: new Date().toISOString(),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['running-bills-list'] });
      queryClient.invalidateQueries({ queryKey: ['running-bills-summary'] });
      queryClient.invalidateQueries({ queryKey: ['running-bill-detail', detailBillId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPayModalBill(null);
      setPayAmount('');
      setPayRef('');
      setPayCollector('');
      setPayRemarks('');
      setPayError(null);
    },
    onError: (err: any) => {
      setPayError(err.response?.data?.message || 'Failed to record payment');
    },
  });

  const handleSelectAllEligible = () => {
    if (!previewData) return;
    const eligibleIds = previewData.filter((p: any) => p.isEligible).map((p: any) => p.allotmentId);
    if (selectedAllotments.length === eligibleIds.length) {
      setSelectedAllotments([]);
    } else {
      setSelectedAllotments(eligibleIds);
    }
  };

  const handleToggleAllotment = (id: string) => {
    setSelectedAllotments((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800">
              Recurring Tariff Engine
            </span>
            <span className="text-xs font-mono text-slate-500">v1.0 Production</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Running Charges &amp; Operations Billing
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Individual commissioning-dated recurring tariffs with effective rate snapshotting
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              refetchSummary();
              refetchBills();
            }}
            disabled={isBillsFetching}
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-2xs"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${isBillsFetching ? 'animate-spin text-sky-600' : ''}`} />
          </button>

          <button
            onClick={() => setShowFilterDrawer(true)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-semibold transition ${
              selectedStatus || selectedBillingPeriod || selectedDistrictId
                ? 'bg-sky-50 border-sky-300 text-sky-700'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {(selectedStatus || selectedBillingPeriod || selectedDistrictId) && (
              <span className="w-2 h-2 rounded-full bg-sky-600"></span>
            )}
          </button>

          <button
            onClick={() => {
              setGenerateError(null);
              setShowGenerateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Generate Running Bills
          </button>
        </div>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Running Bills</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {summary?.totalBills || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Generated cycles</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Current Period</div>
          <div className="text-xl font-bold font-mono text-sky-700 mt-1">
            {formatCurrency(summary?.currentPeriodCharges || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Chargeable sum</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Billed</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {formatCurrency(summary?.totalAmount || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Lifetime charges</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-emerald-700">Total Paid</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            {formatCurrency(summary?.totalPaid || 0)}
          </div>
          <div className="text-[10px] text-emerald-600/70 mt-0.5">Verified collections</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-amber-700">Total Pending</div>
          <div className="text-xl font-bold font-mono text-amber-700 mt-1">
            {formatCurrency(summary?.totalPending || 0)}
          </div>
          <div className="text-[10px] text-amber-600/70 mt-0.5">Outstanding balance</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-rose-700">Overdue Amount</div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">
            {formatCurrency(summary?.overdueAmount || 0)}
          </div>
          <div className="text-[10px] text-rose-600/70 mt-0.5">Past due date</div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Active Farmers</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">
            {summary?.activeBeneficiariesCount || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">In operation cycles</div>
        </div>
      </div>

      {/* Search & Active Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Bill Number (RUN-2026-...), Beneficiary name, or Phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs bg-slate-50/70 border border-slate-200 rounded-xl pl-9 pr-4 py-2 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {(selectedStatus || selectedBillingPeriod || selectedDistrictId || search) && (
          <button
            onClick={() => {
              setSelectedStatus('');
              setSelectedBillingPeriod('');
              setSelectedDistrictId('');
              setSearch('');
              setPage(1);
            }}
            className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1"
          >
            <X className="w-3.5 h-3.5" />
            Clear All Filters
          </button>
        )}
      </div>

      {/* Running Bills Main Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Bill Number</th>
                <th className="py-3 px-3.5">Farmer Beneficiary</th>
                <th className="py-3 px-3.5">Location</th>
                <th className="py-3 px-3.5">Running Start</th>
                <th className="py-3 px-3.5">Billing Period</th>
                <th className="py-3 px-3.5 text-right">Litres</th>
                <th className="py-3 px-3.5 text-right">Rate / L</th>
                <th className="py-3 px-3.5 text-right">Tariff</th>
                <th className="py-3 px-3.5 text-right">Amount Due</th>
                <th className="py-3 px-3.5 text-right">Paid</th>
                <th className="py-3 px-3.5 text-right">Pending</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {isBillsLoading ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-sans">
                    Loading authoritative running bills...
                  </td>
                </tr>
              ) : (billsData?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400 font-sans">
                    No running bills match the current filters.
                  </td>
                </tr>
              ) : (
                (billsData?.items || []).map((b: any) => (
                  <tr key={b.running_bill_id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3.5 font-bold text-slate-900">
                      {b.bill_number || `RUN-${b.running_bill_id.slice(0, 8)}`}
                    </td>
                    <td className="py-3 px-3.5 font-sans">
                      <div className="font-semibold text-slate-900">{b.beneficiary?.name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.beneficiary?.phone_number}</div>
                    </td>
                    <td className="py-3 px-3.5 font-sans text-[11px] text-slate-600">
                      <div>{b.beneficiary?.village?.name || '—'}</div>
                      <div className="text-slate-400 text-[10px]">{b.beneficiary?.district?.name || '—'}</div>
                    </td>
                    <td className="py-3 px-3.5 text-[11px] text-slate-600">
                      {b.running_charge_start_date_snapshot
                        ? formatDate(b.running_charge_start_date_snapshot)
                        : b.allotment?.infrastructure?.running_charge_start_date
                        ? formatDate(b.allotment.infrastructure.running_charge_start_date)
                        : '—'}
                    </td>
                    <td className="py-3 px-3.5 text-sky-800 font-bold">
                      {b.billing_period}
                    </td>
                    <td className="py-3 px-3.5 text-right font-semibold text-slate-700">
                      {formatLitres(b.approved_litres_snapshot)}
                    </td>
                    <td className="py-3 px-3.5 text-right text-slate-600">
                      ₹{Number(b.running_cost_per_litre_snapshot).toFixed(2)}
                    </td>
                    <td className="py-3 px-3.5 text-right text-[11px] text-slate-500 font-sans">
                      {b.tariff_version || b.rate?.version_code || 'STANDARD'}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-slate-900">
                      {formatCurrency(b.amount_due)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-semibold text-emerald-700">
                      {formatCurrency(b.amount_paid)}
                    </td>
                    <td className="py-3 px-3.5 text-right font-bold text-amber-700">
                      {formatCurrency(b.pending_amount)}
                    </td>
                    <td className="py-3 px-3.5 text-center font-sans">
                      <StatusBadge status={b.status} size="sm" />
                    </td>
                    <td className="py-3 px-3.5 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetailBillId(b.running_bill_id)}
                          className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition"
                          title="View Bill Breakdown & Calculation"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {Number(b.pending_amount) > 0 && (
                          <button
                            onClick={() => {
                              setPayModalBill(b);
                              setPayAmount(String(b.pending_amount));
                              setPayError(null);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold rounded-lg transition"
                          >
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
          <div>
            Showing <span className="font-semibold text-slate-700">{(billsData?.items || []).length}</span> of{' '}
            <span className="font-semibold text-slate-700">{billsData?.meta?.total || 0}</span> bills
          </div>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-medium transition"
            >
              Previous
            </button>
            <span className="font-mono px-2 font-semibold text-slate-700">
              Page {page} of {billsData?.meta?.totalPages || 1}
            </span>
            <button
              disabled={page >= (billsData?.meta?.totalPages || 1)}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 bg-white border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 font-medium transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* GENERATE RUNNING BILLS MODAL (With Live Preview & Multi-Tier Tariff Breakdown) */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Generate Running Charges Billing</h3>
                <p className="text-xs text-slate-500">
                  Pre-validated generation adhering strictly to individual commissioning &amp; running start dates
                </p>
              </div>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
              {/* Parameter Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Billing Period Code</label>
                  <input
                    type="text"
                    value={genPeriod}
                    onChange={(e) => setGenPeriod(e.target.value)}
                    placeholder="e.g. 2026-10 or 2026-Q4"
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period Start</label>
                  <input
                    type="date"
                    value={genStartDate}
                    onChange={(e) => setGenStartDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Period End</label>
                  <input
                    type="date"
                    value={genEndDate}
                    onChange={(e) => setGenEndDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Due Date</label>
                  <input
                    type="date"
                    value={genDueDate}
                    onChange={(e) => setGenDueDate(e.target.value)}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2"
                  />
                </div>
              </div>

              {generateError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{generateError}</span>
                </div>
              )}

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Allotment Population &amp; Eligibility Evaluation ({previewData?.length || 0})
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllEligible}
                    className="text-xs text-sky-700 font-semibold hover:underline"
                  >
                    Select All Eligible ({previewData?.filter((p: any) => p.isEligible).length || 0})
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-[10px] uppercase font-semibold text-slate-600 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3 w-8">
                          <input
                            type="checkbox"
                            checked={
                              previewData &&
                              previewData.filter((p: any) => p.isEligible).length > 0 &&
                              selectedAllotments.length === previewData.filter((p: any) => p.isEligible).length
                            }
                            onChange={handleSelectAllEligible}
                            className="rounded text-sky-600"
                          />
                        </th>
                        <th className="py-2.5 px-3">Beneficiary</th>
                        <th className="py-2.5 px-3">Commissioned</th>
                        <th className="py-2.5 px-3">Running Start</th>
                        <th className="py-2.5 px-3 text-right">Quota (L)</th>
                        <th className="py-2.5 px-3 text-right">Rate / L</th>
                        <th className="py-2.5 px-3 text-right">Calculated</th>
                        <th className="py-2.5 px-3 text-center">Eligibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {isPreviewLoading ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                            Evaluating individual start dates &amp; tariffs...
                          </td>
                        </tr>
                      ) : (previewData || []).map((item: any) => (
                        <tr
                          key={item.allotmentId}
                          className={`hover:bg-slate-50 ${!item.isEligible ? 'opacity-60 bg-slate-50/50' : ''}`}
                        >
                          <td className="py-2.5 px-3">
                            <input
                              type="checkbox"
                              disabled={!item.isEligible}
                              checked={selectedAllotments.includes(item.allotmentId)}
                              onChange={() => handleToggleAllotment(item.allotmentId)}
                              className="rounded text-sky-600"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-sans">
                            <div className="font-semibold text-slate-900">{item.beneficiaryName}</div>
                            <div className="text-[10px] text-slate-400">{item.villageName}</div>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {item.commissionedDate ? formatDate(item.commissionedDate) : 'Not Commissioned'}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {item.runningChargeStartDate ? formatDate(item.runningChargeStartDate) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                            {formatLitres(item.approvedLitres)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-600">
                            ₹{Number(item.runningRatePerLitre).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatCurrency(item.calculatedAmount)}
                          </td>
                          <td className="py-2.5 px-3 text-center font-sans">
                            {item.isEligible ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                <Check className="w-3 h-3" /> Eligible
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md"
                                title={item.ineligibilityReason}
                              >
                                {item.ineligibilityReason}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-600">
                Selected <span className="font-bold text-slate-900">{selectedAllotments.length}</span> eligible bills
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedAllotments.length === 0 || generateMutation.isPending}
                  onClick={() => generateMutation.mutate()}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl shadow-xs transition disabled:opacity-50"
                >
                  {generateMutation.isPending ? 'Generating Bills...' : `Confirm & Generate (${selectedAllotments.length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL WITH CALCULATION BREAKDOWN & PAYMENT HISTORY */}
      {detailBillId && selectedBillDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <span className="text-[10px] font-mono font-bold text-sky-700 uppercase tracking-wider">
                  Running Charge Bill Details
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  {selectedBillDetail.bill_number || `RUN-${selectedBillDetail.running_bill_id.slice(0, 8)}`}
                </h3>
              </div>
              <button
                onClick={() => setDetailBillId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar text-xs">
              {/* Beneficiary & Infrastructure Grid */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Beneficiary Details</div>
                  <div className="text-sm font-bold text-slate-900 mt-1">{selectedBillDetail.beneficiary?.name}</div>
                  <div className="text-slate-500 font-mono mt-0.5">{selectedBillDetail.beneficiary?.phone_number}</div>
                  <div className="text-slate-600 mt-1">
                    {selectedBillDetail.beneficiary?.village?.name}, {selectedBillDetail.beneficiary?.district?.name}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Infrastructure &amp; Usage</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Commissioned:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedBillDetail.commissioned_date_snapshot
                          ? formatDate(selectedBillDetail.commissioned_date_snapshot)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Running Start Date:</span>
                      <span className="font-semibold text-sky-800">
                        {selectedBillDetail.running_charge_start_date_snapshot
                          ? formatDate(selectedBillDetail.running_charge_start_date_snapshot)
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Billing Period:</span>
                      <span className="font-bold text-slate-900">{selectedBillDetail.billing_period}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Authoritative Calculation Formula Breakdown */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  Authoritative Tariff Calculation Basis
                </div>
                <div className="bg-sky-50/60 border border-sky-200 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Approved Water Allotment:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {formatLitres(selectedBillDetail.approved_litres_snapshot)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Applicable Running Tariff:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ₹{Number(selectedBillDetail.running_cost_per_litre_snapshot).toFixed(2)} / L
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">Tariff Version Code:</span>
                    <span className="font-mono text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {selectedBillDetail.tariff_version || selectedBillDetail.rate?.version_code || 'STANDARD'}
                    </span>
                  </div>

                  {selectedBillDetail.calculation_breakdown && (
                    <div className="pt-2 border-t border-sky-200/80">
                      <div className="text-[10px] font-semibold text-slate-500 uppercase mb-1">
                        Multi-Tier Period Splitting Breakdown
                      </div>
                      <div className="space-y-1">
                        {JSON.parse(selectedBillDetail.calculation_breakdown).map((comp: any, cIdx: number) => (
                          <div key={cIdx} className="flex items-center justify-between text-[11px] font-mono bg-white p-2 rounded-lg border border-slate-100">
                            <span>
                              {comp.periodLabel} ({comp.days}/{comp.totalDays} days) @ ₹{comp.runningRatePerLitre}/L
                            </span>
                            <span className="font-bold text-slate-900">₹{comp.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-sky-200 flex items-center justify-between text-sm font-bold">
                    <span className="text-slate-900">Total Billed Running Charge:</span>
                    <span className="font-mono text-sky-800">{formatCurrency(selectedBillDetail.amount_due)}</span>
                  </div>
                </div>
              </div>

              {/* Financial Status */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] text-slate-500">Gross Amount</div>
                  <div className="text-base font-bold font-mono text-slate-900">
                    {formatCurrency(selectedBillDetail.amount_due)}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="text-[10px] text-emerald-700">Total Paid</div>
                  <div className="text-base font-bold font-mono text-emerald-700">
                    {formatCurrency(selectedBillDetail.amount_paid)}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="text-[10px] text-amber-700">Pending Balance</div>
                  <div className="text-base font-bold font-mono text-amber-700">
                    {formatCurrency(selectedBillDetail.pending_amount)}
                  </div>
                </div>
              </div>

              {/* Payment Receipts History */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  Payment Ledger Receipts ({(selectedBillDetail.payments || []).length})
                </div>
                {(selectedBillDetail.payments || []).length === 0 ? (
                  <div className="p-4 text-center bg-slate-50 rounded-xl text-slate-400">
                    No payment records logged for this running bill yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden font-mono text-xs">
                    {(selectedBillDetail.payments || []).map((p: any) => (
                      <div key={p.payment_id} className="p-3 bg-white flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900">Receipt #{p.receipt_number}</div>
                          <div className="text-[11px] text-slate-400 font-sans">
                            {formatDate(p.payment_date)} • {p.payment_mode}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-700">{formatCurrency(p.amount)}</div>
                          <StatusBadge status={p.status} size="sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => setDetailBillId(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-100"
              >
                Close
              </button>
              {Number(selectedBillDetail.pending_amount) > 0 && (
                <button
                  onClick={() => {
                    setPayModalBill(selectedBillDetail);
                    setPayAmount(String(selectedBillDetail.pending_amount));
                    setDetailBillId(null);
                  }}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs"
                >
                  Record Payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {payModalBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Record Running Bill Payment</h3>
              <button onClick={() => setPayModalBill(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Bill Number:</span>
                <span className="font-bold text-slate-900">
                  {payModalBill.bill_number || `RUN-${payModalBill.running_bill_id.slice(0, 8)}`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Beneficiary:</span>
                <span className="font-semibold text-slate-900">{payModalBill.beneficiary?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Outstanding Balance:</span>
                <span className="font-bold text-amber-700 font-mono">
                  {formatCurrency(payModalBill.pending_amount)}
                </span>
              </div>
            </div>

            {payError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {payError}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                paymentMutation.mutate();
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(payModalBill.pending_amount)}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className="w-full text-sm font-mono rounded-xl border-slate-300 py-2 px-3 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full rounded-xl border-slate-300 py-2 px-3"
                >
                  <option value="CASH">CASH</option>
                  <option value="BANK_TRANSFER">BANK / NEFT</option>
                  <option value="CHEQUE">CHEQUE</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>

              {payMode !== 'CASH' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference / UTR / Cheque Number</label>
                  <input
                    type="text"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    placeholder="e.g. UTR-987654321"
                    className="w-full rounded-xl border-slate-300 py-2 px-3 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Collector Officer Name</label>
                <input
                  type="text"
                  value={payCollector}
                  onChange={(e) => setPayCollector(e.target.value)}
                  placeholder="e.g. Accounts Officer"
                  className="w-full rounded-xl border-slate-300 py-2 px-3"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  value={payRemarks}
                  onChange={(e) => setPayRemarks(e.target.value)}
                  placeholder="e.g. Received running water charge payment"
                  className="w-full rounded-xl border-slate-300 py-2 px-3"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayModalBill(null)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {paymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FILTER DRAWER / MODAL */}
      {showFilterDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/40 backdrop-blur-2xs">
          <div className="bg-white w-full max-w-sm h-full p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-base font-bold text-slate-900">Filter Running Bills</h3>
                <button onClick={() => setShowFilterDrawer(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full rounded-xl border-slate-300 py-2 px-3"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                    <option value="PAID">PAID</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Period</label>
                  <input
                    type="text"
                    value={selectedBillingPeriod}
                    onChange={(e) => setSelectedBillingPeriod(e.target.value)}
                    placeholder="e.g. 2026-10"
                    className="w-full font-mono rounded-xl border-slate-300 py-2 px-3"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District</label>
                  <select
                    value={selectedDistrictId}
                    onChange={(e) => setSelectedDistrictId(e.target.value)}
                    className="w-full rounded-xl border-slate-300 py-2 px-3"
                  >
                    <option value="">All Districts</option>
                    {(districts || []).map((d: any) => (
                      <option key={d.district_id} value={d.district_id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setSelectedStatus('');
                  setSelectedBillingPeriod('');
                  setSelectedDistrictId('');
                  setShowFilterDrawer(false);
                }}
                className="flex-1 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
              <button
                onClick={() => {
                  setPage(1);
                  setShowFilterDrawer(false);
                }}
                className="flex-1 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold hover:bg-sky-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
