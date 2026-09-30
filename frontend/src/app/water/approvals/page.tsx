'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatAcres, formatLitres, formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle2, XCircle, Droplets, ShieldCheck, AlertCircle, X, ArrowRight, FileCheck, Layers } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function WaterApprovalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [approvedLitres, setApprovedLitres] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionRemarks, setRejectionRemarks] = useState('');

  // Fetch submitted applications
  const { data: applications, isLoading } = useQuery({
    queryKey: ['water-approvals-queue'],
    queryFn: async () => {
      const res = await apiClient.get('/water/applications', {
        params: { status: 'SUBMITTED', limit: 50 },
      });
      return res.data?.items || [];
    },
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: async ({ appId, litres, remarks }: { appId: string; litres: number; remarks: string }) => {
      const res = await apiClient.post('/water/allotments/approve', {
        applicationId: appId,
        approvedLitres: litres,
        approvalRemarks: remarks || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['previewAllotment'] });
      setSelectedApp(null);
      setApprovedLitres('');
      setApprovalRemarks('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to approve application');
    },
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ appId, remarks }: { appId: string; remarks: string }) => {
      const res = await apiClient.post('/water/applications/reject', {
        applicationId: appId,
        rejectionRemarks: remarks,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['water-applications'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-holdings'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-water'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiary-land'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiary-overview'] });
      queryClient.invalidateQueries({ queryKey: ['admin-beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['beneficiaries'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setShowRejectModal(false);
      setSelectedApp(null);
      setRejectionRemarks('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to reject application');
    },
  });

  const handleOpenApprove = (app: any) => {
    setSelectedApp(app);
    const totalLand = app.beneficiary?.landHoldings?.reduce(
      (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
      0,
    ) || 0;
    const calculated = totalLand * 10000;
    setApprovedLitres(calculated ? calculated.toString() : app.required_litres);
    setApprovalRemarks('Approved based on regional canal allocation quota');
    setError(null);
  };

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    const litres = parseFloat(approvedLitres);
    if (isNaN(litres) || litres <= 0) {
      setError('Please enter a valid approved quantity in litres');
      return;
    }
    approveMutation.mutate({
      appId: selectedApp.application_id,
      litres,
      remarks: approvalRemarks,
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectionRemarks.trim()) {
      setError('Please provide a mandatory reason for rejection');
      return;
    }
    rejectMutation.mutate({
      appId: selectedApp.application_id,
      remarks: rejectionRemarks.trim(),
    });
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-xl text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-amber-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Administrator Approval Authority Required</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Approving water quotas and generating development billing is restricted to the Administrator role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Water Allotment Approvals Queue"
        description="Review farmer requests, calculate baseline quotas, and atomically approve development billing & 5 installments"
        badge={
          applications?.length > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {applications.length} Pending
            </span>
          ) : undefined
        }
        breadcrumbs={[
          { label: 'Operations', href: '/dashboard' },
          { label: 'Water Management', href: '/water/applications' },
          { label: 'Approvals Queue' },
        ]}
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <LoadingSkeleton rows={5} />
          </div>
        ) : applications && applications.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Submission Date</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Farmer Beneficiary</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Land</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Requested Quota</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Calculated Allotment</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app: any) => {
                  const totalLand =
                    app.beneficiary?.landHoldings?.reduce(
                      (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                      0,
                    ) || 0;
                  const calculated = totalLand * 10000;

                  return (
                    <tr key={app.application_id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{formatDate(app.application_date)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{app.beneficiary?.name}</div>
                        <div className="text-slate-500 text-xs font-mono">{app.beneficiary?.phone_number}</div>
                        <div className="text-slate-400 text-xs">
                          {app.beneficiary?.village?.name}, {app.beneficiary?.district?.name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700">{formatAcres(totalLand)}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatLitres(app.required_litres)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-sky-700">{formatLitres(calculated)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenApprove(app)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                          >
                            Review &amp; Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-lg text-xs font-semibold transition border border-slate-200"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={FileCheck}
            title="No applications awaiting approval"
            description="The administrative review queue is clear. Submitted water applications will appear here for quota determination and atomic billing generation."
          />
        )}
      </div>

      {/* APPROVAL DIALOG MODAL (Section 28 Comparison Display) */}
      {selectedApp && !showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">Approve Water Allotment</h3>
                <p className="text-xs text-slate-500">
                  Beneficiary: <span className="font-semibold text-slate-700">{selectedApp.beneficiary?.name}</span> ({selectedApp.beneficiary?.phone_number})
                </p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Crucial Section 28 Multi-Value Comparison Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-600" />
                <span>Section 28 Allotment Quantity Reconciliation</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Total Land</span>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {formatAcres(
                      selectedApp.beneficiary?.landHoldings?.reduce(
                        (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                        0,
                      ) || 0,
                    )}
                  </div>
                </div>
                <div className="p-3 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[11px] uppercase tracking-wider font-semibold">Litres / Acre Tariff</span>
                  <div className="text-sm font-bold text-slate-900 mt-1">10,000 L / Acre</div>
                </div>
                <div className="p-3 bg-sky-50/70 rounded-lg border border-sky-200">
                  <span className="text-sky-700 block text-[11px] uppercase tracking-wider font-semibold">Calculated Baseline</span>
                  <div className="text-base font-bold text-sky-900 mt-1">
                    {formatLitres(
                      (selectedApp.beneficiary?.landHoldings?.reduce(
                        (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                        0,
                      ) || 0) * 10000,
                    )}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600 block text-[11px] uppercase tracking-wider font-semibold">Farmer Request</span>
                  <div className="text-base font-bold text-slate-800 mt-1">
                    {formatLitres(selectedApp.required_litres)}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Approved Quota (Admin Decision) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="e.g. 45000"
                    value={approvedLitres}
                    onChange={(e) => setApprovedLitres(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-sky-600 rounded-lg text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <span className="absolute right-4 top-3 text-xs font-bold text-slate-400">LITRES</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Administrative quota decision takes precedence over calculated baseline.
                </p>
              </div>

              {/* Estimated Development Cost Preview */}
              {parseFloat(approvedLitres) > 0 && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">Standard Development Tariff:</span>
                    <span className="font-semibold text-slate-900">₹2.00 / Litre</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-emerald-900">Total Development Bill (Atomic):</span>
                    <span className="font-bold text-emerald-700 text-base">
                      {formatCurrency(parseFloat(approvedLitres) * 2.0)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1.5 border-t border-emerald-200/60">
                    Will atomically create 5 installments (Installment #1 = 2.5% ={' '}
                    <span className="font-semibold text-slate-800">{formatCurrency(parseFloat(approvedLitres) * 2.0 * 0.025)}</span>).
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Approval Remarks
                </label>
                <input
                  type="text"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Processing Transaction...' : 'Commit Approval & Generate 5 Installments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {selectedApp && showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Reject Water Application</h3>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedApp(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Mandatory Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Total canal discharge allocation exceeded for this distributary"
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectMutation.isPending}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
