'use client';

import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Check, X, AlertCircle } from 'lucide-react';

interface CatalogExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'csv' | 'xlsx', scope: 'all' | 'selected', columnScope: 'all' | 'visible') => Promise<void>;
  title: string;
  totalFilteredCount: number;
  selectedCount?: number;
}

export const CatalogExportModal: React.FC<CatalogExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  title,
  totalFilteredCount,
  selectedCount = 0,
}) => {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [columnScope, setColumnScope] = useState<'all' | 'visible'>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTriggerExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      await onExport(format, scope, columnScope);
      onClose();
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(err?.message || 'Export failed. Please check permissions or network connection.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{title}</h3>
              <p className="text-xs text-slate-500">Download formatted dataset directly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Format Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">File Format</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormat('xlsx')}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                format === 'xlsx'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 ${format === 'xlsx' ? 'text-blue-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold text-slate-900">Excel (.xlsx)</span>
                <span className="block text-[11px] text-slate-500">Formatted workbook</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('csv')}
              className={`p-3 rounded-xl border flex items-center gap-3 transition-all text-left ${
                format === 'csv'
                  ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <FileText className={`w-5 h-5 ${format === 'csv' ? 'text-blue-600' : 'text-slate-400'}`} />
              <div>
                <span className="block text-xs font-bold text-slate-900">CSV (.csv)</span>
                <span className="block text-[11px] text-slate-500">Standard plain text</span>
              </div>
            </button>
          </div>
        </div>

        {/* Export Scope Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">Records Scope</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'all'}
                onChange={() => setScope('all')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-medium text-slate-800">
                All matching records ({totalFilteredCount} total)
              </span>
            </label>

            {selectedCount > 0 && (
              <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'selected'}
                  onChange={() => setScope('selected')}
                  className="text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs font-medium text-slate-800">
                  Selected rows only ({selectedCount} selected)
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Column Selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 block">Columns Scope</label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="col-scope"
                checked={columnScope === 'all'}
                onChange={() => setColumnScope('all')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-800">All columns</span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
              <input
                type="radio"
                name="col-scope"
                checked={columnScope === 'visible'}
                onChange={() => setColumnScope('visible')}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-800">Visible only</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleTriggerExport}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

