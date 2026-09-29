'use client';

import React from 'react';
import Link from 'next/link';
import { LocationImportManager } from '@/components/locations/LocationImportManager';
import { ArrowLeft, MapPin } from 'lucide-react';

export default function LocationImportPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-500 mb-1">
            <Link href="/settings/locations" className="hover:text-slate-800 flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Locations Master</span>
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Excel Import</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Location Master Import</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Upload and validate official LGD District &rarr; Block &rarr; Village spreadsheet
          </p>
        </div>

        <Link
          href="/settings/locations"
          className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition flex items-center space-x-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-sky-600" />
          <span>View Locations Registry</span>
        </Link>
      </div>

      <LocationImportManager />
    </div>
  );
}
