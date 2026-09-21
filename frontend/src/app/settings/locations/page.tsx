'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { MapPin, Plus, ChevronRight, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LocationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [districtName, setDistrictName] = useState('');

  const [showPanchayatModal, setShowPanchayatModal] = useState(false);
  const [targetDistrictId, setTargetDistrictId] = useState('');
  const [panchayatName, setPanchayatName] = useState('');

  const [showVillageModal, setShowVillageModal] = useState(false);
  const [targetPanchayatId, setTargetPanchayatId] = useState('');
  const [villageName, setVillageName] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Fetch Tree
  const { data: tree, isLoading } = useQuery({
    queryKey: ['location-tree'],
    queryFn: async () => {
      const res = await apiClient.get('/locations/tree');
      return res.data;
    },
  });

  // Create District
  const createDistrictMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/districts', { name: districtName.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      setShowDistrictModal(false);
      setDistrictName('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create district');
    },
  });

  // Create Panchayat
  const createPanchayatMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/panchayats', {
        districtId: targetDistrictId,
        name: panchayatName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      setShowPanchayatModal(false);
      setPanchayatName('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create panchayat');
    },
  });

  // Create Village
  const createVillageMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/locations/villages', {
        panchayatId: targetPanchayatId,
        name: villageName.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      setShowVillageModal(false);
      setVillageName('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Failed to create village');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Geographic Hierarchy</h1>
          <p className="text-sm text-slate-500 mt-1">
            Administrative hierarchy tree: District &rarr; Panchayat &rarr; Village
          </p>
        </div>
        {user?.role === 'ADMIN' && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setError(null);
                setShowDistrictModal(true);
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold"
            >
              + District
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetDistrictId(tree?.[0]?.district_id || '');
                setShowPanchayatModal(true);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
            >
              + Panchayat
            </button>
            <button
              onClick={() => {
                setError(null);
                setTargetPanchayatId(tree?.[0]?.panchayats?.[0]?.panchayat_id || '');
                setShowVillageModal(true);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
            >
              + Village
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

      {/* Tree Explorer */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
            Loading location hierarchy...
          </div>
        ) : tree && tree.length > 0 ? (
          tree.map((district: any) => (
            <div key={district.district_id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 font-bold text-slate-900 text-sm">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  <span>District: {district.name}</span>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  {district.panchayats?.length || 0} Panchayats
                </span>
              </div>

              <div className="p-4 space-y-3">
                {district.panchayats?.map((panchayat: any) => (
                  <div key={panchayat.panchayat_id} className="p-3 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-semibold text-slate-800 text-xs">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span>Panchayat: {panchayat.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {panchayat.villages?.length || 0} Villages
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2 pl-5 pt-1">
                      {panchayat.villages?.map((village: any) => (
                        <span
                          key={village.village_id}
                          className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 shadow-xs"
                        >
                          {village.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center text-slate-400 text-sm">
            No geographic locations configured yet.
          </div>
        )}
      </div>

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
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">District Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tiruppur"
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

      {/* CREATE PANCHAYAT MODAL */}
      {showPanchayatModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900">Add Panchayat</h3>
              <button onClick={() => setShowPanchayatModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createPanchayatMutation.mutate();
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
                  {tree?.map((d: any) => (
                    <option key={d.district_id} value={d.district_id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Panchayat Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Udumalpet North"
                  value={panchayatName}
                  onChange={(e) => setPanchayatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowPanchayatModal(false)}
                  className="px-3 py-1.5 bg-slate-100 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPanchayatMutation.isPending}
                  className="px-3 py-1.5 bg-slate-800 text-white rounded text-xs font-semibold"
                >
                  Save Panchayat
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
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Parent Panchayat *</label>
                <select
                  value={targetPanchayatId}
                  onChange={(e) => setTargetPanchayatId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  {tree?.flatMap((d: any) =>
                    d.panchayats?.map((p: any) => (
                      <option key={p.panchayat_id} value={p.panchayat_id}>
                        {d.name} &rarr; {p.name}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Village Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aliyar"
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
