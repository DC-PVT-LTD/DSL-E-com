'use client';

import React from 'react';
import { FilterParams } from '@/types/common';
import { ProductCategory, Brand } from '@/types/product';
import { Filter, RotateCcw, Check } from 'lucide-react';
import { formatLKR } from '@/lib/currency';

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
    <div className={`bg-white rounded-3xl border border-[#C6E7FF]/70 p-5 space-y-6 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#C6E7FF]/40">
        <div className="flex items-center gap-2 text-sm font-bold text-[#292525]">
          <Filter className="w-4 h-4 text-[#0066CC]" />
          <span>Filters</span>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-[#0066CC] hover:underline flex items-center gap-1 font-semibold transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset All</span>
        </button>
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-xs font-bold text-[#292525] uppercase tracking-wider mb-3">
          Categories
        </h4>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ ...filters, category: undefined })}
            className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 rounded-full transition-colors ${
              !filters.category ? 'bg-[#0066CC] text-white font-bold shadow-xs' : 'text-[#292525]/80 hover:bg-[#FFFDF0]'
            }`}
          >
            <span>All Categories</span>
          </button>
          {categories.map((cat) => {
            const isSelected = filters.category === cat.id || filters.category === cat.slug;
            return (
              <button
                key={cat.id}
                onClick={() => onFilterChange({ ...filters, category: cat.id })}
                className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 rounded-full transition-colors ${
                  isSelected ? 'bg-[#0066CC] text-white font-bold shadow-xs' : 'text-[#292525]/80 hover:bg-[#FFFDF0]'
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
      <div className="pt-4 border-t border-[#C6E7FF]/40">
        <h4 className="text-xs font-bold text-[#292525] uppercase tracking-wider mb-3">
          Brands
        </h4>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          <button
            onClick={() => onFilterChange({ ...filters, brand: undefined })}
            className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 rounded-full transition-colors ${
              !filters.brand ? 'bg-[#0066CC] text-white font-bold shadow-xs' : 'text-[#292525]/80 hover:bg-[#FFFDF0]'
            }`}
          >
            <span>All Brands</span>
          </button>
          {brands.map((b) => {
            const isSelected = filters.brand === b.id || filters.brand === b.slug;
            return (
              <button
                key={b.id}
                onClick={() => onFilterChange({ ...filters, brand: b.id })}
                className={`w-full flex items-center justify-between text-left text-xs px-3 py-1.5 rounded-full transition-colors ${
                  isSelected ? 'bg-[#0066CC] text-white font-bold shadow-xs' : 'text-[#292525]/80 hover:bg-[#FFFDF0]'
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
      <div className="pt-4 border-t border-[#C6E7FF]/40">
        <h4 className="text-xs font-bold text-[#292525] uppercase tracking-wider mb-3">
          Price Range (LKR)
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label className="text-[10px] text-[#292525]/60 block mb-1">Min Price (Rs.)</label>
            <input
              type="number"
              placeholder="0"
              value={filters.minPrice !== undefined ? filters.minPrice / 100 : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) * 100 : undefined;
                onFilterChange({ ...filters, minPrice: val });
              }}
              className="w-full px-3 py-1.5 border border-[#C6E7FF] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-[#FFFDF0]"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#292525]/60 block mb-1">Max Price (Rs.)</label>
            <input
              type="number"
              placeholder="3,000"
              value={filters.maxPrice !== undefined ? filters.maxPrice / 100 : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) * 100 : undefined;
                onFilterChange({ ...filters, maxPrice: val });
              }}
              className="w-full px-3 py-1.5 border border-[#C6E7FF] rounded-full focus:outline-none focus:ring-2 focus:ring-[#0066CC] bg-[#FFFDF0]"
            />
          </div>
        </div>
      </div>

      {/* In Stock Only Checkbox */}
      <div className="pt-4 border-t border-[#C6E7FF]/40">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[#292525]">
          <input
            type="checkbox"
            checked={!!filters.inStockOnly}
            onChange={(e) => onFilterChange({ ...filters, inStockOnly: e.target.checked })}
            className="w-4 h-4 rounded border-[#C6E7FF] text-[#0066CC] focus:ring-[#0066CC]"
          />
          <span>In Stock Only</span>
        </label>
      </div>
    </div>

  );
};
