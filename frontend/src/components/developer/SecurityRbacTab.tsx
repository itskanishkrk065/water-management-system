'use client';

import React, { useState } from 'react';
import { DeveloperApi } from '@/lib/developer-api';
import { Shield, Lock, CheckCircle2, XCircle, Play, Server, AlertTriangle } from 'lucide-react';

interface SecurityRbacTabProps {
  currentEnvironment: string;
  onRefreshTelemetry: () => void;
}

export function SecurityRbacTab({ currentEnvironment, onRefreshTelemetry }: SecurityRbacTabProps) {
  // RBAC Simulator State
  const [selectedRole, setSelectedRole] = useState<string>('ADMIN');
  const [selectedPermission, setSelectedPermission] = useState<string>('DEVELOPER_CONSOLE');
  const [selectedAction, setSelectedAction] = useState<string>('EXECUTE');
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  // Environment Classification State
  const [targetEnv, setTargetEnv] = useState<string>(currentEnvironment);
  const [envConfirmPhrase, setEnvConfirmPhrase] = useState<string>('');
  const [envChanging, setEnvChanging] = useState<boolean>(false);
  const [envResult, setEnvResult] = useState<string | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);

  const handleSimulateRbac = async () => {
    try {
      setSimulating(true);
      const res = await DeveloperApi.testRbac({
        role: selectedRole,
        permission: selectedPermission,
        action: selectedAction,
      });
      setSimulationResult(res);
    } catch (err: any) {
      alert(`Simulation failed: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const handleUpdateEnvironment = async () => {
    if (envConfirmPhrase !== 'CHANGE ENVIRONMENT') {
      alert('You must type "CHANGE ENVIRONMENT" to confirm.');
      return;
    }

    try {
      setEnvChanging(true);
      setEnvError(null);
      setEnvResult(null);
      const res = await DeveloperApi.setEnvironment(targetEnv, envConfirmPhrase);
      setEnvResult(res.message);
      setEnvConfirmPhrase('');
      onRefreshTelemetry();
    } catch (err: any) {
      setEnvError(err.response?.data?.message || err.message || 'Environment change failed');
    } finally {
      setEnvChanging(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Interactive RBAC Permission Simulator */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-mono font-bold text-white uppercase">
              RBAC PERMISSION SIMULATOR
            </h3>
          </div>

          <p className="text-xs font-mono text-slate-400">
            Simulates whether a role is authorized to perform a specific action or access a console permission.
          </p>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-300 block mb-1">Target User Role:</label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                <option value="ADMIN">ADMIN</option>
                <option value="FIELD_OFFICER">FIELD_OFFICER</option>
                <option value="ACCOUNTS_OFFICER">ACCOUNTS_OFFICER</option>
                <option value="BENEFICIARY">BENEFICIARY</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Permission to Test:</label>
              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="DEVELOPER_CONSOLE">DEVELOPER_CONSOLE (Master Console Access)</option>
                <option value="DATABASE_READ">DATABASE_READ (Inspect Tables & Data)</option>
                <option value="DATABASE_WRITE">DATABASE_WRITE (Direct Controlled Mutation)</option>
                <option value="DATABASE_RESET">DATABASE_RESET (Clean State Reset)</option>
                <option value="DATABASE_REPAIR">DATABASE_REPAIR (Integrity Repairs)</option>
                <option value="BACKUP_MANAGEMENT">BACKUP_MANAGEMENT (Create / Restore)</option>
                <option value="SYSTEM_CONFIGURATION">SYSTEM_CONFIGURATION</option>
                <option value="BENEFICIARY_ALL">BENEFICIARY_ALL</option>
                <option value="FINANCIAL_ALL">FINANCIAL_ALL</option>
                <option value="WATER_ALL">WATER_ALL</option>
              </select>
            </div>

            <div>
              <label className="text-slate-300 block mb-1">Simulated Action:</label>
              <input
                type="text"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                placeholder="e.g. EXECUTE / WRITE / READ"
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleSimulateRbac}
            disabled={simulating}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-mono text-xs font-bold transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{simulating ? 'Evaluating...' : 'Simulate Authorization Decision'}</span>
          </button>

          {simulationResult && (
            <div
              className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${
                simulationResult.result === 'ALLOWED'
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/60 border-rose-800 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-sm">
                  {simulationResult.result === 'ALLOWED' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400" />
                  )}
                  <span>DECISION: {simulationResult.result}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  Role: {simulationResult.role}
                </span>
              </div>
              <p className="text-slate-200">{simulationResult.explanation}</p>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                Granted Permissions: {simulationResult.rolePermissionSet?.join(', ')}
              </div>
            </div>
          )}
        </div>

        {/* Environment Classification Control */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Server className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-mono font-bold text-white uppercase">
                ENVIRONMENT CLASSIFICATION
              </h3>
            </div>

            <p className="text-xs font-mono text-slate-400">
              Controls production locks. Setting to <strong className="text-rose-300">PRODUCTION</strong> locks clean state resets and destructive operations.
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-slate-400 block mb-1">Current Active Classification:</span>
              <span className="text-white font-bold text-sm">{currentEnvironment.toUpperCase()}</span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <label className="text-slate-300 block">Change Environment To:</label>
              <select
                value={targetEnv}
                onChange={(e) => setTargetEnv(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="DEVELOPMENT">DEVELOPMENT (Full Console Access)</option>
                <option value="TEST">TEST (Full Testing & Reset Access)</option>
                <option value="STAGING">STAGING (Controlled Diagnostics)</option>
                <option value="PRODUCTION">PRODUCTION (Clean State Strictly Locked)</option>
              </select>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <label className="text-slate-300 font-bold block">
                TYPE <span className="text-white bg-slate-900 px-1 py-0.5 rounded border border-slate-700">CHANGE ENVIRONMENT</span>:
              </label>
              <input
                type="text"
                placeholder="CHANGE ENVIRONMENT"
                value={envConfirmPhrase}
                onChange={(e) => setEnvConfirmPhrase(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {envError && (
              <div className="p-3 bg-rose-950 border border-rose-800 rounded-lg text-rose-300 text-xs font-mono">
                {envError}
              </div>
            )}

            {envResult && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-800 rounded-lg text-xs font-mono text-emerald-300">
                {envResult}
              </div>
            )}
          </div>

          <button
            onClick={handleUpdateEnvironment}
            disabled={envConfirmPhrase !== 'CHANGE ENVIRONMENT' || envChanging}
            className="w-full py-2 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition disabled:opacity-40 shadow-md"
          >
            {envChanging ? 'Updating Environment...' : 'Update Environment Classification'}
          </button>
        </div>
      </div>
    </div>
  );
}
