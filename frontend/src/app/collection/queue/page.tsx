'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { CascadingLocationSelector } from '@/components/locations/CascadingLocationSelector';
import { SmartBulkPaymentModal } from '@/components/payments/SmartBulkPaymentModal';
import { formatCurrency, formatLitres } from '@/lib/utils';
import {
  CreditCard,
  Search,
  User,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
} from 'lucide-react';

export default function CollectionQueuePage() {
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [revenueVillageId, setRevenueVillageId] = useState('');
  const [villageId, setVillageId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Queue state for Save & Next workflow
  const [queueIndex, setQueueIndex] = useState<number | null>(null);
  const [activePaymentBeneficiary, setActivePaymentBeneficiary] = useState<any | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Fetch Collection Queue
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['collection-queue', districtId, blockId, revenueVillageId, villageId, searchQuery],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiaries/collection-queue', {
        params: {
          districtId: districtId || undefined,
          blockId: blockId || undefined,
          revenueVillageId: revenueVillageId || undefined,
          villageId: villageId || undefined,
          search: searchQuery || undefined,
        },
      });
      return res.data;
    },
  });

  const queue = queueData?.queue || [];
  const summary = queueData?.summary || { totalBeneficiaries: 0, totalPendingAmount: '0.00' };

  const handleStartWorkflow = () => {
    if (queue.length > 0) {
      setQueueIndex(0);
      setActivePaymentBeneficiary(queue[0]);
      setShowPaymentModal(true);
    }
  };

  const handleOpenPayment = (item: any, idx: number) => {
    setQueueIndex(idx);
    setActivePaymentBeneficiary(item);
    setShowPaymentModal(true);
  };

  const handleSaveAndNext = () => {
    if (queueIndex !== null && queueIndex + 1 < queue.length) {
      const nextIdx = queueIndex + 1;
      setQueueIndex(nextIdx);
      setActivePaymentBeneficiary(queue[nextIdx]);
      setShowPaymentModal(true);
    } else {
      setQueueIndex(null);
      setActivePaymentBeneficiary(null);
      setShowPaymentModal(false);
      refetch();
    }
  };

  const handleClearFilters = () => {
    setDistrictId('');
    setBlockId('');
    setRevenueVillageId('');
    setVillageId('');
    setSearchQuery('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400 mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Collection Officer Work Queue</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Today's Collection Queue</h1>
          <p className="text-sm text-slate-400 mt-1">
            Priority collection queue sorted by outstanding balance. Use <span className="text-cyan-400 font-semibold">Start Collection</span> to move seamlessly between beneficiaries.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-950/80 border border-slate-800 p-4 rounded-xl shrink-0">
          <div>
            <span className="text-xs text-slate-400 block">Queue Target</span>
            <span className="text-lg font-bold text-white">{summary.totalBeneficiaries} Beneficiaries</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-xs text-slate-400 block">Total Pending Balance</span>
            <span className="text-lg font-bold text-amber-400 font-mono">{formatCurrency(summary.totalPendingAmount)}</span>
          </div>
          {queue.length > 0 && (
            <button
              onClick={handleStartWorkflow}
              className="ml-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Start Collection</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-cyan-400" />
            <span>Location Context & Search Filters</span>
          </span>

          {(districtId || blockId || revenueVillageId || villageId || searchQuery) && (
            <button
              onClick={handleClearFilters}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-4">
            <CascadingLocationSelector
              districtId={districtId}
              blockId={blockId}
              revenueVillageId={revenueVillageId}
              villageId={villageId}
              onChangeDistrict={setDistrictId}
              onChangeBlock={setBlockId}
              onChangeRevenueVillage={setRevenueVillageId}
              onChangeVillage={setVillageId}
              compact
            />
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name/phone..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Beneficiaries Work Queue List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading priority collection queue...</div>
        ) : queue.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">✓ You're all caught up.</h3>
            <p className="text-xs text-slate-400">No pending collections found for the selected location filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {queue.map((item: any, idx: number) => (
              <div
                key={item.beneficiaryId}
                className="p-4 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-mono font-bold text-cyan-400 text-sm shrink-0">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-bold text-white">{item.name}</h3>
                      <span className="text-xs font-mono text-cyan-400">{item.beneficiaryId}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 mt-1 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-500" />
                        {item.phoneNumber}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {item.villageName || 'Village'}, {item.districtName || 'District'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 shrink-0">
                  <div className="text-right">
                    <span className="text-xs text-slate-400 block">Pending Balance</span>
                    <span className="text-base font-bold text-amber-400 font-mono">
                      {formatCurrency(item.totalPendingAmount)}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenPayment(item, idx)}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs rounded-lg shadow-md transition-all flex items-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Collect Payment</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Smart Payment Modal */}
      {showPaymentModal && activePaymentBeneficiary && (
        <SmartBulkPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          beneficiaryId={activePaymentBeneficiary.beneficiaryId}
          beneficiaryName={activePaymentBeneficiary.name}
          developmentBillId={activePaymentBeneficiary.primaryBillId}
          initialAmount={activePaymentBeneficiary.totalPendingAmount}
          queueMode={queueIndex !== null && queueIndex + 1 < queue.length}
          onSaveAndNext={handleSaveAndNext}
        />
      )}
    </div>
  );
}
