'use client';

import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2, XCircle, FileText, Check, AlertCircle } from 'lucide-react';
import { uploadService } from '@/services/uploadService';
import { productService } from '@/services/productService';
import { UploadedListDocument } from '@/types/upload';

export default function AdminUploadReviewsPage() {
  const [uploads, setUploads] = useState<UploadedListDocument[]>([]);
  const [selectedUpload, setSelectedUpload] = useState<UploadedListDocument | null>(null);

  const loadData = () => {
    const all = uploadService.getAll();
    setUploads(all);
    if (all.length > 0 && !selectedUpload) {
      setSelectedUpload(all[0]);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = uploadService.subscribe(loadData);
    return () => unsub();
  }, []);

  const handleApprove = (id: string) => {
    uploadService.updateUploadStatus(id, 'reviewed');
    loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          Uploaded Booklists Review Queue
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review customer uploaded booklists, verify extracted stationery items, and confirm product matches
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Uploads Queue (Left 4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 p-4 space-y-2 shadow-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-2">
            Uploaded Documents Queue ({uploads.length})
          </span>
          {uploads.map((u) => {
            const isSelected = selectedUpload?.id === u.id;
            return (
              <button
                key={u.id}
                onClick={() => setSelectedUpload(u)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-[#08275E] bg-blue-50/50 shadow-xs'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-900 truncate max-w-40">{u.fileName}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    {u.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>{new Date(u.uploadedAt).toLocaleDateString()}</span>
                  <span>{u.extractedItems.length} lines extracted</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Document Details & Verification (Right 8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
          {selectedUpload ? (
            <>
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{selectedUpload.fileName}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Uploaded: {new Date(selectedUpload.uploadedAt).toLocaleString()} • Type: {selectedUpload.fileType}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(selectedUpload.id)}
                    className="bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 text-[#FFD21C]" />
                    <span>Approve Matches</span>
                  </button>
                </div>
              </div>

              {selectedUpload.customerNotes && (
                <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl text-xs text-blue-900">
                  <strong className="block text-[#08275E] mb-0.5">Customer Instructions:</strong>
                  {selectedUpload.customerNotes}
                </div>
              )}

              {/* Extracted Lines & Suggested Match */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Extracted Items &amp; Confidence Scores
                </h3>

                {selectedUpload.extractedItems.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px] mb-1">
                        <span>Raw OCR: &ldquo;{item.rawText}&rdquo;</span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        Matched: {item.itemDescription}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        Quantity: <strong>{item.quantity}</strong> units
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        item.confidence === 'high'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {Math.round(item.confidenceScore * 100)}% Confidence
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-400 py-12 text-center">Select an uploaded booklist from the left.</p>
          )}
        </div>
      </div>
    </div>
  );
}
