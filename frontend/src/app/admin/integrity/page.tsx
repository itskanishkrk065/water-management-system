'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
  Droplets,
  Receipt,
  CreditCard,
  Building,
  Info,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KPICard } from '@/components/ui/KPICard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface IntegrityFinding {
  code: string;
  category: 'WATER_APPLICATION' | 'LAND_HOLDING' | 'WATER_ALLOTMENT' | 'BILLING' | 'INSTALLMENT' | 'PAYMENT' | 'FINANCIAL_BALANCE';
  severity: 'PASS' | 'WARNING' | 'ERROR';
  entityId?: string;
  title: string;
  description: string;
  details?: any;
}

interface IntegrityReport {
  timestamp: string;
  summary: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    totalChecks: number;
    passedChecks: number;
    warningChecks: number;
    errorChecks: number;
  };
  findings: IntegrityFinding[];
}

export default function DataIntegrityPage() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const fetchIntegrityReport = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/integrity/check');
      setReport(res.data);
    } catch (err) {
      console.error('Failed to run data integrity audit:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrityReport();
  }, []);

  const categories = [
    { id: 'ALL', label: 'All Checks', icon: ShieldCheck },
    { id: 'WATER_APPLICATION', label: 'Water Applications', icon: Droplets },
    { id: 'LAND_HOLDING', label: 'Land Holdings', icon: Building },
    { id: 'WATER_ALLOTMENT', label: 'Water Allotments', icon: Droplets },
    { id: 'BILLING', label: 'Development Bills', icon: Receipt },
    { id: 'INSTALLMENT', label: 'Installments (5-Stage)', icon: Layers },
    { id: 'PAYMENT', label: 'Payments', icon: CreditCard },
    { id: 'FINANCIAL_BALANCE', label: 'Financial Reconciliation', icon: Receipt },
  ];

  const filteredFindings = (Array.isArray(report?.findings) ? report.findings : []).filter((f) => {
    if (activeCategory === 'ALL') return true;
    return f.category === activeCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Data Integrity & Financial Reconciliation"
        description="Automated diagnostics for land-holding application uniqueness, billing calculations, and payment ledger balances."
        breadcrumbs={[
          { label: 'System & Audit', href: '/dashboard' },
          { label: 'Data Integrity' },
        ]}
        actions={
          <button
            onClick={fetchIntegrityReport}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Auditing Database...' : 'Run Diagnostics'}</span>
          </button>
        }
      />

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Overall Status"
            value={report.summary.status === 'PASS' ? '100% HEALTHY' : report.summary.status}
            icon={report.summary.status === 'PASS' ? CheckCircle2 : AlertTriangle}
            variant={report.summary.status === 'PASS' ? 'emerald' : report.summary.status === 'WARNING' ? 'amber' : 'rose'}
            subtitle={`Checked at ${new Date(report.timestamp).toLocaleTimeString()}`}
          />
          <KPICard
            title="Passed Checks"
            value={report.summary.passedChecks}
            icon={CheckCircle2}
            variant="emerald"
            subtitle="Passing verified invariant rules"
          />
          <KPICard
            title="Warnings"
            value={report.summary.warningChecks}
            icon={AlertTriangle}
            variant="amber"
            subtitle="Items requiring administrative review"
          />
          <KPICard
            title="Data Inconsistencies"
            value={report.summary.errorChecks}
            icon={XCircle}
            variant="rose"
            subtitle="Violations / ledger mismatches"
          />
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
            <p className="font-semibold text-slate-800 text-sm">Auditing database relationships & financial ledgers...</p>
            <p className="text-xs text-slate-400">Verifying water applications, land holdings, bills, and payment records.</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No findings in this category"
            description="All database constraints, uniqueness rules, and calculation ledgers are verified healthy."
          />
        ) : (
          filteredFindings.map((finding, idx) => {
            const isPass = finding.severity === 'PASS';
            const isWarn = finding.severity === 'WARNING';
            const isError = finding.severity === 'ERROR';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border bg-white shadow-xs flex flex-col md:flex-row md:items-start justify-between gap-4 transition ${
                  isPass
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : isWarn
                    ? 'border-amber-200 hover:border-amber-300 bg-amber-50/20'
                    : 'border-rose-200 hover:border-rose-300 bg-rose-50/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                      isPass
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isWarn
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {isPass ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{finding.title}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase ${
                          isPass
                            ? 'bg-emerald-100 text-emerald-800'
                            : isWarn
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {finding.category}
                      </span>
                    </div>

                    <p className="text-slate-600 text-xs mt-1 leading-relaxed">{finding.description}</p>

                    {finding.details && (
                      <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Diagnostic Details:</div>
                        <pre className="whitespace-pre-wrap overflow-x-auto text-[11px]">{JSON.stringify(finding.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                {finding.entityId && (
                  <div className="shrink-0 text-xs text-slate-400 font-mono bg-slate-100 px-2.5 py-1 rounded-md self-start md:self-auto">
                    ID: {finding.entityId.slice(0, 8)}...
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
