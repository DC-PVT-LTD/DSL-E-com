'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Database,
  Download,
  Info,
  Search,
  RefreshCw,
  X,
  FileUp,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { ImportPreviewResult, ImportPreviewRow, ImportRowStatus } from '@/types/product';
import { formatLKR } from '@/lib/currency';

export default function AdminProductImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'invalid' | 'valid' | 'duplicate' | 'existing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState<string | null>(null);

  // Handle template download
  const handleDownloadTemplate = async (format: 'excel' | 'csv') => {
    try {
      setIsDownloadingTemplate(format);
      setError(null);
      const blob = await productService.downloadImportTemplate(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsl-product-import-template.${format === 'excel' ? 'xlsx' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download template:', err);
      setError(err?.message || `Failed to download ${format} template`);
    } finally {
      setIsDownloadingTemplate(null);
    }
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError(`File "${file.name}" exceeds maximum allowed size of 10MB.`);
      setSelectedFile(null);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setError(`Unsupported file format ".${ext}". Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.`);
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreviewResult(null);
  };

  // Upload and parse file
  const handleUploadAndPreview = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await productService.uploadImportPreview(selectedFile);
      setPreviewResult(result);
    } catch (err: any) {
      console.error('Import validation failed:', err);
      setError(err?.message || 'Failed to parse and validate import file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Download error report
  const handleDownloadErrorReport = async (format: 'csv' | 'xlsx') => {
    if (!previewResult) return;
    const errorRows = previewResult.rows.filter(
      (r) => r.status === 'INVALID' || r.status === 'DUPLICATE_IN_FILE' || r.warnings.length > 0
    );
    const targetRows = errorRows.length > 0 ? errorRows : previewResult.rows;

    try {
      setIsDownloadingReport(format);
      setError(null);
      const blob = await productService.downloadErrorReport(targetRows, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsl-import-validation-report.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download error report:', err);
      setError(err?.message || 'Failed to generate error report.');
    } finally {
      setIsDownloadingReport(null);
    }
  };

  // Filter rows
  const filteredRows = (previewResult?.rows || []).filter((r) => {
    // Tab filtering
    if (activeTab === 'invalid' && r.status !== 'INVALID') return false;
    if (activeTab === 'valid' && r.status !== 'VALID' && r.status !== 'WARNING') return false;
    if (activeTab === 'duplicate' && r.status !== 'DUPLICATE_IN_FILE') return false;
    if (activeTab === 'existing' && r.status !== 'EXISTS_IN_DB') return false;

    // Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = r.name.toLowerCase().includes(q);
      const matchSku = (r.sku || r.proposedSku).toLowerCase().includes(q);
      const matchCat = r.categoryName.toLowerCase().includes(q);
      const matchBrand = r.brandName.toLowerCase().includes(q);
      const matchErr = r.errors.some((e) => e.toLowerCase().includes(q));
      const matchWarn = r.warnings.some((w) => w.toLowerCase().includes(q));
      return matchName || matchSku || matchCat || matchBrand || matchErr || matchWarn;
    }

    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link
              href="/admin/products"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Back to products list"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
              <span>Bulk Product Import Engine</span>
            </h1>
            <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Stage 3: Preview & Validation
            </span>
          </div>
          <p className="text-xs text-slate-500 ml-9">
            Upload Excel (.xlsx) or CSV (.csv) spreadsheets to inspect syntax, match categories, brands, variants, and detect Global SKU collisions.
          </p>
        </div>

        {/* Template Downloads */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownloadTemplate('excel')}
            disabled={isDownloadingTemplate !== null}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            title="Download standardized Excel import template"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isDownloadingTemplate === 'excel' ? 'Downloading...' : 'Excel Template'}</span>
          </button>
          <button
            onClick={() => handleDownloadTemplate('csv')}
            disabled={isDownloadingTemplate !== null}
            className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            title="Download standardized CSV import template"
          >
            <FileText className="w-4 h-4 text-slate-600" />
            <span>{isDownloadingTemplate === 'csv' ? 'Downloading...' : 'CSV Template'}</span>
          </button>
        </div>
      </div>

      {/* Stage 3 Read-Only Guard Notice */}
      <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold block mb-0.5">Strict Preview Mode (Zero Database Mutations):</span>
          <span>
            This stage performs read-only parsing, syntax validation, category/subcategory hierarchy matching, and Global SKU registry collision detection. No products, variants, or stock levels will be modified until explicit import execution in Stage 4.
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center justify-between gap-3 text-rose-800 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload Zone */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <FileUp className="w-4 h-4 text-[#08275E]" />
          <span>Select File for Validation</span>
        </h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-[#08275E] hover:bg-slate-50/50 rounded-xl p-6 cursor-pointer transition-all text-center">
            <Upload className="w-8 h-8 text-slate-400 mb-2" />
            <span className="text-xs font-bold text-slate-700">
              {selectedFile ? selectedFile.name : 'Click to select or drag & drop file'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {selectedFile
                ? `${(selectedFile.size / 1024).toFixed(1)} KB — ready to validate`
                : 'Supports .xlsx, .xls, and .csv (Max 10MB)'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          <div className="flex flex-col gap-2 shrink-0 sm:w-48">
            <button
              onClick={handleUploadAndPreview}
              disabled={!selectedFile || isUploading}
              className="inline-flex items-center justify-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs py-3.5 px-4 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-[#FFD21C]" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#FFD21C]" />
                  <span>Validate & Preview</span>
                </>
              )}
            </button>

            {selectedFile && (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewResult(null);
                }}
                disabled={isUploading}
                className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear File</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Preview Summary Cards */}
      {previewResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Total Rows
              </span>
              <span className="text-2xl font-black text-slate-900">{previewResult.summary.totalRows}</span>
              <span className="text-[10px] text-slate-400 block mt-1">Parsed from spreadsheet</span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valid Rows
              </span>
              <span className="text-2xl font-black text-emerald-800">{previewResult.summary.validRows}</span>
              <span className="text-[10px] text-emerald-600 block mt-1">Ready for Stage 4 import</span>
            </div>

            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Invalid Rows
              </span>
              <span className="text-2xl font-black text-rose-800">{previewResult.summary.invalidRows}</span>
              <span className="text-[10px] text-rose-600 block mt-1">Contain validation errors</span>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Copy className="w-3.5 h-3.5" />
                File Dupes
              </span>
              <span className="text-2xl font-black text-amber-800">{previewResult.summary.duplicateRows}</span>
              <span className="text-[10px] text-amber-600 block mt-1">Duplicate SKUs in file</span>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <Database className="w-3.5 h-3.5" />
                Existing in DB
              </span>
              <span className="text-2xl font-black text-blue-800">{previewResult.summary.existingRows}</span>
              <span className="text-[10px] text-blue-600 block mt-1">Will update existing SKU</span>
            </div>

            <div className="bg-yellow-50/70 border border-yellow-200 rounded-2xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-yellow-800 uppercase tracking-wider block mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Warnings
              </span>
              <span className="text-2xl font-black text-yellow-900">{previewResult.summary.warningRows}</span>
              <span className="text-[10px] text-yellow-700 block mt-1">Price/sanity alerts</span>
            </div>
          </div>

          {/* Table Actions & Error Report Download */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Rows ({previewResult.summary.totalRows})
                </button>
                <button
                  onClick={() => setActiveTab('invalid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'invalid'
                      ? 'bg-rose-600 text-white'
                      : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
                >
                  Errors Only ({previewResult.summary.invalidRows})
                </button>
                <button
                  onClick={() => setActiveTab('valid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'valid'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  Valid Only ({previewResult.summary.validRows})
                </button>
                <button
                  onClick={() => setActiveTab('duplicate')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'duplicate'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                  }`}
                >
                  Duplicates ({previewResult.summary.duplicateRows})
                </button>
                <button
                  onClick={() => setActiveTab('existing')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    activeTab === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  Existing in DB ({previewResult.summary.existingRows})
                </button>
              </div>

              {/* Search & Download Error Report */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1 md:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search preview rows..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-[#08275E]"
                  />
                </div>

                {previewResult.summary.invalidRows > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDownloadErrorReport('csv')}
                      disabled={isDownloadingReport !== null}
                      className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      title="Download CSV report of invalid rows"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isDownloadingReport === 'csv' ? '...' : 'Error CSV'}</span>
                    </button>
                    <button
                      onClick={() => handleDownloadErrorReport('xlsx')}
                      disabled={isDownloadingReport !== null}
                      className="inline-flex items-center gap-1.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      title="Download Excel report of invalid rows"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{isDownloadingReport === 'xlsx' ? '...' : 'Error Excel'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Table */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Row</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3">Category / Subcat</th>
                    <th className="py-3 px-3">Brand</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3 text-right">Cost Price</th>
                    <th className="py-3 px-3 text-right">Stock</th>
                    <th className="py-3 px-4">Diagnostics / Validation Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        No rows found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((r) => {
                      const isErr = r.status === 'INVALID' || r.status === 'DUPLICATE_IN_FILE';
                      const isWarn = r.status === 'WARNING';
                      const isExist = r.status === 'EXISTS_IN_DB';

                      return (
                        <tr
                          key={r.rowNumber}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isErr ? 'bg-rose-50/30' : isWarn ? 'bg-yellow-50/20' : isExist ? 'bg-blue-50/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-bold text-slate-500 text-[11px]">
                            #{r.rowNumber}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            {r.status === 'VALID' && (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                VALID
                              </span>
                            )}
                            {r.status === 'INVALID' && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                INVALID
                              </span>
                            )}
                            {r.status === 'DUPLICATE_IN_FILE' && (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <Copy className="w-3 h-3 text-amber-600" />
                                DUPLICATE
                              </span>
                            )}
                            {r.status === 'EXISTS_IN_DB' && (
                              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <Database className="w-3 h-3 text-blue-600" />
                                EXISTS (UPDATE)
                              </span>
                            )}
                            {r.status === 'WARNING' && (
                              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3 text-yellow-700" />
                                WARNING
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {r.sku ? (
                              <span>{r.sku}</span>
                            ) : (
                              <span className="text-slate-400 font-normal italic" title="Will be auto-generated in Stage 4">
                                {r.proposedSku}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 font-medium text-slate-900 max-w-[220px] truncate" title={r.name}>
                            {r.name || <span className="text-rose-500 italic">[Missing Name]</span>}
                            {r.isVariant && (
                              <span className="ml-1.5 bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                                Variant
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-medium text-slate-800">{r.categoryName || '—'}</span>
                            {r.subcategoryName && (
                              <span className="text-slate-400 block text-[11px]">↳ {r.subcategoryName}</span>
                            )}
                          </td>

                          <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                            {r.brandName || '—'}
                          </td>

                          <td className="py-3 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                            {r.sellingPrice ? formatLKR(Math.round(r.sellingPrice * 100)) : '—'}
                          </td>

                          <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                            {r.costPrice ? formatLKR(Math.round(r.costPrice * 100)) : '—'}
                          </td>

                          <td className="py-3 px-3 text-right font-mono font-medium text-slate-800 whitespace-nowrap">
                            {r.stockQuantity}
                          </td>

                          <td className="py-3 px-4 max-w-[320px]">
                            {r.errors.length > 0 && (
                              <div className="space-y-1 mb-1">
                                {r.errors.map((e, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[11px] text-rose-700 bg-rose-100/70 rounded-md px-2 py-0.5 flex items-center gap-1 font-medium"
                                  >
                                    <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
                                    <span>{e}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {r.warnings.length > 0 && (
                              <div className="space-y-1">
                                {r.warnings.map((w, idx) => (
                                  <div
                                    key={idx}
                                    className="text-[11px] text-yellow-800 bg-yellow-100/70 rounded-md px-2 py-0.5 flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-yellow-600 shrink-0" />
                                    <span>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {r.errors.length === 0 && r.warnings.length === 0 && (
                              <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Passed all validation checks
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

