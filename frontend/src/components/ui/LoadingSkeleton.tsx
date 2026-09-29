'use client';

import React from 'react';

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/4 animate-pulse" />
        <div className="h-4 bg-slate-100 rounded w-16 animate-pulse" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="p-4 flex items-center gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3.5 bg-slate-100 rounded animate-pulse"
                style={{
                  width: `${Math.max(40, (100 / cols) * (c === 0 ? 1.5 : 0.8))}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse" />
            <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="h-7 bg-slate-200 rounded w-2/3 animate-pulse" />
          <div className="h-2.5 bg-slate-100 rounded w-3/4 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return <TableSkeleton rows={rows} cols={5} />;
}

export default LoadingSkeleton;
