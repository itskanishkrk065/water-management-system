'use client';

import React, { useState } from 'react';
import { TableSummary, DeveloperApi } from '@/lib/developer-api';
import {
  FileCode,
  Play,
  HelpCircle,
  Copy,
  Check,
  Clock,
  Layers,
  Database,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

interface SqlConsoleTabProps {
  tables: TableSummary[];
}

export function SqlConsoleTab({ tables }: SqlConsoleTabProps) {
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM beneficiaries LIMIT 10;');
  const [includeExplain, setIncludeExplain] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [results, setResults] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Visual Query Builder State
  const [builderTable, setBuilderTable] = useState<string>(tables[0]?.tableName || 'beneficiaries');
  const [builderLimit, setBuilderLimit] = useState<number>(25);

  const handleExecute = async () => {
    try {
      setExecuting(true);
      setError(null);
      const res = await DeveloperApi.executeSql(sqlQuery, includeExplain);
      setResults(res);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'SQL execution failed');
      setResults(null);
    } finally {
      setExecuting(false);
    }
  };

  const handleBuildQuery = () => {
    const generated = `SELECT * FROM ${builderTable} LIMIT ${builderLimit};`;
    setSqlQuery(generated);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlQuery);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Query Builder & Editor */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-mono font-bold text-white">SQL DIAGNOSTIC CONSOLE & EXPLAIN PLAN</h2>
          </div>

          {/* Quick Query Presets */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Quick Builder:</span>
            <select
              value={builderTable}
              onChange={(e) => setBuilderTable(e.target.value)}
              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono"
            >
              {tables.map((t) => (
                <option key={t.tableName} value={t.tableName}>
                  {t.tableName}
                </option>
              ))}
            </select>
            <select
              value={builderLimit}
              onChange={(e) => setBuilderLimit(Number(e.target.value))}
              className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs font-mono"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <button
              onClick={handleBuildQuery}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold"
            >
              Generate
            </button>
          </div>
        </div>

        {/* SQL Input Area */}
        <div className="relative">
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            rows={4}
            placeholder="SELECT ... FROM ... WHERE ...;"
            className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 custom-scrollbar resize-y"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-slate-300">
              <input
                type="checkbox"
                checked={includeExplain}
                onChange={(e) => setIncludeExplain(e.target.checked)}
                className="rounded border-slate-800 text-emerald-600 focus:ring-0 bg-slate-950"
              />
              <span>Generate SQLite EXPLAIN QUERY PLAN</span>
            </label>

            <span className="text-[11px] text-slate-500">
              * Read-only mode active: Destructive mutations blocked
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySql}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy SQL</span>
            </button>
            <button
              onClick={handleExecute}
              disabled={executing || !sqlQuery.trim()}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition disabled:opacity-50 shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{executing ? 'Executing...' : 'Run Query'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Execution Error Banner */}
      {error && (
        <div className="p-4 bg-rose-950/60 border border-rose-800 rounded-xl text-xs font-mono text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">SQL Execution Error</span>
            <span className="text-slate-300">{error}</span>
          </div>
        </div>
      )}

      {/* Query Results & Explain Plan */}
      {results && (
        <div className="space-y-4">
          {/* Telemetry Summary Bar */}
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between text-xs font-mono gap-3">
            <div className="flex items-center gap-4 text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Execution Latency:{' '}
                <strong className="text-white">{results.executionTimeMs} ms</strong>
              </span>
              <span>
                Returned: <strong className="text-emerald-400">{results.rowCount} rows</strong>
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Executed at {new Date(results.timestamp).toLocaleTimeString()}
            </span>
          </div>

          {/* SQLite EXPLAIN QUERY PLAN Output */}
          {results.explainPlan && results.explainPlan.length > 0 && (
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
              <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                SQLite Query Plan Optimization
              </h3>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 text-xs font-mono text-slate-300 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      <th className="py-1 px-2">ID</th>
                      <th className="py-1 px-2">Parent</th>
                      <th className="py-1 px-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.explainPlan.map((plan: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-900">
                        <td className="py-1 px-2 text-slate-400">{plan.id ?? plan.selectid ?? idx}</td>
                        <td className="py-1 px-2 text-slate-400">{plan.parent ?? plan.order ?? '-'}</td>
                        <td className="py-1 px-2 text-indigo-300 font-mono">{plan.detail ?? plan.comment ?? JSON.stringify(plan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table Results */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="font-bold text-white uppercase">Query Results Grid</span>
              <span>{results.rowCount} records</span>
            </div>

            <div className="overflow-x-auto max-h-96 custom-scrollbar">
              {results.data.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-slate-500">
                  Query returned 0 rows.
                </div>
              ) : (
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead className="bg-slate-950 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 text-slate-400 font-semibold w-10 text-center">#</th>
                      {results.columns.map((col: string) => (
                        <th key={col} className="py-2.5 px-3 text-slate-300 font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {results.data.map((row: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-900/60 transition">
                        <td className="py-2 px-3 text-slate-500 text-center">{idx + 1}</td>
                        {results.columns.map((col: string) => {
                          const val = row[col];
                          const str = val === null || val === undefined ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                          return (
                            <td
                              key={col}
                              className={`py-2 px-3 max-w-xs truncate ${
                                val === null || val === undefined ? 'text-slate-600 italic' : 'text-slate-300'
                              }`}
                              title={str}
                            >
                              {str}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
