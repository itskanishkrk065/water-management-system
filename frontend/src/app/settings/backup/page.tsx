'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDateTime } from '@/lib/utils';
import {
  Database,
  ShieldCheck,
  ShieldAlert,
  Download,
  RotateCcw,
  RefreshCw,
  HardDrive,
  FileArchive,
  AlertTriangle,
  CheckCircle2,
  X,
  Copy,
  Layers,
  Users,
  Droplet,
  Receipt,
  CreditCard,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';

export default function DatabaseBackupSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Integrity Query
  const { data: integrity, isLoading: integrityLoading, refetch: refetchIntegrity } = useQuery({
    queryKey: ['db-integrity'],
    queryFn: async () => {
      const res = await apiClient.get('/backup/integrity');
      return res.data;
    },
  });

  // Backups List Query
  const { data: backupData, isLoading: backupsLoading, refetch: refetchBackups } = useQuery({
    queryKey: ['db-backups'],
    queryFn: async () => {
      const res = await apiClient.get('/backup/list');
      return res.data;
    },
  });

  // Create Backup Mutation
  const createMutation = useMutation({
    mutationFn: async (backupReason: string) => {
      const res = await apiClient.post('/backup/create', { reason: backupReason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-backups'] });
      setShowCreateModal(false);
      setReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to create system backup');
    },
  });

  // Restore Backup Mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ fileName, restoreReason }: { fileName: string; restoreReason: string }) => {
      const res = await apiClient.post('/backup/restore', { fileName, reason: restoreReason });
      return res.data;
    },
    onSuccess: async (data) => {
      queryClient.cancelQueries();
      queryClient.clear();
      await queryClient.invalidateQueries({ refetchType: 'all' });
      alert(data.message || 'System backup restored successfully.');
      setShowRestoreModal(false);
      setSelectedBackup(null);
      setReason('');
      setActionError(null);
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || 'Failed to restore backup');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const backups = backupData?.backups || [];

  return (
    <div className="space-y-6 max-w-6xl pb-16">
      <PageHeader
        title="Database & System Backup Archives"
        description="Manage local SQLite data files, verify storage integrity, and generate compressed .wmbak disaster recovery archives."
        breadcrumbs={[
          { label: 'System & Audit', href: '/dashboard' },
          { label: 'Backup & Restore' },
        ]}
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                refetchIntegrity();
                refetchBackups();
              }}
              className="p-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 transition shadow-xs"
              title="Refresh Database Status"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => {
                setReason('');
                setActionError(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Create Backup (.wmbak)
            </button>
          </div>
        }
      />

      {/* Database Health & Directory Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Integrity Status Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
              <HardDrive className="w-4 h-4 mr-1.5 text-sky-600" />
              Database Engine & Integrity Status
            </span>
            {integrityLoading ? (
              <span className="text-xs text-slate-400">Verifying...</span>
            ) : integrity?.healthy ? (
              <span className="inline-flex items-center px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Healthy & Consistent
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold rounded-full">
                <ShieldAlert className="w-3.5 h-3.5 mr-1 text-rose-600" /> Attention Required
              </span>
            )}
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Diagnostic Status:</span>
              <span className="font-semibold text-slate-800">{integrity?.details || 'Online'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Local Database Size:</span>
              <span className="font-mono font-bold text-slate-900">
                {integrity?.databaseSize ? `${(integrity.databaseSize / 1024).toFixed(1)} KB` : 'Active'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Storage Architecture:</span>
              <span className="font-semibold text-slate-800">
                Local SQLite WAL Mode with Decimal.js Arithmetic
              </span>
            </div>
          </div>
        </div>

        {/* Local AppData Layout Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center">
            <Database className="w-4 h-4 mr-1.5 text-indigo-600" />
            AppData Storage Directory
          </span>
          <p className="text-xs text-slate-500 leading-relaxed">
            All offline databases, uploaded patta documents, and receipts are isolated in:
          </p>
          <div className="p-2.5 bg-slate-100 rounded-lg text-[11px] font-mono text-slate-700 break-all border border-slate-200">
            %LOCALAPPDATA%\WaterManagement\
          </div>
          <div className="text-[10px] text-slate-400">
            * Uninstallation will NOT delete your user database unless explicitly requested.
          </div>
        </div>
      </div>

      {/* Backups History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Offline Backup Archives (.wmbak)</h3>
            <p className="text-xs text-slate-500">
              Complete snapshots containing SQLite database, patta attachments, and financial ledgers
            </p>
          </div>
          <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold rounded-lg">
            {backups.length} Backups on Disk
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 border-b border-slate-200 font-semibold text-slate-600">
              <tr>
                <th className="px-5 py-3.5">Archive File</th>
                <th className="px-4 py-3.5">Created Date</th>
                <th className="px-4 py-3.5">File Size</th>
                <th className="px-4 py-3.5">Included Records</th>
                <th className="px-4 py-3.5">SHA-256 Checksum</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backupsLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-sky-600" />
                    Scanning local backups directory...
                  </td>
                </tr>
              ) : backups.length > 0 ? (
                backups.map((b: any) => (
                  <tr key={b.fileName} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-4 font-bold text-slate-900 flex items-center space-x-2">
                      <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{b.fileName}</span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDateTime(b.createdAt)}
                    </td>
                    <td className="px-4 py-4 font-mono font-semibold text-slate-800">
                      {(b.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {b.manifest?.counts ? (
                        <div className="space-y-0.5 text-[11px]">
                          <div>{b.manifest.counts.beneficiaries || 0} Beneficiaries</div>
                          <div className="text-slate-400">
                            {b.manifest.counts.payments || 0} Payments • {b.manifest.counts.landHoldings || 0} Land
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">System Snapshot</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-mono text-[10px] text-slate-400">
                      {b.manifest?.database?.sha256 ? (
                        <div className="flex items-center space-x-1">
                          <span>{b.manifest.database.sha256.slice(0, 12)}...</span>
                          <button
                            onClick={() => copyToClipboard(b.manifest.database.sha256)}
                            className="hover:text-slate-700"
                            title="Copy SHA-256 Hash"
                          >
                            {copiedHash === b.manifest.database.sha256 ? (
                              <span className="text-emerald-600 font-sans">Copied!</span>
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedBackup(b);
                          setReason('');
                          setActionError(null);
                          setShowRestoreModal(true);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1 text-rose-500" />
                        Restore...
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No backup archives found. Click "Create Backup (.wmbak)" to generate a restore point.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE BACKUP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-sky-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Download className="w-5 h-5 text-sky-200" />
                <h3 className="font-bold text-base">Generate Offline System Backup</h3>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-sky-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-600 leading-relaxed">
                This will checkpoint the local SQLite database and bundle all beneficiary profiles, land holdings, water allotments, and audit logs into a verified <code className="font-mono text-sky-700 font-bold">.wmbak</code> archive.
              </p>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Backup Note / Justification (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Pre-upgrade routine backup / monthly archival..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={createMutation.isPending}
                  onClick={() => createMutation.mutate(reason)}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Packaging Archive...' : 'Generate .wmbak'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────── */}
      {/* MODAL: RESTORE BACKUP */}
      {/* ──────────────────────────────────────────────────────────── */}
      {showRestoreModal && selectedBackup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-base">Restore System Database</h3>
              </div>
              <button onClick={() => setShowRestoreModal(false)} className="text-rose-200 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-1">
                <div className="font-bold text-xs flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600 shrink-0" />
                  Warning: System Restoration
                </div>
                <p className="text-[11px] leading-relaxed">
                  Restoring will replace the active database with the snapshot from <strong className="font-mono">{selectedBackup.fileName}</strong>. A pre-restore safety copy will be automatically created.
                </p>
              </div>

              {actionError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  {actionError}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Restoration Reason (Mandatory for Audit) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="State the reason for restoring this backup point..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowRestoreModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  disabled={!reason.trim() || restoreMutation.isPending}
                  onClick={() =>
                    restoreMutation.mutate({
                      fileName: selectedBackup.fileName,
                      restoreReason: reason,
                    })
                  }
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow transition disabled:opacity-50"
                >
                  {restoreMutation.isPending ? 'Restoring System...' : 'Confirm Restore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
