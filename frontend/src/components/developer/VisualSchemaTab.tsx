'use client';

import React, { useState } from 'react';
import { TableSummary } from '@/lib/developer-api';
import { Network, Search, ZoomIn, ZoomOut, Maximize2, Key, Link2, ArrowRight } from 'lucide-react';

interface VisualSchemaTabProps {
  tables: TableSummary[];
}

export function VisualSchemaTab({ tables }: VisualSchemaTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTableSummary = tables.find((t) => t.tableName === selectedTable);

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-400">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">VISUAL DATABASE SCHEMA & RELATIONSHIP GRAPH</h2>
            <p className="text-xs font-mono text-slate-400">
              {tables.length} tables mapped • Interactive relationship navigator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44"
            />
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.1))}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-slate-300 px-1.5">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(1.3, z + 0.1))}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
              title="Reset Zoom"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Selected Table Relationship Drawer */}
      {activeTableSummary && (
        <div className="bg-indigo-950/40 border border-indigo-800/80 rounded-xl p-4 text-xs font-mono shadow-md">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-900/60 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold uppercase">{activeTableSummary.tableName}</span>
              <span className="text-slate-400">({activeTableSummary.rowCount.toLocaleString()} records)</span>
            </div>
            <button
              onClick={() => setSelectedTable(null)}
              className="text-slate-400 hover:text-white text-xs"
            >
              Close Inspector ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Outgoing Foreign Keys */}
            <div>
              <span className="text-indigo-300 font-bold block mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Outgoing Foreign Keys (Belongs To)
              </span>
              {activeTableSummary.foreignKeys.length === 0 ? (
                <span className="text-slate-500 italic">No outgoing foreign keys</span>
              ) : (
                <div className="space-y-1">
                  {activeTableSummary.foreignKeys.map((fk, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTable(fk.table)}
                      className="p-1.5 rounded bg-slate-900/80 border border-slate-800 hover:border-indigo-500 text-slate-300 cursor-pointer flex items-center justify-between"
                    >
                      <span>`{fk.from}`</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-emerald-400 font-bold">{fk.table}.{fk.to}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Incoming Reverse Relations */}
            <div>
              <span className="text-emerald-300 font-bold block mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Incoming Relations (Has Many)
              </span>
              {!activeTableSummary.reverseRelations || activeTableSummary.reverseRelations.length === 0 ? (
                <span className="text-slate-500 italic">No incoming reverse relations</span>
              ) : (
                <div className="space-y-1">
                  {activeTableSummary.reverseRelations.map((rev, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedTable(rev.fromTable)}
                      className="p-1.5 rounded bg-slate-900/80 border border-slate-800 hover:border-emerald-500 text-slate-300 cursor-pointer flex items-center justify-between"
                    >
                      <span className="text-cyan-400 font-bold">{rev.fromTable}</span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span>via `{rev.fromColumn}`</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid of Tables */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-transform duration-150 origin-top-left"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        {filteredTables.map((table) => {
          const isSelected = selectedTable === table.tableName;
          const isRelated =
            activeTableSummary &&
            (activeTableSummary.foreignKeys.some((f) => f.table === table.tableName) ||
              activeTableSummary.reverseRelations?.some((r) => r.fromTable === table.tableName));

          return (
            <div
              key={table.tableName}
              onClick={() => setSelectedTable(isSelected ? null : table.tableName)}
              className={`bg-slate-900/90 border rounded-xl overflow-hidden shadow-sm transition cursor-pointer ${
                isSelected
                  ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                  : isRelated
                  ? 'border-emerald-500/80 bg-slate-900/95'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Table Header */}
              <div className="px-3.5 py-2.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono font-bold text-white uppercase truncate max-w-[150px]">
                    {table.tableName}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  {table.rowCount.toLocaleString()} rows
                </span>
              </div>

              {/* Columns List */}
              <div className="p-3 space-y-1 max-h-48 overflow-y-auto text-[11px] font-mono custom-scrollbar">
                {table.columns.map((col) => {
                  const isPk = col.pk > 0 || col.name === table.primaryKey;
                  const fk = table.foreignKeys.find((f) => f.from === col.name);

                  return (
                    <div
                      key={col.name}
                      className="flex items-center justify-between py-0.5 text-slate-400 hover:text-slate-200"
                    >
                      <div className="flex items-center gap-1 truncate">
                        {isPk && <Key className="w-3 h-3 text-amber-400 shrink-0" />}
                        {fk && <Link2 className="w-3 h-3 text-indigo-400 shrink-0" />}
                        <span className={isPk ? 'text-amber-300 font-semibold' : fk ? 'text-indigo-300' : ''}>
                          {col.name}
                        </span>
                      </div>
                      <span className="text-slate-600 text-[10px]">{col.type || 'TEXT'}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer Badges */}
              <div className="px-3 py-1.5 bg-slate-950/60 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                <span>{table.columns.length} cols</span>
                <span>{table.foreignKeys.length} FKs</span>
                <span>{table.indexes.length} idx</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
