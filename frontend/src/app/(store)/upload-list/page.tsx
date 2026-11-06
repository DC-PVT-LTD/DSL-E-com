'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, CheckCircle2, AlertCircle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { uploadService } from '@/services/uploadService';

export default function UploadListPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customerNotes, setCustomerNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileChange = (file: File) => {
    setErrorMsg(null);
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Please upload a JPG, PNG image or PDF document.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('File size exceeds 10MB limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Please select a booklist file first.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(20);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => (prev < 90 ? prev + 15 : prev));
    }, 300);

    try {
      const doc = await uploadService.uploadDocument(selectedFile, customerNotes);
      clearInterval(progressInterval);
      setUploadProgress(100);
      router.push(`/upload-list/${doc.id}/review`);
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      setErrorMsg(err.message || 'Failed to upload and analyze document. Please check file format.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-10">
      {/* Header */}
      <div className="text-center max-w-xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-[#FFD84D] text-[#594300] text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-2xs">
          <Upload className="w-4 h-4 text-[#594300]" />
          <span>Smart Booklist Matcher</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          Upload Your Stationery List
        </h1>
        <p className="text-sm text-[#292525]/70 leading-relaxed">
          Snap a photo of your handwritten school booklist or upload a school PDF.
          Our smart matcher extracts the items and quantities and finds exact product matches in seconds.
        </p>
      </div>

      {/* Review-First Notice */}
      <div className="bg-[#FFF9D2] border border-[#FFD84D] rounded-2xl p-4 text-xs text-[#594300] flex items-start gap-3 shadow-xs">
        <AlertCircle className="w-5 h-5 text-[#B38A00] shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Review-First Guarantee:</strong> Your uploaded list is processed with smart OCR and matched against our live catalogue. You review all items, verify alternatives, and only confirmed items are added to your cart. No automatic orders or payments are ever made.
        </div>
      </div>

      {/* Upload Drop Zone Card */}
      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-10 space-y-6 shadow-sm">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            selectedFile
              ? 'border-emerald-500 bg-emerald-50/20'
              : 'border-[#C6E7FF] hover:border-[#0066CC] bg-[#FFFDF0]/60 hover:bg-[#FFFDF0]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            accept=".jpg,.jpeg,.png,.pdf"
            className="hidden"
          />

          <div className="w-16 h-16 rounded-2xl bg-[#EBD5FA]/50 text-[#8629B3] flex items-center justify-center mx-auto mb-4 border border-[#CFA6E8]/40">
            <Upload className="w-8 h-8 text-[#8629B3]" />
          </div>

          {selectedFile ? (
            <div className="space-y-1">
              <span className="text-sm font-bold text-[#292525] block flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {selectedFile.name}
              </span>
              <span className="text-xs text-[#292525]/60">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Click to change file
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-sm font-bold text-[#292525] block">
                Drag and drop your booklist here, or <span className="text-[#0066CC] underline">browse files</span>
              </span>
              <span className="text-xs text-[#292525]/50 block">
                Supports JPG, PNG images and PDF documents up to 10MB
              </span>
            </div>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs font-semibold text-rose-600 text-center">{errorMsg}</p>
        )}

        {/* Customer Notes */}
        <div className="space-y-1.5 text-xs">
          <label className="font-bold text-[#292525] block">Additional Notes or Brand Preferences (Optional)</label>
          <input
            type="text"
            placeholder="e.g. Prefer Atlas CR books and Nataraj pencils for Grade 6"
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-stone-200 focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 text-[#292525] bg-[#FFFDF0]/50"
          />
        </div>

        {/* Progress bar if uploading */}
        {isUploading && (
          <div className="space-y-2 pt-2 animate-fade-in">
            <div className="flex justify-between text-xs text-[#292525]/70 font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0066CC]" />
                Simulating OCR Extraction &amp; Product Matching...
              </span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0066CC] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!selectedFile || isUploading}
          className="w-full flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white py-4 rounded-full font-bold text-sm shadow-md transition-all disabled:opacity-40"
        >
          {isUploading ? (
            <span>Extracting Items...</span>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-white" />
              <span>Process Booklist &amp; Match Products</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
