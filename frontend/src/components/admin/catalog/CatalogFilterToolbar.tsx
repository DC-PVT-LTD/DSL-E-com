'use client';

import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';

export interface ActiveFilterChip {
  id: string;
  label: string;
  value: string;
  onRemove: () => void;
}

interface CatalogFilterToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  activeChips: ActiveFilterChip[];
  onClearAll: () => void;
  children?: React.ReactNode; // Filter select dropdowns passed by parent
  totalResults?: number;
  rightAction?: React.ReactNode; // e.g. Column visibility or export buttons
}

export const CatalogFilterToolbar: React.FC<CatalogFilterToolbarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search by name, SKU, or ID...',
  activeChips,
  onClearAll,
  children,
  totalResults,
  rightAction,
}) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns (children) */}
        {children && (
          <div className="flex flex-wrap items-center gap-2">
            {children}
          </div>
        )}

        {/* Right actions (e.g. Columns, Export) */}
        {rightAction && (
          <div className="flex items-center gap-2">
            {rightAction}
          </div>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium">Active filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-medium text-xs"
            >
              <span>{chip.label}: <strong className="font-semibold">{chip.value}</strong></span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="hover:bg-blue-100 rounded p-0.5 text-blue-600 transition-colors"
                title={`Remove ${chip.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs font-semibold hover:bg-slate-100 rounded-md transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Clear all</span>
          </button>

          {totalResults !== undefined && (
            <span className="ml-auto text-slate-500 font-medium">
              Found <strong className="text-slate-900 font-semibold">{totalResults}</strong> matching records
            </span>
          )}
        </div>
      )}
    </div>
  );
};

