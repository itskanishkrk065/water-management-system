import React, { Suspense } from 'react';
import { FindFilterManager } from '@/components/reports/FindFilterManager';
import { RefreshCw } from 'lucide-react';

export const metadata = {
  title: 'Advanced Search & Reports | Water Management System',
  description:
    'Dedicated search, query, and reporting interface with live decimal-safe PostgreSQL aggregations and authoritative PDF exports.',
};

export default function ReportsFindPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-sky-500 mb-3" />
          <p className="text-sm font-semibold">Loading Find & Filter Engine...</p>
        </div>
      }
    >
      <FindFilterManager />
    </Suspense>
  );
}
