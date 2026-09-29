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
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/20 text-sky-400 rounded-xl">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Data Integrity & Financial Reconciliation</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Automated diagnostics for land-holding application uniqueness, billing calculations, and payment balances.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchIntegrityReport}
          disabled={loading}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium shadow transition shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Auditing Database...' : 'Run Diagnostics'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      {report && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overall Status</div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`text-xl font-bold ${
                    report.summary.status === 'PASS'
                      ? 'text-emerald-600'
                      : report.summary.status === 'WARNING'
                      ? 'text-amber-600'
                      : 'text-rose-600'
                  }`}
                >
                  {report.summary.status === 'PASS' ? '100% HEALTHY' : report.summary.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Last checked: {new Date(report.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div
              className={`p-3 rounded-xl ${
                report.summary.status === 'PASS'
                  ? 'bg-emerald-50 text-emerald-600'
                  : report.summary.status === 'WARNING'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {report.summary.status === 'PASS' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : report.summary.status === 'WARNING' ? (
                <AlertTriangle className="w-6 h-6" />
              ) : (
                <XCircle className="w-6 h-6" />
              )}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Passed Checks</div>
              <div className="mt-1 text-2xl font-bold text-emerald-600">{report.summary.passedChecks}</div>
              <div className="text-xs text-slate-400 mt-1">Passing verified rules</div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Warnings</div>
              <div className="mt-1 text-2xl font-bold text-amber-600">{report.summary.warningChecks}</div>
              <div className="text-xs text-slate-400 mt-1">Items requiring review</div>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Data Inconsistencies</div>
              <div className="mt-1 text-2xl font-bold text-rose-600">{report.summary.errorChecks}</div>
              <div className="text-xs text-slate-400 mt-1">Violations / mismatches</div>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <XCircle className="w-6 h-6" />
            </div>
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-3" />
            <p className="font-medium text-slate-700">Auditing database relationships & financial ledgers...</p>
            <p className="text-xs text-slate-400 mt-1">Checking all water applications, land holdings, bills, and payments.</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="font-semibold text-slate-800 text-lg">No findings in this category</p>
            <p className="text-sm text-slate-500 mt-1">All database constraints and calculations are in a healthy state.</p>
          </div>
        ) : (
          filteredFindings.map((finding, idx) => {
            const isPass = finding.severity === 'PASS';
            const isWarn = finding.severity === 'WARNING';
            const isError = finding.severity === 'ERROR';

            return (
              <div
                key={idx}
                className={`p-5 rounded-2xl border bg-white shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-4 transition ${
                  isPass
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : isWarn
                    ? 'border-amber-200 hover:border-amber-300 bg-amber-50/20'
                    : 'border-rose-200 hover:border-rose-300 bg-rose-50/20'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      isPass
                        ? 'bg-emerald-100 text-emerald-700'
                        : isWarn
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {isPass ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : isWarn ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-base">{finding.title}</span>
                      <span
                        className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold uppercase ${
                          isPass
                            ? 'bg-emerald-100 text-emerald-800'
                            : isWarn
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">
                        {finding.category}
                      </span>
                    </div>

                    <p className="text-slate-600 text-sm mt-1.5 leading-relaxed">{finding.description}</p>

                    {finding.details && (
                      <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Diagnostic Data:</div>
                        <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(finding.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>

                {finding.entityId && (
                  <div className="shrink-0 text-xs text-slate-400 font-mono bg-slate-100 px-3 py-1.5 rounded-lg self-start md:self-auto">
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
