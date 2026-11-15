'use client';

import React, { useState, useEffect } from 'react';
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
  History,
  ShieldCheck,
  Check,
  ExternalLink,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { productService } from '@/services/productService';
import {
  ImportPreviewResult,
  ImportPreviewRow,
  ImportRowStatus,
  ImportBatchResponse,
  ExecuteImportPayload,
} from '@/types/product';
import { formatLKR } from '@/lib/currency';

export default function AdminProductImportPage() {
  const [activeMainTab, setActiveMainTab] = useState<'upload' | 'history'>('upload');

  // File & Preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'invalid' | 'valid' | 'duplicate' | 'existing'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<string | null>(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState<string | null>(null);

  // Duplicate Inspection Modal
  const [inspectingRow, setInspectingRow] = useState<ImportPreviewRow | null>(null);

  // Execution Approval Modal
  const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);
  const [isConfirmedCheckbox, setIsConfirmedCheckbox] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ImportBatchResponse | null>(null);

  // History state
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await productService.getImportHistory(1, 20);
      setHistoryItems(res.items || []);
    } catch (err: any) {
      console.warn('Failed to load import history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeMainTab === 'history') {
      loadHistory();
    }
  }, [activeMainTab]);

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
    setExecutionResult(null);
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

  // Download batch error report from history
  const handleDownloadBatchReport = async (batchId: string, format: 'csv' | 'xlsx' = 'csv') => {
    try {
      const blob = await productService.downloadBatchErrorReport(batchId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dsl-batch-${batchId}-errors.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Failed to download batch report:', err);
      setError(err?.message || 'Failed to download batch report.');
    }
  };

  // Execute import
  const handleConfirmExecute = async () => {
    if (!previewResult || !isConfirmedCheckbox) return;

    setIsExecuting(true);
    setError(null);

    try {
      const payload: ExecuteImportPayload = {
        previewId: previewResult.previewId || 'preview-local',
        previewChecksum: previewResult.previewChecksum || 'checksum-local',
        stockMode: 'SET_STOCK',
        allowUpdates: true,
      };

      const result = await productService.executeImport(payload);
      setExecutionResult(result);
      setIsExecutionModalOpen(false);
      const created = result.createdCount ?? result.successRows ?? 0;
      const updated = result.updatedCount ?? 0;
      const failed = result.failedCount ?? result.failedRows ?? 0;
      setSuccessMsg(`Import batch #${result.batchId} processed successfully! Created: ${created}, Updated: ${updated}, Errors: ${failed}`);
    } catch (err: any) {
      console.error('Execution failed:', err);
      setError(err?.message || 'Import execution failed.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Filter rows
  const filteredRows = (previewResult?.rows || []).filter((r) => {
    if (activeTab === 'invalid' && r.status !== 'INVALID') return false;
    if (activeTab === 'valid' && r.status !== 'VALID' && r.status !== 'WARNING') return false;
    if (activeTab === 'duplicate' && r.status !== 'DUPLICATE_IN_FILE') return false;
    if (activeTab === 'existing' && r.status !== 'EXISTS_IN_DB') return false;

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
              <span>Advanced Product Import Engine</span>
            </h1>
          </div>
          <p className="text-xs text-slate-500 ml-9">
            Upload Excel (.xlsx) or CSV spreadsheets, review syntax validation, compare duplicate SKUs, and execute safe authorized batch imports.
          </p>
        </div>

        {/* Action Buttons & Templates */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleDownloadTemplate('excel')}
            disabled={isDownloadingTemplate !== null}
            className="inline-flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
            title="Download standardized Excel import template"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isDownloadingTemplate === 'excel' ? 'Downloading...' : 'Excel Template'}</span>
          </button>
          <button
            type="button"
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

      {/* Main Mode Toggle: Upload vs History */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveMainTab('upload')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeMainTab === 'upload'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Upload &amp; Validate Spreadsheet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('history')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeMainTab === 'history'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Batch Execution History</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between gap-3 text-rose-800 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between gap-3 text-emerald-800 text-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Tab 1: Upload & Validate */}
      {activeMainTab === 'upload' && (
        <div className="space-y-6">
          {/* Read-Only Safety Banner */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-blue-900 text-xs">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-0.5">Strict Safety Protocol:</span>
              <span>
                File upload validates syntax, SKU collisions, and database references without modifying any existing catalogue records. No database mutations occur until you inspect the preview and explicitly authorize execution.
              </span>
            </div>
          </div>

          {/* Upload Zone */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileUp className="w-4 h-4 text-blue-600" />
              <span>Select File for Validation</span>
            </h2>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-600 hover:bg-slate-50/50 rounded-xl p-6 cursor-pointer transition-all text-center">
                <Upload className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-xs font-bold text-slate-700">
                  {selectedFile ? selectedFile.name : 'Click to select or drag & drop file'}
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  {selectedFile
                    ? `${(selectedFile.size / 1024).toFixed(1)} KB — ready to validate`
                    : 'Supports Excel (.xlsx, .xls) and CSV (.csv) (Max 10MB)'}
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
                  type="button"
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
                      <span>Validate &amp; Preview</span>
                    </>
                  )}
                </button>

                {selectedFile && (
                  <button
                    type="button"
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

          {/* Preview Results Dashboard */}
          {previewResult && (
            <div className="space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Total Rows
                  </span>
                  <span className="text-2xl font-black text-slate-900">{previewResult.summary.totalRows}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Parsed from file</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Valid Rows
                  </span>
                  <span className="text-2xl font-black text-emerald-800">{previewResult.summary.validRows}</span>
                  <span className="text-[10px] text-emerald-600 block mt-0.5">Ready to import</span>
                </div>

                <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block mb-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Invalid Rows
                  </span>
                  <span className="text-2xl font-black text-rose-800">{previewResult.summary.invalidRows}</span>
                  <span className="text-[10px] text-rose-600 block mt-0.5">Validation errors</span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block mb-1 flex items-center gap-1">
                    <Copy className="w-3.5 h-3.5" />
                    File Dupes
                  </span>
                  <span className="text-2xl font-black text-amber-800">{previewResult.summary.duplicateRows}</span>
                  <span className="text-[10px] text-amber-600 block mt-0.5">Duplicate SKUs</span>
                </div>

                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block mb-1 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5" />
                    Existing in DB
                  </span>
                  <span className="text-2xl font-black text-blue-800">{previewResult.summary.existingRows}</span>
                  <span className="text-[10px] text-blue-600 block mt-0.5">Existing SKU match</span>
                </div>

                <div className="bg-yellow-50/70 border border-yellow-200 rounded-xl p-3.5 shadow-xs">
                  <span className="text-[10px] font-bold text-yellow-800 uppercase block mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warnings
                  </span>
                  <span className="text-2xl font-black text-yellow-900">{previewResult.summary.warningRows}</span>
                  <span className="text-[10px] text-yellow-700 block mt-0.5">Price/field alerts</span>
                </div>
              </div>

              {/* Execution Action Bar */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Ready to Execute Batch?</h3>
                  <p className="text-xs text-slate-500">
                    {previewResult.summary.validRows + previewResult.summary.existingRows} row(s) are eligible for creation or update.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsExecutionModalOpen(true)}
                    disabled={previewResult.summary.validRows + previewResult.summary.existingRows === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize &amp; Execute Import</span>
                  </button>
                </div>
              </div>

              {/* Table Toolbar */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    <button
                      type="button"
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
                      type="button"
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
                      type="button"
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
                      type="button"
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
                      type="button"
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
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {previewResult.summary.invalidRows > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadErrorReport('csv')}
                          disabled={isDownloadingReport !== null}
                          className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          title="Download CSV report of invalid rows"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{isDownloadingReport === 'csv' ? '...' : 'Error CSV'}</span>
                        </button>
                        <button
                          type="button"
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
                        <th className="py-3 px-3 text-right">Stock</th>
                        <th className="py-3 px-4">Diagnostics / Validation Notes</th>
                        <th className="py-3 px-3 text-right">Inspect</th>
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
                                  <span className="text-slate-400 font-normal italic" title="Will be auto-generated">
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

                              <td className="py-3 px-3 text-right whitespace-nowrap">
                                {(isExist || isErr || isWarn) && (
                                  <button
                                    type="button"
                                    onClick={() => setInspectingRow(r)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold text-[11px] transition-colors"
                                  >
                                    Compare
                                  </button>
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
      )}

      {/* Main Tab 2: Batch History */}
      {activeMainTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-bold text-slate-900 text-sm">Past Import Batch Executions</h2>
            <button
              type="button"
              onClick={loadHistory}
              disabled={isLoadingHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh History</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="py-3 px-4">Batch ID</th>
                  <th className="py-3 px-3">File Name</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Total Rows</th>
                  <th className="py-3 px-3 text-right">Created</th>
                  <th className="py-3 px-3 text-right">Updated</th>
                  <th className="py-3 px-3 text-right">Failed</th>
                  <th className="py-3 px-3">Executed At</th>
                  <th className="py-3 px-4 text-right">Error Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingHistory ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="inline-flex items-center gap-2">
                        <RotateCcw className="w-4 h-4 animate-spin text-blue-600" />
                        <span>Loading batch execution history...</span>
                      </div>
                    </td>
                  </tr>
                ) : historyItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      No import batch executions recorded yet.
                    </td>
                  </tr>
                ) : (
                  historyItems.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{b.id}
                      </td>
                      <td className="py-3.5 px-3 font-medium text-slate-800">
                        {b.fileName}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900">
                        {b.totalRows}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-emerald-700 font-bold">
                        {b.createdCount}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-blue-700 font-bold">
                        {b.updatedCount}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-rose-700 font-bold">
                        {b.failedCount}
                      </td>
                      <td className="py-3.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {b.failedCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleDownloadBatchReport(b.id, 'csv')}
                            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-bold hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Errors ({b.failedCount})</span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duplicate / Existing Comparison Modal */}
      {inspectingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Row #{inspectingRow.rowNumber} — Comparison &amp; Diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Incoming SKU</span>
                  <span className="font-mono font-bold text-slate-900">{inspectingRow.sku || inspectingRow.proposedSku}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Status Flag</span>
                  <span className="font-bold text-blue-700">{inspectingRow.status}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase font-bold">
                    <tr>
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Spreadsheet Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-500">Product Name</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{inspectingRow.name || '—'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-500">Brand</td>
                      <td className="py-2 px-3 text-slate-800">{inspectingRow.brandName || '—'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-500">Category</td>
                      <td className="py-2 px-3 text-slate-800">{inspectingRow.categoryName || '—'}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-500">Selling Price</td>
                      <td className="py-2 px-3 font-bold text-emerald-700">
                        {inspectingRow.sellingPrice ? formatLKR(Math.round(inspectingRow.sellingPrice * 100)) : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-semibold text-slate-500">Stock Quantity</td>
                      <td className="py-2 px-3 font-bold text-slate-900">{inspectingRow.stockQuantity}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {inspectingRow.errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="font-bold text-rose-800 block text-[11px]">Identified Issues:</span>
                  {inspectingRow.errors.map((e, idx) => (
                    <p key={idx} className="text-rose-700 text-xs flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>{e}</span>
                    </p>
                  ))}
                </div>
              )}

              {inspectingRow.warnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <span className="font-bold text-amber-800 block text-[11px]">System Warnings:</span>
                  {inspectingRow.warnings.map((w, idx) => (
                    <p key={idx} className="text-amber-700 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setInspectingRow(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Administrator Approval & Execution Modal */}
      {isExecutionModalOpen && previewResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Administrator Import Authorization</h3>
                  <p className="text-xs text-slate-500">Confirm execution of validated batch records</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExecutionModalOpen(false)}
                disabled={isExecuting}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Execution Breakdown Summary */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Products to Create</span>
                  <span className="text-lg font-black text-emerald-700">{previewResult.summary.validRows}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Products to Update</span>
                  <span className="text-lg font-black text-blue-700">{previewResult.summary.existingRows}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">Invalid Rows (Skipped)</span>
                  <span className="text-lg font-black text-rose-700">{previewResult.summary.invalidRows}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <span className="text-slate-400 block text-[10px] font-bold uppercase">File Dupes (Skipped)</span>
                  <span className="text-lg font-black text-amber-700">{previewResult.summary.duplicateRows}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                <strong>Data Safety Notice:</strong> Existing products marked for update will update their catalog fields. Stock quantities and prices will only change where explicitly provided. Protected items are preserved by database invariants.
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={isConfirmedCheckbox}
                  onChange={(e) => setIsConfirmedCheckbox(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <span className="font-semibold text-slate-800 text-xs">
                  I have verified the above batch preview summary and authorize execution into the production catalog.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsExecutionModalOpen(false)}
                disabled={isExecuting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExecute}
                disabled={!isConfirmedCheckbox || isExecuting}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-sm transition-all disabled:opacity-40"
              >
                {isExecuting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing Batch...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Authorize &amp; Execute</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
