'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatAcres, formatLitres, formatCurrency, formatDate } from '@/lib/utils';
import { CheckCircle, XCircle, Droplet, ShieldCheck, AlertCircle, X } from 'lucide-react';
import Link from 'next/link';

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['water-approvals-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
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
    // Suggest calculated allotment as starting point, but user explicitly edits it
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
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl text-center space-y-3">
        <ShieldCheck className="w-12 h-12 text-amber-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Administrator Approval Authority Required</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Approving water quotas and generating development billing is restricted to the ADMIN role.
          You can use the role switcher in the top navigation to switch to ADMIN.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Water Allotment Approvals Queue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review farmer requests, calculate baseline quotas, and atomically approve development billing &amp; 5 installments
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Submission Date</th>
                <th className="px-5 py-3.5">Farmer Beneficiary</th>
                <th className="px-5 py-3.5">Total Land</th>
                <th className="px-5 py-3.5">Required Litres (Request)</th>
                <th className="px-5 py-3.5">Calculated Allotment</th>
                <th className="px-5 py-3.5 text-right">Administrative Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading approval queue...
                  </td>
                </tr>
              ) : applications && applications.length > 0 ? (
                applications.map((app: any) => {
                  const totalLand =
                    app.beneficiary?.landHoldings?.reduce(
                      (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                      0,
                    ) || 0;
                  const calculated = totalLand * 10000;

                  return (
                    <tr key={app.application_id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-mono text-slate-600">{formatDate(app.application_date)}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div>{app.beneficiary?.name}</div>
                        <div className="text-slate-400 text-[11px] font-mono">{app.beneficiary?.phone_number}</div>
                        <div className="text-slate-500 text-[11px]">
                          {app.beneficiary?.village?.name}, {app.beneficiary?.district?.name}
                        </div>
                      </td>
                      <td className="px-5 py-4 font-bold text-emerald-700">{formatAcres(totalLand)}</td>
                      <td className="px-5 py-4 font-bold text-sky-700 text-sm">
                        {formatLitres(app.required_litres)}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{formatLitres(calculated)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenApprove(app)}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold transition"
                          >
                            Review &amp; Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedApp(app);
                              setShowRejectModal(true);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg font-semibold transition"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No applications currently awaiting approval in the queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVAL DIALOG MODAL (Section 28 Comparison Display) */}
      {selectedApp && !showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Approve Water Allotment</h3>
                <p className="text-xs text-slate-500">
                  Beneficiary: {selectedApp.beneficiary?.name} ({selectedApp.beneficiary?.phone_number})
                </p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Crucial Section 28 Multi-Value Comparison Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Section 28 Allotment Quantity Reconciliation
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400">Total Verified Land</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    {formatAcres(
                      selectedApp.beneficiary?.landHoldings?.reduce(
                        (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                        0,
                      ) || 0,
                    )}
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400">Litres / Acre Snapshot</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">10,000 L</div>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
                  <span className="text-sky-700 font-semibold">Calculated Allotted</span>
                  <div className="text-base font-bold text-sky-800 mt-0.5">
                    {formatLitres(
                      (selectedApp.beneficiary?.landHoldings?.reduce(
                        (acc: number, h: any) => acc + (parseFloat(h.declared_total_area) || 0),
                        0,
                      ) || 0) * 10000,
                    )}
                  </div>
                </div>
                <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-700 font-semibold">Beneficiary Requirement (Request)</span>
                  <div className="text-base font-bold text-blue-800 mt-0.5">
                    {formatLitres(selectedApp.required_litres)}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">
                  Approved Quantity (Admin Decision) *
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
                <p className="text-[11px] text-slate-500 mt-1">
                  Do not automatically set equal to calculated allotment. Administrator decides approved quota.
                </p>
              </div>

              {/* Estimated Development Cost Preview */}
              {parseFloat(approvedLitres) > 0 && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Development Cost Rate:</span>
                    <span className="font-semibold text-slate-900">₹2.00 / Litre</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-emerald-900">Total Development Bill (Atomic):</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(parseFloat(approvedLitres) * 2.0)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60">
                    Will atomically generate 5 installments (Stage 1 = 2.5% ={' '}
                    {formatCurrency(parseFloat(approvedLitres) * 2.0 * 0.025)}).
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
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Reject Water Application</h3>
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
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
