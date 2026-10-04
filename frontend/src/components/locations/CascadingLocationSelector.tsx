'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface CascadingLocationSelectorProps {
  districtId?: string;
  onChangeDistrict?: (id: string) => void;
  blockId?: string;
  onChangeBlock?: (id: string) => void;
  revenueVillageId?: string;
  onChangeRevenueVillage?: (id: string) => void;
  villageId?: string;
  onChangeVillage?: (id: string) => void;
  disabled?: boolean;
  required?: boolean;
  showAllOption?: boolean;
  compact?: boolean;
  layout?: 'grid' | 'stack';
}

export function CascadingLocationSelector({
  districtId = '',
  onChangeDistrict,
  blockId = '',
  onChangeBlock,
  revenueVillageId = '',
  onChangeRevenueVillage,
  villageId = '',
  onChangeVillage,
  disabled = false,
  required = false,
  showAllOption = true,
  compact = false,
  layout = 'grid',
}: CascadingLocationSelectorProps) {
  // 1. Fetch Districts
  const { data: districts = [] } = useQuery({
    queryKey: ['districts-selector'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts', { params: { activeOnly: true } });
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
  });

  // 2. Fetch Blocks for selected District
  const { data: blocks = [] } = useQuery({
    queryKey: ['blocks-selector', districtId],
    queryFn: async () => {
      if (!districtId) return [];
      const res = await apiClient.get('/locations/blocks', {
        params: { districtId, activeOnly: true },
      });
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
    enabled: Boolean(districtId),
  });

  // 3. Fetch Revenue Villages for selected Block
  const { data: revenueVillages = [] } = useQuery({
    queryKey: ['revenue-villages-selector', blockId],
    queryFn: async () => {
      if (!blockId) return [];
      const res = await apiClient.get('/locations/revenue-villages', {
        params: { blockId, activeOnly: true },
      });
      return Array.isArray(res.data) ? res.data : res.data?.items || [];
    },
    enabled: Boolean(blockId),
  });

  // 4. Fetch Villages for selected Revenue Village or Block
  const { data: villageData } = useQuery({
    queryKey: ['villages-selector', blockId, revenueVillageId],
    queryFn: async () => {
      if (!blockId && !revenueVillageId) return [];
      const res = await apiClient.get('/locations/villages', {
        params: {
          blockId: blockId || undefined,
          revenueVillageId: revenueVillageId || undefined,
          activeOnly: true,
          limit: 200,
        },
      });
      return res.data;
    },
    enabled: Boolean(blockId || revenueVillageId),
  });

  const villages = villageData?.items || (Array.isArray(villageData) ? villageData : []);

  // Handlers with automatic cascading resets
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    onChangeDistrict?.(newDistrict);
    onChangeBlock?.('');
    onChangeRevenueVillage?.('');
    onChangeVillage?.('');
  };

  const handleBlockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newBlock = e.target.value;
    onChangeBlock?.(newBlock);
    onChangeRevenueVillage?.('');
    onChangeVillage?.('');
  };

  const handleRevenueVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRV = e.target.value;
    onChangeRevenueVillage?.(newRV);
    onChangeVillage?.('');
  };

  const handleVillageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChangeVillage?.(e.target.value);
  };

  const labelClass = compact
    ? 'block text-[10px] font-semibold text-slate-500 uppercase mb-0.5'
    : 'block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1';

  const selectClass = compact
    ? 'w-full text-xs rounded-lg border-slate-200 bg-slate-50/70 py-1.5 px-2 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500'
    : 'w-full py-2 px-3 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white';

  const containerClass =
    layout === 'grid'
      ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5'
      : 'space-y-3';

  return (
    <div className={containerClass}>
      {/* 1. District */}
      <div>
        <label className={labelClass}>District {required && '*'}</label>
        <select
          disabled={disabled}
          required={required}
          value={districtId}
          onChange={handleDistrictChange}
          className={selectClass}
        >
          {showAllOption ? <option value="">All Districts</option> : <option value="">Select District</option>}
          {districts.map((d: any) => (
            <option key={d.district_id} value={d.district_id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Block */}
      <div>
        <label className={labelClass}>Block {required && '*'}</label>
        <select
          disabled={disabled || !districtId}
          required={required}
          value={blockId}
          onChange={handleBlockChange}
          className={selectClass}
        >
          {showAllOption ? <option value="">All Blocks</option> : <option value="">Select Block</option>}
          {blocks.map((b: any) => (
            <option key={b.block_id} value={b.block_id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Revenue Village */}
      <div>
        <label className={labelClass}>Revenue Village {required && '*'}</label>
        <select
          disabled={disabled || !blockId}
          required={required}
          value={revenueVillageId}
          onChange={handleRevenueVillageChange}
          className={selectClass}
        >
          {showAllOption ? <option value="">All Revenue Villages</option> : <option value="">Select Revenue Village</option>}
          {revenueVillages.map((rv: any) => (
            <option key={rv.revenue_village_id} value={rv.revenue_village_id}>
              {rv.name}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Village */}
      <div>
        <label className={labelClass}>Village {required && '*'}</label>
        <select
          disabled={disabled || (!revenueVillageId && !blockId)}
          required={required}
          value={villageId}
          onChange={handleVillageChange}
          className={selectClass}
        >
          {showAllOption ? <option value="">All Villages</option> : <option value="">Select Village</option>}
          {villages.map((v: any) => (
            <option key={v.village_id} value={v.village_id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
