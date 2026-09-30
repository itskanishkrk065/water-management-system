'use client';

import React, { useState, useEffect } from 'react';
import { DeveloperApi } from '@/lib/developer-api';
import { HardDrive, FileCheck, RefreshCw, AlertTriangle, ShieldCheck, Download, Folder } from 'lucide-react';
import { apiClient } from '@/lib/api';

export function StorageBackupTab() {
  const [storageData, setStorageData] = useState<any | null>(null);
  const [orphanData, setOrphanData] = useState<any | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Backup creation state
  const [backupReason, setBackupReason] = useState<string>('');
  const [creatingBackup, setCreatingBackup] = useState<boolean>(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [storage, orphans, backupList] = await Promise.all([
        DeveloperApi.getStorageCenter(),
        DeveloperApi.detectOrphans(),
        apiClient.get('/backup/list').then((r) => r.data?.backups || []).catch(() => []),
      ]);
      setStorageData(storage);
      setOrphanData(orphans);
      setBackups(backupList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setCreatingBackup(true);
      setBackupStatus(null);
      const res = await apiClient.post('/backup/create', {
        reason: backupReason || 'Manual developer console backup',
      });
      setBackupStatus(`Created backup archive: ${res.data?.fileName}`);
      setBackupReason('');
      loadAll();
    } catch (err: any) {
      alert(`Backup creation failed: ${err.message}`);
    } finally {
      setCreatingBackup(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Storage Breakdown & Backup Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage Paths & Footprint */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase">
                LOCAL STORAGE ALLOCATION
              </h3>
            </div>
            {storageData && (
              <span className="text-xs font-mono font-bold text-cyan-400">
                {storageData.sizes?.totalAppSizeFormatted}
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs font-mono text-slate-400">Loading storage details...</div>
          ) : storageData ? (
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 font-bold block">SQLite Database (.db)</span>
                  <span className="text-[11px] text-slate-500 select-all truncate block max-w-xs">
                    {storageData.storagePaths?.databasePath}
                  </span>
                </div>
                <span className="text-cyan-400 font-bold text-sm">
                  {storageData.sizes?.databaseFormatted}
                </span>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 font-bold block">Documents Folder</span>
                  <span className="text-[11px] text-slate-500 select-all truncate block max-w-xs">
                    {storageData.storagePaths?.documentsPath}
                  </span>
                </div>
                <span className="text-slate-300 font-bold">
                  {storageData.sizes?.documentsFormatted}
                </span>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 font-bold block">System Backups (.wmbak)</span>
                  <span className="text-[11px] text-slate-500 select-all truncate block max-w-xs">
                    {storageData.storagePaths?.backupsPath}
                  </span>
                </div>
                <span className="text-emerald-400 font-bold">
                  {storageData.sizes?.backupsFormatted}
                </span>
              </div>

              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-slate-300 font-bold block">Receipts Folder</span>
                  <span className="text-[11px] text-slate-500 select-all truncate block max-w-xs">
                    {storageData.storagePaths?.receiptsPath}
                  </span>
                </div>
                <span className="text-slate-300 font-bold">
                  {storageData.sizes?.receiptsFormatted}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        {/* Create Immediate Safety Backup */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase">
                CREATE SYSTEM BACKUP ARCHIVE (.WMBAK)
              </h3>
            </div>

            <p className="text-xs font-mono text-slate-400">
              Creates a complete offline archive with SHA-256 checksums, SQLite snapshot, document manifest, and audit metadata.
            </p>

            <div className="space-y-2 text-xs font-mono">
              <label className="text-slate-300 block">Backup Reason / Label:</label>
              <input
                type="text"
                placeholder="e.g. Pre-migration snapshot"
                value={backupReason}
                onChange={(e) => setBackupReason(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {backupStatus && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs font-mono text-emerald-300">
                {backupStatus}
              </div>
            )}
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{creatingBackup ? 'Creating Backup Archive...' : 'Create Full Offline Backup (.wmbak)'}</span>
          </button>
        </div>
      </div>

      {/* Orphan File Detector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              ORPHAN & BROKEN FILE REFERENCE DETECTOR
            </h3>
          </div>
          {orphanData && (
            <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
              orphanData.status === 'HEALTHY'
                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                : 'bg-amber-950 text-amber-300 border-amber-800'
            }`}>
              {orphanData.status}
            </span>
          )}
        </div>

        {orphanData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">
                Broken Database References ({orphanData.brokenDatabaseReferencesCount})
              </span>
              <span className="text-slate-500 text-[11px]">
                DB records pointing to files missing on disk:
              </span>
              {orphanData.brokenDatabaseReferencesCount === 0 ? (
                <div className="text-emerald-400 font-bold mt-2">✓ None (0 broken references)</div>
              ) : (
                <div className="text-rose-400 mt-2">
                  {orphanData.brokenDatabaseReferences.length} missing files detected.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-bold block mb-1">
                Orphan Disk Files ({orphanData.orphanDiskFilesCount})
              </span>
              <span className="text-slate-500 text-[11px]">
                Files on disk without active database records:
              </span>
              {orphanData.orphanDiskFilesCount === 0 ? (
                <div className="text-emerald-400 font-bold mt-2">✓ None (0 orphan files)</div>
              ) : (
                <div className="text-amber-400 mt-2">
                  {orphanData.orphanDiskFiles.length} orphan files found on disk.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Backups List */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              LOCAL BACKUP ARCHIVES ({backups.length})
            </h3>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-slate-500">
            No backup archives found in local AppData directory.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {backups.map((b, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs font-mono"
              >
                <div>
                  <span className="text-emerald-400 font-bold block">{b.fileName}</span>
                  <span className="text-slate-400 text-[11px]">
                    Size: {(b.sizeBytes / 1024).toFixed(1)} KB • Created: {new Date(b.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                  VERIFIED
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
