'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Columns3, Check, RotateCcw, Eye, ChevronDown } from 'lucide-react';

export interface ColumnDefinition {
  id: string;
  label: string;
  visible: boolean;
  locked?: boolean; // Cannot be hidden if true
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDefinition[];
  onChange: (columns: ColumnDefinition[]) => void;
  storageKey?: string;
}

export const ColumnVisibilityDropdown: React.FC<ColumnVisibilityDropdownProps> = ({
  columns,
  onChange,
  storageKey,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize from localStorage if key provided
  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const visibilityMap: Record<string, boolean> = JSON.parse(saved);
        const updated = columns.map((col) => ({
          ...col,
          visible: col.locked ? true : (visibilityMap[col.id] ?? col.visible),
        }));
        // Only update if there is a difference to avoid infinite loop
        const hasDiff = updated.some((col, idx) => col.visible !== columns[idx].visible);
        if (hasDiff) {
          onChange(updated);
        }
      }
    } catch (e) {
      console.warn('Failed to parse column preferences:', e);
    }
  }, [storageKey]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const saveToStorage = (cols: ColumnDefinition[]) => {
    if (!storageKey || typeof window === 'undefined') return;
    try {
      const map = cols.reduce((acc, c) => ({ ...acc, [c.id]: c.visible }), {});
      localStorage.setItem(storageKey, JSON.stringify(map));
    } catch (e) {
      console.warn('Failed to save column preferences:', e);
    }
  };

  const toggleColumn = (id: string) => {
    const updated = columns.map((col) => {
      if (col.id === id && !col.locked) {
        return { ...col, visible: !col.visible };
      }
      return col;
    });
    onChange(updated);
    saveToStorage(updated);
  };

  const showAll = () => {
    const updated = columns.map((c) => ({ ...c, visible: true }));
    onChange(updated);
    saveToStorage(updated);
  };

  const resetDefaults = () => {
    if (storageKey && typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
    const updated = columns.map((c) => ({ ...c, visible: true }));
    onChange(updated);
  };

  const visibleCount = columns.filter((c) => c.visible).length;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        title="Customize visible table columns"
      >
        <Columns3 className="w-3.5 h-3.5 text-slate-500" />
        <span>Columns ({visibleCount}/{columns.length})</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-2 divide-y divide-slate-100 text-xs">
          <div className="px-3 py-1.5 flex items-center justify-between text-slate-500 font-semibold">
            <span>Toggle Columns</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={showAll}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={resetDefaults}
                className="text-slate-500 hover:text-slate-700 font-medium"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="py-1 max-h-64 overflow-y-auto">
            {columns.map((col) => (
              <label
                key={col.id}
                className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-slate-50 transition-colors ${
                  col.locked ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={col.visible}
                  disabled={col.locked}
                  onChange={() => toggleColumn(col.id)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span className="text-slate-700 font-medium select-none truncate">
                  {col.label} {col.locked && <span className="text-[10px] text-slate-400">(fixed)</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

