'use client';

import React, { useState, useEffect } from 'react';
import { CleanStatePreview, DeveloperApi } from '@/lib/developer-api';
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  Database,
  FileCheck,
  HardDrive,
  Layers,
  History,
  X,
  RefreshCw,
  Sliders,
} from 'lucide-react';

interface CleanStateTabProps {
  environment: string;
  isProduction: boolean;
  onRefreshTelemetry: () => void;
}

export function CleanStateTab({ environment, isProduction, onRefreshTelemetry }: CleanStateTabProps) {
  const [selectedMode, setSelectedMode] = useState<string>('EMPTY_CLEAN_STATE');
  const [selectedModules, setSelectedModules] = useState<string[]>(['PAYMENTS', 'BILLING']);
  const [previewData, setPreviewData] = useState<CleanStatePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Execution State
  const [confirmationPhrase, setConfirmationPhrase] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [executing, setExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);

  // Verification & Audit History
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [verificationData, setVerificationData] = useState<any | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  // Fetch Audit Logs
  const loadAuditLogs = async () => {
    try {
      setLoadingAudit(true);
      const logs = await DeveloperApi.getCleanStateAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const handleOpenPreview = async (mode: string) => {
    try {
      setSelectedMode(mode);
      setLoadingPreview(true);
      setExecutionResult(null);
      setExecutionError(null);
      setConfirmationPhrase('');
      const preview = await DeveloperApi.getCleanStatePreview(
        mode,
        mode === 'MODULE_RESET' ? selectedModules : undefined
      );
      setPreviewData(preview);
      setShowPreviewModal(true);
    } catch (err: any) {
      alert(`Failed to load reset preview: ${err.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExecuteReset = async () => {
    if (confirmationPhrase !== 'RESET DATABASE') {
      alert('You must type exactly "RESET DATABASE" to confirm.');
      return;
    }

    try {
      setExecuting(true);
      setExecutionError(null);
      const result = await DeveloperApi.executeCleanState(
        selectedMode,
        confirmationPhrase,
        reason || 'Clean state protocol reset via developer console',
        selectedMode === 'MODULE_RESET' ? selectedModules : undefined
      );
      setExecutionResult(result);
      setShowPreviewModal(false);
      onRefreshTelemetry();
      loadAuditLogs();
    } catch (err: any) {
      setExecutionError(err.response?.data?.message || err.message || 'Clean state execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      const res = await DeveloperApi.verifyCleanState();
      setVerificationData(res);
    } catch (err: any) {
      alert(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  };

  const toggleModule = (mod: string) => {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    );
  };

  return (
    <div className="space-y-6">
      {/* Production Warning Notice */}
      {isProduction ? (
        <div className="p-4 bg-rose-950/70 border border-rose-800 rounded-xl flex items-center justify-between text-rose-200 font-mono text-xs">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-white uppercase block">
                PRODUCTION ENVIRONMENT LOCKED
              </span>
              <span>
                Clean State operations are strictly disabled while in PRODUCTION environment classification to protect live water records.
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-center justify-between text-amber-200 font-mono text-xs">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-white uppercase block">
                CONTROLLED CLEAN STATE PROTOCOL (DEV / TEST)
              </span>
              <span>
                All reset operations enforce mandatory pre-reset safety backups and transactional rollbacks with post-reset integrity verification.
              </span>
            </div>
          </div>
          <button
            onClick={handleRunVerification}
            disabled={verifying}
            className="px-3 py-1.5 rounded bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700 flex items-center gap-1.5 font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${verifying ? 'animate-spin' : ''}`} />
            <span>Verify Clean State</span>
          </button>
        </div>
      )}

      {/* Verification Status Banner */}
      {verificationData && (
        <div
          className={`p-4 rounded-xl border text-xs font-mono flex items-center justify-between ${
            verificationData.status === 'CLEAN_STATE_VERIFIED'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-amber-950/60 border-amber-800 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <span className="font-bold uppercase text-white block">
                {verificationData.status.replace(/_/g, ' ')}
              </span>
              <span>
                Integrity: {verificationData.integrityCheck} • FK Violations: {verificationData.foreignKeyViolations} • Active Districts: {verificationData.activeDistricts}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Checked at {new Date(verificationData.verifiedAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Execution Result Banner */}
      {executionResult && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs font-mono text-emerald-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>CLEAN STATE RESET EXECUTED SUCCESSFULLY</span>
          </div>
          <p className="text-slate-300">{executionResult.message}</p>
          <div className="p-2.5 bg-slate-950 rounded border border-emerald-900/80 text-[11px] text-emerald-300">
            Safety Backup Created: <strong className="text-white">{executionResult.safetyBackup?.fileName}</strong> (
            {(executionResult.safetyBackup?.sizeBytes / 1024).toFixed(1)} KB)
          </div>
        </div>
      )}

      {/* Reset Modes Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mode A: Empty Clean State */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                MODE A
              </span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <h3 className="text-sm font-mono font-bold text-white">EMPTY CLEAN STATE</h3>
            <p className="text-xs font-mono text-slate-400">
              Wipes all farmer beneficiaries, land holdings, water applications, bills, installments, and payments. Preserves district master data, tariffs, roles, and admin account.
            </p>
          </div>
          <button
            onClick={() => handleOpenPreview('EMPTY_CLEAN_STATE')}
            disabled={isProduction || loadingPreview}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-emerald-950/80 text-emerald-400 border border-slate-700 hover:border-emerald-700 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preview Empty Clean Reset</span>
          </button>
        </div>

        {/* Mode B: Demo Clean State */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                MODE B
              </span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <h3 className="text-sm font-mono font-bold text-white">DEMO CLEAN STATE</h3>
            <p className="text-xs font-mono text-slate-400">
              Resets database and initializes verified synthetic demo records (demo beneficiary, holdings, approved water application, 5-installment billing schedule, and infrastructure).
            </p>
          </div>
          <button
            onClick={() => handleOpenPreview('DEMO_CLEAN_STATE')}
            disabled={isProduction || loadingPreview}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-indigo-950/80 text-indigo-300 border border-slate-700 hover:border-indigo-700 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preview Demo State Reset</span>
          </button>
        </div>

        {/* Mode C: Modular Reset */}
        <div className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                MODE C
              </span>
              <Sliders className="w-4 h-4 text-amber-400" />
            </div>
            <h3 className="text-sm font-mono font-bold text-white">MODULE RESET</h3>
            <p className="text-xs font-mono text-slate-400">
              Selective modular reset. Enforces dependency order to prevent foreign-key violations.
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              {['PAYMENTS', 'BILLING', 'WATER_APPLICATIONS', 'LAND_HOLDINGS', 'INFRASTRUCTURE'].map(
                (mod) => (
                  <button
                    key={mod}
                    onClick={() => toggleModule(mod)}
                    className={`px-2 py-1 rounded text-left border transition ${
                      selectedModules.includes(mod)
                        ? 'bg-amber-950/60 border-amber-700 text-amber-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    {selectedModules.includes(mod) ? '✓ ' : '+ '}
                    {mod}
                  </button>
                )
              )}
            </div>
          </div>
          <button
            onClick={() => handleOpenPreview('MODULE_RESET')}
            disabled={isProduction || selectedModules.length === 0 || loadingPreview}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-amber-950/80 text-amber-300 border border-slate-700 hover:border-amber-700 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preview Modular Reset</span>
          </button>
        </div>

        {/* Mode D: Full Application Reset */}
        <div className="bg-slate-900/90 border border-rose-900/50 hover:border-rose-700 rounded-xl p-5 flex flex-col justify-between shadow-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                MODE D (MAX DESTRUCTIVE)
              </span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <h3 className="text-sm font-mono font-bold text-white">FULL APPLICATION RESET</h3>
            <p className="text-xs font-mono text-slate-400">
              Restores application database to fresh installation state. Erases all non-system users, business records, and sessions while preserving database binaries, Electron, and system schema.
            </p>
          </div>
          <button
            onClick={() => handleOpenPreview('FULL_APPLICATION_RESET')}
            disabled={isProduction || loadingPreview}
            className="mt-4 w-full py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900 text-rose-300 border border-rose-800 font-mono text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Preview Full App Reset</span>
          </button>
        </div>
      </div>

      {/* Live Safety Preview Modal */}
      {showPreviewModal && previewData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-mono font-bold text-white uppercase">
                  CLEAN STATE SAFETY PREVIEW — {previewData.mode}
                </h3>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs font-mono">
              {/* Database & Footprint info */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-400 block">Target Database:</span>
                  <span className="text-slate-200 select-all">{previewData.databasePath}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block">Footprint:</span>
                  <span className="text-cyan-400 font-bold">{previewData.databaseSizeFormatted}</span>
                </div>
              </div>

              {/* Current Active Record Counts */}
              <div>
                <span className="text-slate-400 font-bold uppercase tracking-wider block mb-2">
                  Current Database Records
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(previewData.currentRecords).map(([entity, count]) => (
                    <div key={entity} className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 capitalize">{entity}:</span>
                      <span className="text-white font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Will Remove vs Will Preserve */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded bg-rose-950/30 border border-rose-900/60 text-rose-300">
                  <span className="font-bold block mb-1">WILL BE REMOVED:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                    {previewData.willRemove.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded bg-emerald-950/30 border border-emerald-900/60 text-emerald-300">
                  <span className="font-bold block mb-1">WILL BE PRESERVED:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                    {previewData.willPreserve.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Safety Backup Guarantee */}
              <div className="p-3 rounded bg-indigo-950/40 border border-indigo-800 text-indigo-300">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <FileCheck className="w-4 h-4 text-indigo-400" />
                  <span>MANDATORY PRE-RESET SAFETY BACKUP</span>
                </div>
                <p className="text-[11px] text-slate-300">{previewData.safetyBackupNote}</p>
              </div>

              {/* Confirmation Input Phrase */}
              <div className="p-4 bg-slate-950 rounded-xl border border-rose-800/80 space-y-3">
                <label className="block text-rose-300 font-bold">
                  TYPE <span className="text-white bg-rose-950 px-1.5 py-0.5 rounded border border-rose-700">RESET DATABASE</span> TO CONFIRM:
                </label>
                <input
                  type="text"
                  placeholder="RESET DATABASE"
                  value={confirmationPhrase}
                  onChange={(e) => setConfirmationPhrase(e.target.value)}
                  className="w-full p-2.5 bg-slate-900 border border-rose-700 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-rose-500"
                />
                <input
                  type="text"
                  placeholder="Reason / Audit Note (Optional)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                />
              </div>

              {executionError && (
                <div className="p-3 bg-rose-950 border border-rose-800 rounded-lg text-rose-300 text-xs">
                  {executionError}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteReset}
                disabled={confirmationPhrase !== 'RESET DATABASE' || executing}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold transition disabled:opacity-40 shadow-lg"
              >
                {executing ? 'Creating Backup & Executing Reset...' : 'Create Backup & Execute Reset'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Clean State Audit Trail */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              CLEAN STATE PROTOCOL AUDIT TRAIL (PERSISTENT DISK LOG)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">{auditLogs.length} events recorded</span>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
          {loadingAudit ? (
            <div className="p-4 text-center text-xs font-mono text-slate-500">Loading audit history...</div>
          ) : auditLogs.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-slate-500">
              No previous clean-state reset operations recorded.
            </div>
          ) : (
            auditLogs.map((log, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 font-bold">
                      {log.mode}
                    </span>
                    <span className="text-white font-semibold">{log.reason}</span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    Backup: <span className="text-slate-300">{log.safetyBackupFilename}</span> • By {log.userId}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold block mb-1">
                    {log.verificationStatus || 'VERIFIED'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
