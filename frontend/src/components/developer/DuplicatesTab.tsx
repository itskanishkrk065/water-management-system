'use client';

import React, { useState, useEffect } from 'react';
import { DuplicateGroup, DeveloperApi } from '@/lib/developer-api';
import { Layers, RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

export function DuplicatesTab() {
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadDuplicates = async () => {
    try {
      setLoading(true);
      const res = await DeveloperApi.scanDuplicates();
      setDuplicateGroups(res.duplicateGroups || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-indigo-950/80 border border-indigo-800 text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">DEEP DUPLICATE DETECTION CENTER</h2>
            <p className="text-xs font-mono text-slate-400">
              Scans Phone numbers, Survey/Subdivision parcels, Active applications, and LGD codes.
            </p>
          </div>
        </div>

        <button
          onClick={loadDuplicates}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          <span>Rescan Duplicates</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-slate-400">
          Running deep duplicate scan across database tables...
        </div>
      ) : duplicateGroups.length === 0 ? (
        <div className="p-12 bg-slate-900/60 border border-slate-800 rounded-xl flex flex-col items-center justify-center text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400" />
          <div>
            <h3 className="text-sm font-mono font-bold text-white">Zero Duplicate Groups Detected</h3>
            <p className="text-xs font-mono text-slate-400 mt-1">
              All beneficiary phone numbers, parcel survey numbers, and LGD codes satisfy uniqueness constraints.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {duplicateGroups.map((grp, idx) => (
            <div
              key={idx}
              className="bg-slate-900/90 border border-amber-900/50 rounded-xl p-5 shadow-sm space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    {grp.category}
                  </span>
                  <h3 className="text-sm font-mono font-bold text-white">{grp.description}</h3>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-400 font-bold">
                  {grp.count} duplicate group{grp.count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                {grp.items.map((item, i) => (
                  <div
                    key={i}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <span className="text-white font-bold">
                        {item.phone_number || `${item.survey_number} / ${item.subdivision_number}` || item.lgd_district_code || item.land_id}
                      </span>
                      <span className="text-slate-400 ml-2">({item.cnt} occurrences)</span>
                      {item.names && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Names: <span className="text-slate-300">{item.names}</span>
                        </div>
                      )}
                      {item.ids && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5 select-all">
                          IDs: {item.ids}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommended Safe Action Notice */}
              <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">Recommended Action:</span>
                  <span>{grp.recommendedAction}</span>
                </div>
                <span className="text-[11px] text-slate-500 italic">
                  * Automatic deletion disabled for safety
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
