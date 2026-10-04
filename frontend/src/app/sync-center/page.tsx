'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { fetchSyncDiagnostics, triggerDeviceSync } from '@/lib/sync-client';

type SyncTab = 'OVERVIEW' | 'OUTBOX' | 'CONFLICTS' | 'ADVANCES';

export default function SyncCenterPage() {
  const [activeTab, setActiveTab] = useState<SyncTab>('OVERVIEW');
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [outboxItems, setOutboxItems] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDraining, setIsDraining] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<any | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [diagData, outboxRes, conflictsRes, advancesRes] = await Promise.allSettled([
        fetchSyncDiagnostics(),
        apiClient.get(`/sync/outbox?status=${filterStatus}`),
        apiClient.get('/sync/conflicts'),
        apiClient.get('/sync/advance-ledger'),
      ]);

      if (diagData.status === 'fulfilled') setDiagnostics(diagData.value);
      if (outboxRes.status === 'fulfilled') setOutboxItems(outboxRes.value.data);
      if (conflictsRes.status === 'fulfilled') setConflicts(conflictsRes.value.data);
      if (advancesRes.status === 'fulfilled') setAdvances(advancesRes.value.data);
    } catch (err: any) {
      showToast('Error refreshing sync diagnostics: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDrainNow = async () => {
    setIsDraining(true);
    try {
      const data = await triggerDeviceSync();
      showToast(
        `Sync completed: ${data.appliedCount || 0} applied, ${data.conflictCount || 0} conflicts, ${data.failedCount || 0} retried.`,
        data.conflictCount > 0 ? 'error' : 'success',
      );
      await loadData();
    } catch (err: any) {
      showToast('Sync drain failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsDraining(false);
    }
  };

  const handleResolveConflict = async (clientOpId: string, strategy: 'ACCEPT_SERVER' | 'FORCE_CLIENT') => {
    try {
      await apiClient.post(`/sync/conflicts/${clientOpId}/resolve`, { strategy });
      showToast(`Conflict resolved with strategy: ${strategy}`, 'success');
      await loadData();
    } catch (err: any) {
      showToast('Failed to resolve conflict: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  const state = diagnostics?.state || 'OFFLINE';
  const conflictCount = conflicts.length;
  const pendingCount = diagnostics?.pendingOutboxCount || 0;

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-xl text-sm font-medium border flex items-center gap-2 ${
            toast.type === 'success'
              ? 'bg-emerald-900 border-emerald-600 text-emerald-100'
              : toast.type === 'error'
              ? 'bg-rose-900 border-rose-600 text-rose-100'
              : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                WaterGrid Central Sync Center
              </h1>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  state === 'ONLINE'
                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                    : state === 'ATTENTION_REQUIRED'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 animate-pulse'
                    : state === 'SYNCING'
                    ? 'bg-sky-500/10 text-sky-500 border-sky-500/30'
                    : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                }`}
              >
                ● {state}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Bi-directional synchronization engine, optimistic version arbiter & offline outbox inspector.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3 py-2 text-xs font-medium bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg transition"
            >
              {isLoading ? 'Refreshing...' : '↻ Refresh Status'}
            </button>
            <button
              onClick={handleDrainNow}
              disabled={isDraining}
              className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-lg transition shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {isDraining ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Syncing Now...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Trigger Immediate Sync
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'OVERVIEW'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Overview & Node Health
          </button>
          <button
            onClick={() => setActiveTab('OUTBOX')}
            className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'OUTBOX'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Outbox Queue</span>
            {pendingCount > 0 && (
              <span className="bg-sky-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('CONFLICTS')}
            className={`pb-3 border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'CONFLICTS'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Conflict Workspace</span>
            {conflictCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {conflictCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('ADVANCES')}
            className={`pb-3 border-b-2 transition ${
              activeTab === 'ADVANCES'
                ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Advance Credit Ledger
          </button>
        </div>

        {/* ================= TAB 1: OVERVIEW ================= */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">Node Sync State</p>
                <p className="text-2xl font-bold mt-2 text-slate-900 dark:text-white flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      state === 'ONLINE'
                        ? 'bg-emerald-500'
                        : state === 'ATTENTION_REQUIRED'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    }`}
                  />
                  {state}
                </p>
                <p className="text-xs text-slate-500 mt-2">Active Protocol: UUIDv7 Envelope Batch</p>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">Pending Outbox Queue</p>
                <p className="text-2xl font-bold mt-2 text-sky-600 dark:text-sky-400">{pendingCount}</p>
                <p className="text-xs text-slate-500 mt-2">Envelopes awaiting server dispatch</p>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">Active Conflicts</p>
                <p className={`text-2xl font-bold mt-2 ${conflictCount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {conflictCount}
                </p>
                <p className="text-xs text-slate-500 mt-2">Stale writes requiring operator review</p>
              </div>

              <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <p className="text-xs uppercase font-semibold text-slate-400">Last Successful Sync</p>
                <p className="text-lg font-bold mt-2 text-slate-900 dark:text-white">
                  {diagnostics?.lastSyncAt ? new Date(diagnostics.lastSyncAt).toLocaleTimeString() : 'Never'}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  {diagnostics?.lastSyncAt ? new Date(diagnostics.lastSyncAt).toLocaleDateString() : 'Pending first connection'}
                </p>
              </div>
            </div>

            {/* Diagnostic Details */}
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Hardware Node & Device Identification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Device Hardware ID:</span>
                  <p className="font-mono text-slate-700 dark:text-slate-200 mt-0.5">
                    {diagnostics?.deviceId || 'UNKNOWN'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Security Architecture:</span>
                  <p className="text-slate-700 dark:text-slate-200 mt-0.5">
                    Electron SafeStorage (DPAPI/Keychain) + JWT Device-Bound Tokens
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Last Error Diagnostic:</span>
                  <p className="text-slate-700 dark:text-slate-200 mt-0.5 font-mono">
                    {diagnostics?.lastError || 'None (Operational)'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Sync Invariant Enforcement:</span>
                  <p className="text-slate-700 dark:text-slate-200 mt-0.5">
                    Single Rate ₹0.0085/L • Optimistic Version Control • Decimal Money Precision
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: OUTBOX QUEUE ================= */}
        {activeTab === 'OUTBOX' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Filter status:</span>
                {['ALL', 'PENDING', 'RETRYING', 'ACKNOWLEDGED', 'CONFLICT'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-md transition ${
                      filterStatus === st
                        ? 'bg-sky-600 text-white font-medium'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <span className="text-xs text-slate-400">{outboxItems.length} envelope(s) displayed</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Operation ID</th>
                    <th className="p-3">Action Type</th>
                    <th className="p-3">Target Entity</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Retries</th>
                    <th className="p-3">Queued At</th>
                    <th className="p-3 text-right">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {outboxItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No sync outbox envelopes found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    outboxItems.map((item) => (
                      <tr key={item.outbox_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                          {item.client_op_id.slice(0, 16)}...
                        </td>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {item.operation_type}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">
                          {item.entity_type} ({item.entity_id ? item.entity_id.slice(0, 8) : 'new'})
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'ACKNOWLEDGED'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : item.status === 'CONFLICT'
                                ? 'bg-rose-500/10 text-rose-500'
                                : item.status === 'RETRYING'
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-sky-500/10 text-sky-500'
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{item.retry_count || 0}</td>
                        <td className="p-3 text-slate-500">
                          {new Date(item.created_at).toLocaleTimeString()}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setSelectedPayload(item.payload)}
                            className="text-sky-600 hover:text-sky-400 font-medium"
                          >
                            View Data
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= TAB 3: CONFLICT WORKSPACE ================= */}
        {activeTab === 'CONFLICTS' && (
          <div className="space-y-6">
            {conflicts.length === 0 ? (
              <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto text-xl">
                  ✓
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Zero Outstanding Concurrency Conflicts
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  All local modifications are aligned with the server authoritative state. Distributed transactions are in full mathematical agreement.
                </p>
              </div>
            ) : (
              conflicts.map((conf) => (
                <div
                  key={conf.clientOpId}
                  className="p-6 bg-white dark:bg-slate-900 border-2 border-rose-500/30 rounded-xl shadow-lg space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                        Version Mismatch Conflict
                      </span>
                      <h4 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                        {conf.operationType} on {conf.entityType} ({conf.entityId})
                      </h4>
                      <p className="text-xs text-rose-500 dark:text-rose-400 mt-0.5">
                        {conf.lastError || 'Server aggregate version advanced while offline'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleResolveConflict(conf.clientOpId, 'ACCEPT_SERVER')}
                        className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-semibold transition"
                      >
                        Accept Server State (Discard Local)
                      </button>
                      <button
                        onClick={() => handleResolveConflict(conf.clientOpId, 'FORCE_CLIENT')}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                      >
                        Force Client Overwrite
                      </button>
                    </div>
                  </div>

                  {/* Side-by-Side Diff */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <p className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                        Local Client Attempted Payload
                      </p>
                      <pre className="text-xs text-sky-600 dark:text-sky-300 overflow-x-auto">
                        {JSON.stringify(conf.clientPayload, null, 2)}
                      </pre>
                    </div>

                    <div className="p-4 bg-slate-100 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2">
                      <p className="font-bold text-slate-700 dark:text-slate-300 uppercase">
                        Current Server Authoritative Record
                      </p>
                      <pre className="text-xs text-emerald-600 dark:text-emerald-300 overflow-x-auto">
                        {JSON.stringify(conf.serverRecord || { error: 'Record details unavailable' }, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ================= TAB 4: ADVANCES ================= */}
        {activeTab === 'ADVANCES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Automatic overpayment routing (§117 / Part 10). Cash collected beyond bill totals is credited here for next period billing.
              </p>
              <span className="text-xs text-slate-400">{advances.length} ledger entry(ies)</span>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="p-3">Beneficiary</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">District / Village</th>
                    <th className="p-3">Allocated Amount</th>
                    <th className="p-3">Consumed</th>
                    <th className="p-3">Balance Remaining</th>
                    <th className="p-3">Credit Reason</th>
                    <th className="p-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {advances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No beneficiary advance credits found in ledger.
                      </td>
                    </tr>
                  ) : (
                    advances.map((adv) => (
                      <tr key={adv.advance_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">
                          {adv.beneficiary?.name || 'N/A'}
                        </td>
                        <td className="p-3 text-slate-500">{adv.beneficiary?.phone_number || 'N/A'}</td>
                        <td className="p-3 text-slate-500">
                          {adv.beneficiary?.district?.name || '-'} / {adv.beneficiary?.village?.name || '-'}
                        </td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">
                          ₹{Number(adv.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-slate-500">
                          ₹{Number(adv.consumed_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{Number(adv.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-500">{adv.reference_type}</td>
                        <td className="p-3 text-right text-slate-500">
                          {new Date(adv.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: View Raw JSON Payload */}
      {selectedPayload && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Raw Sync Envelope Payload</h3>
              <button
                onClick={() => setSelectedPayload(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-bold"
              >
                ✕
              </button>
            </div>
            <pre className="p-4 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-mono text-xs rounded-lg overflow-y-auto max-h-96">
              {JSON.stringify(selectedPayload, null, 2)}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPayload(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
