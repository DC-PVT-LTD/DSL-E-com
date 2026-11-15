'use client';

import React from 'react';
import { FilterParams } from '@/types/common';
import { ProductCategory, Brand } from '@/types/product';
import { Filter, RotateCcw, Check } from 'lucide-react';

interface ProductFiltersProps {
  categories: ProductCategory[];
  brands: Brand[];
  filters: FilterParams;
  onFilterChange: (newFilters: FilterParams) => void;
  onReset: () => void;
  className?: string;
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  brands,
  filters,
  onFilterChange,
  onReset,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-3xl border border-slate-200/80 p-5 space-y-6 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2 text-sm font-black text-[#09285C]">
          <Filter className="w-4 h-4 text-[#0866E8]" />
          <span>Filters</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-[#0866E8] hover:underline flex items-center gap-1 font-bold transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </button>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-black text-[#09285C] uppercase tracking-wider mb-2.5">
          Categories
        </h4>
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, category: undefined })}
            className={`w-full flex items-center justify-between text-left text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${
              !filters.category ? 'bg-[#09285C] text-white font-bold shadow-xs' : 'text-[#09285C]/80 hover:bg-[#F7FAFF]'
            }`}
          >
            <span>All Categories</span>
          </button>
          {categories.map((cat, idx) => {
            const currentCat = (filters.category || '').toLowerCase();
            const isSelected =
              Boolean(currentCat) &&
              (currentCat === cat.id.toLowerCase() ||
                currentCat === (cat.slug || '').toLowerCase() ||
                currentCat === cat.id.toLowerCase().replace(/^cat-/, ''));
            return (
              <button
                key={`filter-cat-${cat.id}-${cat.slug || idx}`}
                type="button"
                onClick={() => onFilterChange({ ...filters, category: cat.slug || cat.id })}
                className={`w-full flex items-center justify-between text-left text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#09285C] text-white font-bold shadow-xs' : 'text-[#09285C]/80 hover:bg-[#F7FAFF]'
                }`}
              >
                <span className="truncate">{cat.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Brands */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-black text-[#09285C] uppercase tracking-wider mb-2.5">
          Brands
        </h4>
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => onFilterChange({ ...filters, brand: undefined })}
            className={`w-full flex items-center justify-between text-left text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${
              !filters.brand ? 'bg-[#09285C] text-white font-bold shadow-xs' : 'text-[#09285C]/80 hover:bg-[#F7FAFF]'
            }`}
          >
            <span>All Brands</span>
          </button>
          {brands.map((b, idx) => {
            const isSelected = filters.brand === b.id || filters.brand === b.slug;
            return (
              <button
                key={`filter-brand-${b.id}-${b.slug || idx}`}
                type="button"
                onClick={() => onFilterChange({ ...filters, brand: b.id })}
                className={`w-full flex items-center justify-between text-left text-xs px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  isSelected ? 'bg-[#09285C] text-white font-bold shadow-xs' : 'text-[#09285C]/80 hover:bg-[#F7FAFF]'
                }`}
              >
                <span className="truncate">{b.name}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Price Range */}
      <div className="pt-4 border-t border-slate-100">
        <h4 className="text-xs font-black text-[#09285C] uppercase tracking-wider mb-2.5">
          Price Range (LKR)
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-[#64748B] block mb-1 font-semibold">Min (Rs.)</label>
            <input
              type="number"
              placeholder="0"
              value={filters.minPrice !== undefined ? filters.minPrice / 100 : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) * 100 : undefined;
                onFilterChange({ ...filters, minPrice: val });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0866E8] bg-[#F7FAFF] text-xs font-semibold text-[#09285C]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#64748B] block mb-1 font-semibold">Max (Rs.)</label>
            <input
              type="number"
              placeholder="3,000"
              value={filters.maxPrice !== undefined ? filters.maxPrice / 100 : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) * 100 : undefined;
                onFilterChange({ ...filters, maxPrice: val });
              }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:border-[#0866E8] bg-[#F7FAFF] text-xs font-semibold text-[#09285C]"
            />
          </div>
        </div>
      </div>

      {/* In Stock Only Checkbox */}
      <div className="pt-4 border-t border-slate-100">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-[#09285C] touch-target">
          <input
            type="checkbox"
            checked={!!filters.inStockOnly}
            onChange={(e) => onFilterChange({ ...filters, inStockOnly: e.target.checked })}
            className="w-4 h-4 rounded-md border-slate-300 text-[#0866E8] focus:ring-[#0866E8] cursor-pointer"
          />
          <span>In Stock Items Only</span>
        </label>
      </div>
    </div>
  );
};
