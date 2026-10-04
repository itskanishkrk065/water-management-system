'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  MapPin,
  Building,
  Layers,
  FileSpreadsheet,
  History,
  Plus,
  Search,
  X,
  AlertCircle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { LocationImportManager } from '@/components/locations/LocationImportManager';

export default function LocationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'districts' | 'blocks' | 'revenue-villages' | 'villages' | 'import' | 'history'>('districts');

  // Filters & Search
  const [districtSearch, setDistrictSearch] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [blockSearch, setBlockSearch] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
  const [rvSearch, setRvSearch] = useState('');
  const [selectedRvId, setSelectedRvId] = useState('');
  const [villageSearch, setVillageSearch] = useState('');
  const [villagePage, setVillagePage] = useState(1);

  // Modals
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [districtName, setDistrictName] = useState('');
  const [districtLgdCode, setDistrictLgdCode] = useState('');

  const [showBlockModal, setShowBlockModal] = useState(false);
  const [targetDistrictId, setTargetDistrictId] = useState('');
  const [blockName, setBlockName] = useState('');
  const [blockLgdCode, setBlockLgdCode] = useState('');

  const [showRvModal, setShowRvModal] = useState(false);
  const [targetRvBlockId, setTargetRvBlockId] = useState('');
  const [rvName, setRvName] = useState('');
  const [rvLgdCode, setRvLgdCode] = useState('');

  const [showVillageModal, setShowVillageModal] = useState(false);
  const [targetBlockId, setTargetBlockId] = useState('');
  const [targetRevenueVillageId, setTargetRevenueVillageId] = useState('');
  const [villageName, setVillageName] = useState('');
  const [villageLgdCode, setVillageLgdCode] = useState('');

  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Districts
  const { data: districts, isLoading: districtsLoading } = useQuery({
    queryKey: ['districts', districtSearch],
    queryFn: async () => {
      const res = await apiClient.get('/locations/districts', {
        params: { search: districtSearch || undefined },
      });
      return res.data;
    },
  });

  // 2. Fetch Blocks
  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['blocks', selectedDistrictId, blockSearch],
    queryFn: async () => {
      const res = await apiClient.get('/locations/blocks', {
        params: {
          districtId: selectedDistrictId || undefined,
          search: blockSearch || undefined,
        },
      });
      return res.data;
    },
  });

  // 3. Fetch Revenue Villages
  const { data: rvData, isLoading: rvLoading } = useQuery({
    queryKey: ['revenue-villages-admin', selectedBlockId, rvSearch],
    queryFn: async () => {
      const res = await apiClient.get('/locations/revenue-villages', {
        params: {
          blockId: selectedBlockId || undefined,
          search: rvSearch || undefined,
        },
      });
      return res.data;
    },
  });
  const revenueVillages = rvData?.items || (Array.isArray(rvData) ? rvData : []);

  // 4. Fetch Villages with Pagination & Search
  const { data: villageData, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages-admin', selectedBlockId, selectedRvId, villageSearch, villagePage],
    queryFn: async () => {
      const res = await apiClient.get('/locations/villages', {
        params: {
          blockId: selectedBlockId || undefined,
          revenueVillageId: selectedRvId || undefined,
          search: villageSearch || undefined,
          page: villagePage,
          limit: 25,
        },
      });
      return res.data;
    },
  });

  const villages = villageData?.items || (Array.isArray(villageData) ? villageData : []);
  const villageMeta = villageData?.meta || { total: villages.length, page: 1, totalPages: 1 };

  // Create District Mutation
  const createDistrictMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/districts', {
        name: districtName.trim(),
        lgdDistrictCode: districtLgdCode ? parseInt(districtLgdCode, 10) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      setShowDistrictModal(false);
      setDistrictName('');
      setDistrictLgdCode('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create district');
    },
  });

  // Create Block Mutation
  const createBlockMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/blocks', {
        districtId: targetDistrictId,
        lgdBlockCode: parseInt(blockLgdCode, 10),
        name: blockName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      setShowBlockModal(false);
      setBlockName('');
      setBlockLgdCode('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create block');
    },
  });

  // Create Revenue Village Mutation
  const createRvMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/revenue-villages', {
        blockId: targetRvBlockId,
        name: rvName.trim(),
        lgdRevenueVillageCode: rvLgdCode ? parseInt(rvLgdCode, 10) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-villages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setShowRvModal(false);
      setRvName('');
      setRvLgdCode('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create revenue village');
    },
  });

  // Create Village Mutation
  const createVillageMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/villages', {
        blockId: targetBlockId || undefined,
        revenueVillageId: targetRevenueVillageId || undefined,
        lgdVillageCode: villageLgdCode ? parseInt(villageLgdCode, 10) : undefined,
        name: villageName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['villages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['revenue-villages-admin'] });
      setShowVillageModal(false);
      setVillageName('');
      setVillageLgdCode('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create village');
    },
  });

  // Toggle Mutations
  const toggleDistrictMutation = useMutation({
    mutationFn: async (districtId: string) => {
      await apiClient.patch(`/locations/districts/${districtId}/toggle-active`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['districts'] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to toggle district status'),
  });

  const deleteDistrictMutation = useMutation({
    mutationFn: async (districtId: string) => {
      await apiClient.delete(`/locations/districts/${districtId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Cannot delete this district. Please deactivate instead.'),
  });

  const toggleBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      await apiClient.patch(`/locations/blocks/${blockId}/toggle-active`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['blocks'] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to toggle block status'),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      await apiClient.delete(`/locations/blocks/${blockId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Cannot delete this block. Please deactivate instead.'),
  });

  const toggleRvMutation = useMutation({
    mutationFn: async (rvId: string) => {
      await apiClient.patch(`/locations/revenue-villages/${rvId}/toggle-active`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['revenue-villages-admin'] }),
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to toggle revenue village status'),
  });

  const deleteRvMutation = useMutation({
    mutationFn: async (rvId: string) => {
      await apiClient.delete(`/locations/revenue-villages/${rvId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revenue-villages-admin'] });
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Cannot delete this revenue village. Please deactivate instead.'),
  });

  const toggleVillageMutation = useMutation({
    mutationFn: async (villageId: string) => {
      await apiClient.patch(`/locations/villages/${villageId}/toggle-active`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['villages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['villages'] });
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Failed to toggle village status'),
  });

  const deleteVillageMutation = useMutation({
    mutationFn: async (villageId: string) => {
      await apiClient.delete(`/locations/villages/${villageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['villages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['villages'] });
      setError(null);
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Cannot delete this village. Please deactivate instead.'),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Location Master Data</h1>
          <p className="text-sm text-slate-500 mt-1">
            Canonical 4-Level Hierarchy: District &rarr; Block &rarr; Revenue Village &rarr; Village
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setError(null); setShowDistrictModal(true); }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> + District
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetDistrictId(districts?.[0]?.district_id || '');
                setShowBlockModal(true);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> + Block
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetRvBlockId(blocks?.[0]?.block_id || '');
                setShowRvModal(true);
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> + Revenue Village
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetBlockId(blocks?.[0]?.block_id || '');
                setTargetRevenueVillageId(revenueVillages?.[0]?.revenue_village_id || '');
                setShowVillageModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> + Village
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 flex space-x-8">
        <button
          onClick={() => setActiveTab('districts')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'districts' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Districts</span>
        </button>

        <button
          onClick={() => setActiveTab('blocks')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'blocks' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Blocks</span>
        </button>

        <button
          onClick={() => setActiveTab('revenue-villages')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'revenue-villages' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Revenue Villages</span>
        </button>

        <button
          onClick={() => setActiveTab('villages')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'villages' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Villages</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'import' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel Import</span>
        </button>
      </div>

      {/* Tab 1: Districts */}
      {activeTab === 'districts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                placeholder="Search districts..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">District Name</th>
                  <th className="p-3">LGD Code</th>
                  <th className="p-3 text-center">Blocks</th>
                  <th className="p-3 text-center">Beneficiaries</th>
                  <th className="p-3 text-center">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {districtsLoading ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">Loading districts...</td></tr>
                ) : (Array.isArray(districts) ? districts : []).length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">No districts found</td></tr>
                ) : (
                  (Array.isArray(districts) ? districts : []).map((d: any) => (
                    <tr key={d.district_id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{d.name}</td>
                      <td className="p-3 font-mono">{d.lgd_district_code || '---'}</td>
                      <td className="p-3 text-center">{d._count?.blocks || 0}</td>
                      <td className="p-3 text-center">{d._count?.beneficiaries || 0}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          d.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => toggleDistrictMutation.mutate(d.district_id)}
                            className="text-sky-600 hover:text-sky-800 font-semibold"
                          >
                            {d.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteDistrictMutation.mutate(d.district_id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Blocks */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedDistrictId}
              onChange={(e) => setSelectedDistrictId(e.target.value)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium"
            >
              <option value="">All Districts</option>
              {(Array.isArray(districts) ? districts : []).map((d: any) => (
                <option key={d.district_id} value={d.district_id}>{d.name}</option>
              ))}
            </select>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={blockSearch}
                onChange={(e) => setBlockSearch(e.target.value)}
                placeholder="Search blocks..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Block Name</th>
                  <th className="p-3">District</th>
                  <th className="p-3">LGD Block Code</th>
                  <th className="p-3 text-center">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {blocksLoading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">Loading blocks...</td></tr>
                ) : (Array.isArray(blocks) ? blocks : []).length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">No blocks found</td></tr>
                ) : (
                  (Array.isArray(blocks) ? blocks : []).map((b: any) => (
                    <tr key={b.block_id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{b.name}</td>
                      <td className="p-3">{b.district?.name || '---'}</td>
                      <td className="p-3 font-mono">{b.lgd_block_code || '---'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {b.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => toggleBlockMutation.mutate(b.block_id)}
                            className="text-sky-600 hover:text-sky-800 font-semibold"
                          >
                            {b.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteBlockMutation.mutate(b.block_id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Revenue Villages */}
      {activeTab === 'revenue-villages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedBlockId}
              onChange={(e) => setSelectedBlockId(e.target.value)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium"
            >
              <option value="">All Blocks</option>
              {(Array.isArray(blocks) ? blocks : []).map((b: any) => (
                <option key={b.block_id} value={b.block_id}>{b.name} ({b.district?.name})</option>
              ))}
            </select>
            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={rvSearch}
                onChange={(e) => setRvSearch(e.target.value)}
                placeholder="Search revenue villages..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Revenue Village Name</th>
                  <th className="p-3">Block</th>
                  <th className="p-3">LGD Code</th>
                  <th className="p-3 text-center">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rvLoading ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">Loading revenue villages...</td></tr>
                ) : revenueVillages.length === 0 ? (
                  <tr><td colSpan={5} className="p-4 text-center text-slate-400">No revenue villages found</td></tr>
                ) : (
                  revenueVillages.map((rv: any) => (
                    <tr key={rv.revenue_village_id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{rv.name}</td>
                      <td className="p-3">{rv.block?.name || '---'}</td>
                      <td className="p-3 font-mono">{rv.lgd_revenue_village_code || '---'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          rv.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {rv.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => toggleRvMutation.mutate(rv.revenue_village_id)}
                            className="text-sky-600 hover:text-sky-800 font-semibold"
                          >
                            {rv.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteRvMutation.mutate(rv.revenue_village_id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Villages */}
      {activeTab === 'villages' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedBlockId}
              onChange={(e) => {
                setSelectedBlockId(e.target.value);
                setSelectedRvId('');
              }}
              className="py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium"
            >
              <option value="">All Blocks</option>
              {(Array.isArray(blocks) ? blocks : []).map((b: any) => (
                <option key={b.block_id} value={b.block_id}>{b.name}</option>
              ))}
            </select>

            <select
              value={selectedRvId}
              onChange={(e) => setSelectedRvId(e.target.value)}
              className="py-2 px-3 border border-slate-300 rounded-lg text-xs font-medium"
            >
              <option value="">All Revenue Villages</option>
              {revenueVillages.map((rv: any) => (
                <option key={rv.revenue_village_id} value={rv.revenue_village_id}>{rv.name}</option>
              ))}
            </select>

            <div className="relative w-72">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={villageSearch}
                onChange={(e) => setVillageSearch(e.target.value)}
                placeholder="Search villages..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Village Name</th>
                  <th className="p-3">Revenue Village</th>
                  <th className="p-3">Block</th>
                  <th className="p-3">LGD Code</th>
                  <th className="p-3 text-center">Status</th>
                  {user?.role === 'ADMIN' && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {villagesLoading ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">Loading villages...</td></tr>
                ) : villages.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-slate-400">No villages found</td></tr>
                ) : (
                  villages.map((v: any) => (
                    <tr key={v.village_id} className="hover:bg-slate-50">
                      <td className="p-3 font-semibold text-slate-900">{v.name}</td>
                      <td className="p-3">{v.revenueVillage?.name || '---'}</td>
                      <td className="p-3">{v.block?.name || '---'}</td>
                      <td className="p-3 font-mono">{v.lgd_village_code || '---'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {v.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {user?.role === 'ADMIN' && (
                        <td className="p-3 text-right space-x-2">
                          <button
                            onClick={() => toggleVillageMutation.mutate(v.village_id)}
                            className="text-sky-600 hover:text-sky-800 font-semibold"
                          >
                            {v.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteVillageMutation.mutate(v.village_id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Import */}
      {activeTab === 'import' && (
        <LocationImportManager />
      )}

      {/* District Creation Modal */}
      {showDistrictModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Add District</h3>
              <button onClick={() => setShowDistrictModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">District Name *</label>
                <input
                  type="text"
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  placeholder="e.g. Coimbatore"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">LGD Code</label>
                <input
                  type="number"
                  value={districtLgdCode}
                  onChange={(e) => setDistrictLgdCode(e.target.value)}
                  placeholder="e.g. 528"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDistrictModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button
                disabled={!districtName.trim() || createDistrictMutation.isPending}
                onClick={() => createDistrictMutation.mutate()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
              >
                Save District
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Creation Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Add Block</h3>
              <button onClick={() => setShowBlockModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target District *</label>
                <select
                  value={targetDistrictId}
                  onChange={(e) => setTargetDistrictId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select District</option>
                  {(Array.isArray(districts) ? districts : []).map((d: any) => (
                    <option key={d.district_id} value={d.district_id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Block Name *</label>
                <input
                  type="text"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  placeholder="e.g. Pollachi North"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">LGD Code *</label>
                <input
                  type="number"
                  value={blockLgdCode}
                  onChange={(e) => setBlockLgdCode(e.target.value)}
                  placeholder="e.g. 6482"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowBlockModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button
                disabled={!targetDistrictId || !blockName.trim() || !blockLgdCode || createBlockMutation.isPending}
                onClick={() => createBlockMutation.mutate()}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Save Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Village Creation Modal */}
      {showRvModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Add Revenue Village</h3>
              <button onClick={() => setShowRvModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Block *</label>
                <select
                  value={targetRvBlockId}
                  onChange={(e) => setTargetRvBlockId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Block</option>
                  {(Array.isArray(blocks) ? blocks : []).map((b: any) => (
                    <option key={b.block_id} value={b.block_id}>{b.name} ({b.district?.name})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revenue Village Name *</label>
                <input
                  type="text"
                  value={rvName}
                  onChange={(e) => setRvName(e.target.value)}
                  placeholder="e.g. Revenue Village A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">LGD Code</label>
                <input
                  type="number"
                  value={rvLgdCode}
                  onChange={(e) => setRvLgdCode(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowRvModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button
                disabled={!targetRvBlockId || !rvName.trim() || createRvMutation.isPending}
                onClick={() => createRvMutation.mutate()}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Revenue Village
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Village Creation Modal */}
      {showVillageModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Add Village</h3>
              <button onClick={() => setShowVillageModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Target Block *</label>
                <select
                  value={targetBlockId}
                  onChange={(e) => setTargetBlockId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Block</option>
                  {(Array.isArray(blocks) ? blocks : []).map((b: any) => (
                    <option key={b.block_id} value={b.block_id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Revenue Village</label>
                <select
                  value={targetRevenueVillageId}
                  onChange={(e) => setTargetRevenueVillageId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Revenue Village</option>
                  {revenueVillages.map((rv: any) => (
                    <option key={rv.revenue_village_id} value={rv.revenue_village_id}>{rv.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Village Name *</label>
                <input
                  type="text"
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  placeholder="e.g. Angambakkam"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">LGD Code</label>
                <input
                  type="number"
                  value={villageLgdCode}
                  onChange={(e) => setVillageLgdCode(e.target.value)}
                  placeholder="e.g. 223994"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowVillageModal(false)} className="px-3 py-1.5 text-xs font-semibold text-slate-600">Cancel</button>
              <button
                disabled={!targetBlockId || !villageName.trim() || createVillageMutation.isPending}
                onClick={() => createVillageMutation.mutate()}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                Save Village
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
