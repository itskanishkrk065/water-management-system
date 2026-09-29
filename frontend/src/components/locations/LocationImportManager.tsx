'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Eye,
  X,
  Database,
  Building,
  Layers,
  MapPin,
  AlertTriangle,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/lib/utils';

export function LocationImportManager() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showErrorsModal, setShowErrorsModal] = useState(false);
  const [activeHistoryDetail, setActiveHistoryDetail] = useState<any>(null);

  // Upload & Validate Mutation
  const validateMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post('/admin/location-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setErrorMsg(null);
      setSuccessMsg(null);
      queryClient.invalidateQueries({ queryKey: ['location-imports-history'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to validate Excel file');
      setPreviewData(null);
    },
  });

  // Confirm Import Mutation
  const confirmMutation = useMutation({
    mutationFn: async (importId: string) => {
      const res = await apiClient.post(`/admin/location-import/${importId}/confirm`);
      return res.data;
    },
    onSuccess: (data) => {
      setSuccessMsg(
        `Successfully imported location master! Created: ${data.summary.districtsCreated} Districts, ${data.summary.blocksCreated} Blocks, ${data.summary.villagesCreated} Villages. (Total Villages Active: ${data.summary.totalVillages})`,
      );
      setPreviewData(null);
      setSelectedFile(null);
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: ['location-imports-history'] });
      queryClient.invalidateQueries({ queryKey: ['districts'] });
      queryClient.invalidateQueries({ queryKey: ['blocks'] });
      queryClient.invalidateQueries({ queryKey: ['villages'] });
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to execute database import transaction');
    },
  });

  // History Query
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['location-imports-history'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/location-imports');
      return res.data;
    },
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.xls') || file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
        setPreviewData(null);
        setErrorMsg(null);
        setSuccessMsg(null);
      } else {
        setErrorMsg('Please select a valid Excel file (.xls or .xlsx)');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setPreviewData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  };

  const triggerValidation = () => {
    if (!selectedFile) return;
    validateMutation.mutate(selectedFile);
  };

  return (
    <div className="space-y-8">
      {/* Messages */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-sm flex items-center space-x-3 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="font-medium">{successMsg}</div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-300 text-rose-900 rounded-xl text-sm flex items-center space-x-3 shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <div className="font-bold">Validation / Import Error</div>
            <div className="text-xs text-rose-700 mt-0.5">{errorMsg}</div>
          </div>
        </div>
      )}

      {/* Upload Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-sky-600" />
              <span>Import Official LGD Location Master</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload authoritative Excel file containing State &rarr; District &rarr; Block &rarr; Village codes
            </p>
          </div>
        </div>

        {/* Expected columns banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Expected Excel Columns (Tolerant matching):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              LGD District Code
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              District Name
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              LGD Block code
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              Block Name
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              LGD Village Code
            </div>
            <div className="p-2 bg-white rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700 font-semibold text-center">
              Village Name
            </div>
          </div>
        </div>

        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition ${
            dragActive
              ? 'border-sky-500 bg-sky-50/50'
              : selectedFile
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.xlsx"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shadow-inner">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {selectedFile ? (
                  <span className="text-emerald-700 font-mono">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                ) : (
                  <span>Drag and drop your LGD Excel spreadsheet here</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Supports .xls (Excel 97-2004) and .xlsx workbooks up to 25 MB</p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition"
              >
                {selectedFile ? 'Choose Different File' : 'Browse File'}
              </button>

              {selectedFile && (
                <button
                  type="button"
                  onClick={triggerValidation}
                  disabled={validateMutation.isPending}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg shadow-sm transition inline-flex items-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${validateMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>{validateMutation.isPending ? 'Validating File...' : 'Validate File'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Validation Preview Card */}
      {previewData && (
        <div className="bg-white p-6 rounded-2xl border-2 border-sky-200 shadow-md space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-slate-900">Import Validation Preview</h3>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-sky-100 text-sky-800 font-mono">
                  {previewData.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                File: {previewData.fileName} • Hash: {previewData.fileHash.slice(0, 12)}...
              </p>
            </div>

            <div className="flex items-center space-x-2">
              {previewData.errors && previewData.errors.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowErrorsModal(true)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition inline-flex items-center space-x-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>View {previewData.errors.length} Errors</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => confirmMutation.mutate(previewData.importId)}
                disabled={confirmMutation.isPending || previewData.validRows === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition inline-flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle2 className={`w-4 h-4 ${confirmMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{confirmMutation.isPending ? 'Executing Import Transaction...' : 'Confirm & Import into PostgreSQL'}</span>
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Rows</span>
              <div className="text-base font-bold text-slate-900 font-mono mt-0.5">
                {previewData.totalRows.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase">Valid Rows</span>
              <div className="text-base font-bold text-emerald-700 font-mono mt-0.5">
                {previewData.validRows.toLocaleString()}
              </div>
            </div>

            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200">
              <span className="text-[11px] font-semibold text-rose-800 uppercase">Invalid Rows</span>
              <div className="text-base font-bold text-rose-700 font-mono mt-0.5">
                {previewData.invalidRows}
              </div>
            </div>

            <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200">
              <span className="text-[11px] font-semibold text-sky-800 uppercase">Districts (New/Ext)</span>
              <div className="text-sm font-bold text-sky-900 font-mono mt-0.5">
                <span className="text-emerald-600">+{previewData.newDistricts}</span> / {previewData.existingDistricts}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
              <span className="text-[11px] font-semibold text-indigo-800 uppercase">Blocks (New/Ext)</span>
              <div className="text-sm font-bold text-indigo-900 font-mono mt-0.5">
                <span className="text-emerald-600">+{previewData.newBlocks}</span> / {previewData.existingBlocks}
              </div>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
              <span className="text-[11px] font-semibold text-purple-800 uppercase">Villages (New/Ext)</span>
              <div className="text-sm font-bold text-purple-900 font-mono mt-0.5">
                <span className="text-emerald-600">+{previewData.newVillages}</span> / {previewData.existingVillages}
              </div>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
              <span className="text-[11px] font-semibold text-amber-800 uppercase">Duplicates</span>
              <div className="text-base font-bold text-amber-700 font-mono mt-0.5">
                {previewData.potentialDuplicates}
              </div>
            </div>
          </div>

          {/* Sample Valid Rows Table */}
          {previewData.sampleValidRows && previewData.sampleValidRows.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Sample Valid Records ({previewData.sampleValidRows.length} previewed)
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase font-semibold sticky top-0">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">District (Code)</th>
                      <th className="p-2.5">Block (Code)</th>
                      <th className="p-2.5">Village (Code)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewData.sampleValidRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 text-slate-400 font-normal">{r.rowNumber}</td>
                        <td className="p-2.5 font-sans font-semibold text-slate-800">
                          {r.districtName} <span className="text-slate-400 font-mono">({r.lgdDistrictCode})</span>
                        </td>
                        <td className="p-2.5 font-sans text-slate-700">
                          {r.blockName} <span className="text-slate-400 font-mono">({r.lgdBlockCode})</span>
                        </td>
                        <td className="p-2.5 font-sans font-medium text-emerald-700">
                          {r.villageName} <span className="text-slate-400 font-mono">({r.lgdVillageCode})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ERRORS MODAL */}
      {showErrorsModal && previewData?.errors && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600 font-bold text-base">
                <AlertTriangle className="w-5 h-5" />
                <span>Validation Errors ({previewData.errors.length})</span>
              </div>
              <button onClick={() => setShowErrorsModal(false)}>
                <X className="w-5 h-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {previewData.errors.map((err: any, idx: number) => (
                <div key={idx} className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-rose-900">
                    <span>{err.rowNumber > 0 ? `Row #${err.rowNumber}` : 'Global File Structure'}</span>
                    <span className="font-mono text-[11px] text-rose-700">{err.column}</span>
                  </div>
                  <div className="text-slate-700">{err.reason}</div>
                  {err.value !== undefined && (
                    <div className="font-mono text-[11px] text-slate-500">Value: &quot;{String(err.value)}&quot;</div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowErrorsModal(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import History Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Location Master Import History</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Audit log of all uploaded and applied location files</p>
          </div>
        </div>

        {historyLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">Loading import history...</div>
        ) : historyData?.items && historyData.items.length > 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Uploaded By</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Rows</th>
                  <th className="p-3">Entities Created</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyData.items.map((item: any) => (
                  <tr key={item.import_id} className="hover:bg-slate-50">
                    <td className="p-3 font-semibold text-slate-800 font-mono">{item.file_name}</td>
                    <td className="p-3 text-slate-600">{item.uploaded_by}</td>
                    <td className="p-3 text-slate-500">{formatDateTime(item.uploaded_at)}</td>
                    <td className="p-3 font-mono">
                      <span className="text-emerald-700 font-bold">{item.valid_rows}</span> / {item.total_rows}
                    </td>
                    <td className="p-3 font-mono text-slate-700">
                      D:{item.districts_created} | B:{item.blocks_created} | V:{item.villages_created}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-semibold text-[11px] ${
                          item.status === 'IMPORTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'VALIDATED'
                            ? 'bg-sky-100 text-sky-800'
                            : item.status === 'FAILED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            No previous location master files have been imported yet.
          </div>
        )}
      </div>
    </div>
  );
}
