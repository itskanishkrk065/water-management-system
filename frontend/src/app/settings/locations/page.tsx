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
  ChevronRight,
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

  const [activeTab, setActiveTab] = useState<'districts' | 'blocks' | 'villages' | 'import' | 'history'>('districts');

  // Filters & Search
  const [districtSearch, setDistrictSearch] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [blockSearch, setBlockSearch] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState('');
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

  const [showVillageModal, setShowVillageModal] = useState(false);
  const [targetBlockId, setTargetBlockId] = useState('');
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

  // 3. Fetch Villages with Pagination & Search
  const { data: villageData, isLoading: villagesLoading } = useQuery({
    queryKey: ['villages-admin', selectedBlockId, villageSearch, villagePage],
    queryFn: async () => {
      const res = await apiClient.get('/locations/villages', {
        params: {
          blockId: selectedBlockId || undefined,
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

  // Create Village Mutation
  const createVillageMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/villages', {
        blockId: targetBlockId,
        lgdVillageCode: villageLgdCode ? parseInt(villageLgdCode, 10) : undefined,
        name: villageName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['villages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      setShowVillageModal(false);
      setVillageName('');
      setVillageLgdCode('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create village');
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Location Master Data</h1>
          <p className="text-sm text-slate-500 mt-1">
            Official LGD administrative hierarchy: District 1 &rarr; N Block 1 &rarr; N Village
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setError(null);
                setShowDistrictModal(true);
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ District</span>
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetDistrictId(districts?.[0]?.district_id || '');
                setShowBlockModal(true);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Block</span>
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetBlockId(blocks?.[0]?.block_id || '');
                setShowVillageModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition inline-flex items-center space-x-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Village</span>
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
      <div className="flex items-center space-x-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('districts')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'districts'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Districts ({districts?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'blocks'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Blocks ({blocks?.length || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('villages')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'villages'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Villages ({villageMeta.total || 0})</span>
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center space-x-2 transition ${
            activeTab === 'import'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Excel Import &amp; Preview</span>
        </button>
      </div>

      {/* TAB 1: DISTRICTS */}
      {activeTab === 'districts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search districts..."
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Total Districts: {districts?.length || 0}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3">LGD Code</th>
                  <th className="p-3">District Name</th>
                  <th className="p-3">Blocks Count</th>
                  <th className="p-3">Beneficiaries</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {districtsLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Loading districts...</td>
                  </tr>
                ) : districts && districts.length > 0 ? (
                  districts.map((d: any) => (
                    <tr key={d.district_id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {d.lgd_district_code || '—'}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{d.name}</td>
                      <td className="p-3 font-mono text-slate-600">{d._count?.blocks || 0} Blocks</td>
                      <td className="p-3 font-mono text-slate-600">{d._count?.beneficiaries || 0} Farmers</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${d.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {d.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedDistrictId(d.district_id);
                            setActiveTab('blocks');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                        >
                          View Blocks &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No districts match search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: BLOCKS */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="relative w-60">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search blocks..."
                  value={blockSearch}
                  onChange={(e) => setBlockSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <select
                value={selectedDistrictId}
                onChange={(e) => setSelectedDistrictId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="">All Districts</option>
                {districts?.map((d: any) => (
                  <option key={d.district_id} value={d.district_id}>
                    District: {d.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Showing {blocks?.length || 0} Blocks
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3">LGD Block Code</th>
                  <th className="p-3">Block Name</th>
                  <th className="p-3">Parent District</th>
                  <th className="p-3">Villages Count</th>
                  <th className="p-3">Beneficiaries</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {blocksLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">Loading blocks...</td>
                  </tr>
                ) : blocks && blocks.length > 0 ? (
                  blocks.map((b: any) => (
                    <tr key={b.block_id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {b.lgd_block_code || '—'}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{b.name}</td>
                      <td className="p-3 text-slate-700 font-medium">
                        {b.district?.name} <span className="text-slate-400 font-mono">({b.district?.lgd_district_code})</span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{b._count?.villages || 0} Villages</td>
                      <td className="p-3 font-mono text-slate-600">{b._count?.beneficiaries || 0} Farmers</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${b.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {b.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedBlockId(b.block_id);
                            setActiveTab('villages');
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold"
                        >
                          View Villages &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">No blocks found matching filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VILLAGES */}
      {activeTab === 'villages' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search village name..."
                  value={villageSearch}
                  onChange={(e) => {
                    setVillageSearch(e.target.value);
                    setVillagePage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <select
                value={selectedBlockId}
                onChange={(e) => {
                  setSelectedBlockId(e.target.value);
                  setVillagePage(1);
                }}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
              >
                <option value="">All Blocks</option>
                {blocks?.map((b: any) => (
                  <option key={b.block_id} value={b.block_id}>
                    Block: {b.name} ({b.district?.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 font-mono">
              Page {villageMeta.page} of {villageMeta.totalPages} ({villageMeta.total.toLocaleString()} Villages)
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="p-3">LGD Village Code</th>
                  <th className="p-3">Village Name</th>
                  <th className="p-3">Parent Block</th>
                  <th className="p-3">Parent District</th>
                  <th className="p-3">Beneficiaries</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {villagesLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">Loading villages...</td>
                  </tr>
                ) : villages && villages.length > 0 ? (
                  villages.map((v: any) => (
                    <tr key={v.village_id} className="hover:bg-slate-50/70">
                      <td className="p-3 font-mono font-bold text-slate-700">
                        {v.lgd_village_code || '—'}
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{v.name}</td>
                      <td className="p-3 text-slate-700">
                        {v.block?.name || '—'}
                      </td>
                      <td className="p-3 text-slate-600">
                        {v.block?.district?.name || '—'}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{v._count?.beneficiaries || 0} Farmers</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${v.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                          {v.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No villages found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {villageMeta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                disabled={villagePage <= 1}
                onClick={() => setVillagePage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold disabled:opacity-50"
              >
                &larr; Previous Page
              </button>

              <span className="text-xs text-slate-600 font-mono">
                Page {villagePage} of {villageMeta.totalPages}
              </span>

              <button
                disabled={villagePage >= villageMeta.totalPages}
                onClick={() => setVillagePage((p) => p + 1)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold disabled:opacity-50"
              >
                Next Page &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: IMPORT MASTER */}
      {activeTab === 'import' && <LocationImportManager />}

      {/* CREATE DISTRICT MODAL */}
      {showDistrictModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add District</h3>
              <button onClick={() => setShowDistrictModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDistrictMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">LGD District Code</label>
                <input
                  type="number"
                  placeholder="e.g. 528"
                  value={districtLgdCode}
                  onChange={(e) => setDistrictLgdCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">District Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Coimbatore"
                  value={districtName}
                  onChange={(e) => setDistrictName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowDistrictModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDistrictMutation.isPending}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded text-xs font-semibold"
                >
                  Save District
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE BLOCK MODAL */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add Block</h3>
              <button onClick={() => setShowBlockModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBlockMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Parent District *</label>
                <select
                  value={targetDistrictId}
                  onChange={(e) => setTargetDistrictId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {districts?.map((d: any) => (
                    <option key={d.district_id} value={d.district_id}>
                      {d.name} ({d.lgd_district_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">LGD Block Code *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 6482"
                  value={blockLgdCode}
                  onChange={(e) => setBlockLgdCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Block Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pollachi North"
                  value={blockName}
                  onChange={(e) => setBlockName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBlockModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBlockMutation.isPending}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
                >
                  Save Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE VILLAGE MODAL */}
      {showVillageModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add Village</h3>
              <button onClick={() => setShowVillageModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createVillageMutation.mutate();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Parent Block *</label>
                <select
                  value={targetBlockId}
                  onChange={(e) => setTargetBlockId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {blocks?.map((b: any) => (
                    <option key={b.block_id} value={b.block_id}>
                      {b.name} ({b.district?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">LGD Village Code</label>
                <input
                  type="number"
                  placeholder="e.g. 223994"
                  value={villageLgdCode}
                  onChange={(e) => setVillageLgdCode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Village Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Angambakkam"
                  value={villageName}
                  onChange={(e) => setVillageName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowVillageModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createVillageMutation.isPending}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-semibold"
                >
                  Save Village
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
