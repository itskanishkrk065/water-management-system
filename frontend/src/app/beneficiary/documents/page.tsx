'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  PlusCircle,
  Download,
  Filter,
  CheckCircle2,
  X,
  FileCheck2,
  FolderArchive,
  Save,
  AlertCircle,
} from 'lucide-react';

const CATEGORIES = [
  { id: 'ALL', label: 'All Documents' },
  { id: 'LAND_RECORD', label: 'Land Records & Patta' },
  { id: 'WATER_APPLICATION', label: 'Water Applications' },
  { id: 'APPROVAL_LETTER', label: 'Sanction Letters' },
  { id: 'PAYMENT_RECEIPT', label: 'Payment Receipts' },
  { id: 'INFRASTRUCTURE_REPORT', label: 'Engineering Reports' },
  { id: 'EXTENSION_REQUEST', label: 'Extension Records' },
  { id: 'OTHER', label: 'Other Documents' },
];

export default function BeneficiaryDocumentsPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    fileName: '',
    category: 'LAND_RECORD',
    storagePath: '',
    referenceId: '',
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['beneficiary-documents'],
    queryFn: async () => {
      const res = await apiClient.get('/beneficiary/documents');
      return res.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/beneficiary/documents', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficiary-documents'] });
      setShowUploadModal(false);
      setFormData({
        title: '',
        fileName: '',
        category: 'LAND_RECORD',
        storagePath: '',
        referenceId: '',
      });
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to register document.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!formData.title.trim() || !formData.fileName.trim()) {
      setErrorMsg('Title and file name are required');
      return;
    }

    uploadMutation.mutate({
      title: formData.title.trim(),
      fileName: formData.fileName.trim(),
      category: formData.category,
      storagePath: formData.storagePath.trim() || `/documents/beneficiary/${formData.fileName.trim()}`,
      referenceId: formData.referenceId.trim() || undefined,
      fileSizeBytes: 1024 * 250, // 250 KB default
      mimeType: 'application/pdf',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const list = documents || [];
  const filteredList =
    selectedCategory === 'ALL'
      ? list
      : list.filter((doc: any) => doc.category === selectedCategory);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Document Repository &amp; Records
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Store and retrieve verified revenue patta records, sanction letters, and payment vouchers
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow transition shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              selectedCategory === cat.id
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Documents Grid / Table */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <FolderArchive className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Registered Files</h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {filteredList.length} Files
          </span>
        </div>

        {filteredList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider bg-slate-50/50 font-sans">
                  <th className="py-3 px-4">Document Title</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Date Uploaded</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((doc: any) => (
                  <tr key={doc.document_id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900 flex items-center space-x-2">
                      <FileText className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{doc.title}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {doc.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 truncate max-w-xs">
                      {doc.file_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {formatDate(doc.created_at)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <a
                        href={`#download-${doc.document_id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          alert(`File ${doc.file_name} is archived in the secure object repository.`);
                        }}
                        className="inline-flex items-center space-x-1 text-sky-700 hover:text-sky-800 font-semibold"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-xs text-slate-400">
            No documents found in this category.
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Upload &amp; Register Document</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-300 text-rose-800 p-3 rounded-lg text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Document Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                >
                  {CATEGORIES.filter((c) => c.id !== 'ALL').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Document Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Revenue Patta Passbook No 4029"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  File Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fileName}
                  onChange={(e) => setFormData({ ...formData, fileName: e.target.value })}
                  placeholder="e.g. patta_4029.pdf"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Reference ID (Optional)
                </label>
                <input
                  type="text"
                  value={formData.referenceId}
                  onChange={(e) => setFormData({ ...formData, referenceId: e.target.value })}
                  placeholder="e.g. SF-104/1A"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{uploadMutation.isPending ? 'Registering...' : 'Save Document'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
