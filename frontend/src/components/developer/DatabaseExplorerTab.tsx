'use client';

import React, { useState, useEffect } from 'react';
import { TableSummary, TableDataResponse, RecordDetailResponse, DeveloperApi } from '@/lib/developer-api';
import {
  Database,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  Check,
  ArrowUpDown,
  ExternalLink,
  Layers,
  X,
  History,
  GitBranch,
} from 'lucide-react';

interface DatabaseExplorerTabProps {
  tables: TableSummary[];
  loadingTables: boolean;
  onRefreshTables: () => void;
}

export function DatabaseExplorerTab({ tables, loadingTables, onRefreshTables }: DatabaseExplorerTabProps) {
  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [dataSearch, setDataSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [sortBy, setSortBy] = useState<string>('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [tableData, setTableData] = useState<TableDataResponse | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(false);

  // Record Inspector Modal State
  const [inspectRecordId, setInspectRecordId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<RecordDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Initialize selected table
  useEffect(() => {
    if (tables.length > 0 && !selectedTableName) {
      setSelectedTableName(tables[0].tableName);
    }
  }, [tables, selectedTableName]);

  // Fetch Table Data when selection, page, limit, search, or sort changes
  useEffect(() => {
    if (!selectedTableName) return;
    let isMounted = true;
    setLoadingData(true);

    DeveloperApi.getTableData(selectedTableName, {
      page,
      limit,
      search: dataSearch.trim() || undefined,
      sortBy: sortBy || undefined,
      sortDir,
    })
      .then((res) => {
        if (isMounted) {
          setTableData(res);
          setLoadingData(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setLoadingData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedTableName, page, limit, dataSearch, sortBy, sortDir]);

  // Fetch Record Detail when inspectRecordId changes
  const handleInspect = async (tableName: string, id: string) => {
    try {
      setInspectRecordId(id);
      setLoadingDetail(true);
      const detail = await DeveloperApi.getRecordDetail(tableName, id);
      setRecordDetail(detail);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const selectedTableSummary = tables.find((t) => t.tableName === selectedTableName);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
      {/* Left Sidebar: Table Directory */}
      <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col h-[700px] shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-mono font-bold text-white uppercase">Tables ({tables.length})</span>
          </div>
        </div>

        {/* Filter Tables */}
        <div className="my-3 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter table name..."
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Table List Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {loadingTables ? (
            <div className="p-4 text-center text-xs font-mono text-slate-400">Loading tables...</div>
          ) : filteredTables.length === 0 ? (
            <div className="p-4 text-center text-xs font-mono text-slate-500">No tables matched.</div>
          ) : (
            filteredTables.map((t) => (
              <button
                key={t.tableName}
                onClick={() => {
                  setSelectedTableName(t.tableName);
                  setPage(1);
                  setDataSearch('');
                  setSortBy('');
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition flex items-center justify-between group ${
                  selectedTableName === t.tableName
                    ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 font-semibold shadow-sm'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200 border border-transparent'
                }`}
              >
                <span className="truncate">{t.tableName}</span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 font-normal">
                  {t.rowCount.toLocaleString()}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel: Table Browser & Pagination */}
      <div className="lg:col-span-9 bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col h-[700px] shadow-sm">
        {/* Table Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-mono font-bold text-white uppercase">{selectedTableName || 'SELECT TABLE'}</h2>
              {selectedTableSummary && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  PK: {selectedTableSummary.primaryKey || 'NONE'} • {selectedTableSummary.columns.length} cols
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Showing page {page} of {tableData?.totalPages || 1} ({tableData?.totalRecords.toLocaleString() || 0} records)
            </p>
          </div>

          {/* Search & Page Limit Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search rows..."
                value={dataSearch}
                onChange={(e) => {
                  setDataSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44"
              />
            </div>

            {/* Limit Selector */}
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value={10}>10 / pg</option>
              <option value={25}>25 / pg</option>
              <option value={50}>50 / pg</option>
              <option value={100}>100 / pg</option>
              <option value={250}>250 / pg</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="flex-1 overflow-auto mt-4 border border-slate-800/80 rounded-lg bg-slate-950 custom-scrollbar">
          {loadingData ? (
            <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs">
              Fetching records from SQLite...
            </div>
          ) : !tableData || tableData.records.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs">
              <Layers className="w-8 h-8 mb-2 opacity-40" />
              No records found in table `{selectedTableName}`
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead className="bg-slate-900/90 sticky top-0 border-b border-slate-800 z-10">
                <tr>
                  <th className="py-2.5 px-3 font-semibold text-slate-400 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 font-semibold text-slate-400 w-16 text-center">Inspect</th>
                  {tableData.columns.map((col) => (
                    <th
                      key={col}
                      onClick={() => {
                        if (sortBy === col) {
                          setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(col);
                          setSortDir('asc');
                        }
                      }}
                      className="py-2.5 px-3 font-semibold text-slate-300 hover:text-white cursor-pointer select-none whitespace-nowrap"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col}</span>
                        {sortBy === col && (
                          <span className="text-emerald-400 text-[10px]">
                            {sortDir === 'asc' ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {tableData.records.map((row, idx) => {
                  const pkVal = row[tableData.primaryKey] || row.id || row.uuid;
                  return (
                    <tr key={idx} className="hover:bg-slate-900/60 transition group">
                      <td className="py-2 px-3 text-slate-500 text-center">
                        {(page - 1) * limit + idx + 1}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleInspect(selectedTableName, String(pkVal))}
                          className="p-1 rounded bg-slate-800 hover:bg-emerald-900 text-slate-300 hover:text-emerald-300 transition"
                          title="Inspect Record Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                      {tableData.columns.map((col) => {
                        const val = row[col];
                        let display = val === null || val === undefined ? 'NULL' : String(val);
                        if (typeof val === 'object' && val !== null) {
                          display = JSON.stringify(val);
                        }
                        const isNull = val === null || val === undefined;

                        return (
                          <td
                            key={col}
                            className={`py-2 px-3 max-w-xs truncate ${
                              isNull ? 'text-slate-600 italic' : 'text-slate-300'
                            }`}
                            title={display}
                          >
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Pagination */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
          <div>
            Page <span className="text-white font-bold">{page}</span> of{' '}
            <span className="text-white font-bold">{tableData?.totalPages || 1}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-40 flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(tableData?.totalPages || 1, p + 1))}
              disabled={page >= (tableData?.totalPages || 1)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition disabled:opacity-40 flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Record Inspector Modal */}
      {inspectRecordId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-mono font-bold text-white">
                    RECORD INSPECTOR: <span className="text-emerald-400">{selectedTableName}</span>
                  </h3>
                  <p className="text-xs font-mono text-slate-400">
                    ID: <span className="text-slate-200 select-all">{inspectRecordId}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectRecordId(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {loadingDetail ? (
                <div className="p-8 text-center text-xs font-mono text-slate-400">
                  Loading complete record graph & audit trail...
                </div>
              ) : !recordDetail ? (
                <div className="p-8 text-center text-xs font-mono text-rose-400">
                  Record not found or failed to load.
                </div>
              ) : (
                <>
                  {/* Field Values Grid */}
                  <div>
                    <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3">
                      Field Values ({Object.keys(recordDetail.data || {}).length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                      {Object.entries(recordDetail.data || {}).map(([key, val]) => {
                        const isPk = key === recordDetail.primaryKey;
                        const fkInfo = recordDetail.foreignKeys.find((f) => f.column === key);
                        const strVal = val === null || val === undefined ? 'NULL' : String(val);

                        return (
                          <div
                            key={key}
                            className={`p-3 rounded-lg border flex flex-col justify-between ${
                              isPk
                                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                                : fkInfo
                                ? 'bg-indigo-950/30 border-indigo-800/60 text-indigo-300'
                                : 'bg-slate-950 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 font-semibold">{key}</span>
                                {isPk && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-900 border border-emerald-700 text-emerald-300">
                                    PRIMARY KEY
                                  </span>
                                )}
                                {fkInfo && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-900 border border-indigo-700 text-indigo-300">
                                    FK → {fkInfo.targetTable}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleCopy(strVal, key)}
                                className="text-slate-500 hover:text-slate-300"
                                title="Copy Value"
                              >
                                {copiedField === key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <div className="text-white font-mono break-all mt-1">{strVal}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Related Children Relationships */}
                  {recordDetail.relatedChildren && recordDetail.relatedChildren.length > 0 && (
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        Related Child Entities ({recordDetail.relatedChildren.length})
                      </h4>
                      <div className="space-y-3">
                        {recordDetail.relatedChildren.map((rel, idx) => (
                          <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono font-bold text-slate-200">
                                {rel.table} ({rel.count} linked record{rel.count !== 1 ? 's' : ''})
                              </span>
                              <span className="text-[11px] font-mono text-slate-400">
                                via `{rel.foreignKeyColumn}`
                              </span>
                            </div>
                            {rel.records.length > 0 && (
                              <div className="text-[11px] font-mono text-slate-400 bg-slate-900 p-2 rounded max-h-32 overflow-y-auto">
                                <pre className="whitespace-pre-wrap">{JSON.stringify(rel.records, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audit History for Record */}
                  {recordDetail.auditHistory && recordDetail.auditHistory.length > 0 && (
                    <div>
                      <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <History className="w-3.5 h-3.5 text-amber-400" />
                        Audit History ({recordDetail.auditHistory.length})
                      </h4>
                      <div className="space-y-2">
                        {recordDetail.auditHistory.map((log, idx) => (
                          <div key={idx} className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono flex items-center justify-between">
                            <div>
                              <span className="text-emerald-400 font-bold mr-2">[{log.action}]</span>
                              <span className="text-slate-300">{log.entity_type}</span>
                              <span className="text-slate-500 ml-2">by {log.user_id || 'SYSTEM'}</span>
                            </div>
                            <span className="text-slate-500 text-[11px]">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
