'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Search,
  Plus,
  Trash2,
  Upload,
  Download,
  ShoppingCart,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Package,
  Layers,
  ArrowRight,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileText,
  Check,
} from 'lucide-react';
import { formatLKR, FREE_DELIVERY_THRESHOLD_CENTS } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import {
  bulkOrderService,
  BulkOrderSearchResult,
  ValidatedBulkOrderItem,
  ParsedCsvRow,
} from '@/services/bulkOrderService';

interface BulkOrderRow {
  id: string; // unique row id (e.g. prodId-varId or uuid)
  productId: string;
  variantId?: string | null;
  sku: string;
  name: string;
  image?: string;
  categoryName?: string;
  brandName?: string;
  unitPriceCents: number;
  stockQuantity: number;
  quantity: number;
  error?: string | null;
}

export default function BulkOrderPage() {
  const addBulkItems = useCartStore((state) => state.addBulkItems);

  // Table rows
  const [rows, setRows] = useState<BulkOrderRow[]>([]);

  // Manual Autocomplete Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BulkOrderSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<BulkOrderSearchResult | null>(null);
  const [quickAddQty, setQuickAddQty] = useState<number>(10);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  // CSV Import State
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvValidatedRows, setCsvValidatedRows] = useState<ValidatedBulkOrderItem[]>([]);
  const [csvValidating, setCsvValidating] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    addedCount: number;
    failedCount: number;
    results: any[];
  } | null>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await bulkOrderService.search(searchQuery.trim());
      setSearchResults(results);
      setIsSearching(false);
      setIsDropdownOpen(true);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle selecting product from autocomplete
  const handleSelectProduct = (product: BulkOrderSearchResult) => {
    setSelectedProduct(product);
    setSearchQuery(`${product.name} (${product.sku})`);
    setIsDropdownOpen(false);
    setQuickAddError(null);
  };

  // Add Row from Quick Search Form
  const handleAddQuickRow = () => {
    if (!selectedProduct) {
      setQuickAddError('Please search and select a product first.');
      return;
    }

    if (!quickAddQty || quickAddQty < 1) {
      setQuickAddError('Quantity must be at least 1.');
      return;
    }

    if (quickAddQty > selectedProduct.stockQuantity) {
      setQuickAddError(`Only ${selectedProduct.stockQuantity} units available in stock.`);
      return;
    }

    // Check if already in list
    const existingIndex = rows.findIndex(
      (r) =>
        r.productId === selectedProduct.productId &&
        r.variantId === (selectedProduct.variantId || null)
    );

    if (existingIndex > -1) {
      const existing = rows[existingIndex];
      const newQty = existing.quantity + quickAddQty;
      if (newQty > selectedProduct.stockQuantity) {
        setQuickAddError(
          `Already have ${existing.quantity} in list. Maximum available is ${selectedProduct.stockQuantity}.`
        );
        return;
      }

      const updated = [...rows];
      updated[existingIndex] = {
        ...existing,
        quantity: newQty,
        error: null,
      };
      setRows(updated);
    } else {
      const newRow: BulkOrderRow = {
        id: selectedProduct.id,
        productId: selectedProduct.productId,
        variantId: selectedProduct.variantId || null,
        sku: selectedProduct.sku,
        name: selectedProduct.name,
        image: selectedProduct.images?.[0],
        categoryName: selectedProduct.categoryName,
        brandName: selectedProduct.brandName,
        unitPriceCents: selectedProduct.priceCents,
        stockQuantity: selectedProduct.stockQuantity,
        quantity: quickAddQty,
        error: null,
      };
      setRows((prev) => [newRow, ...prev]);
    }

    // Reset quick form
    setSelectedProduct(null);
    setSearchQuery('');
    setQuickAddQty(10);
    setQuickAddError(null);
  };

  // Update quantity in table row
  const handleUpdateRowQty = (rowId: string, val: string) => {
    const num = parseInt(val, 10);
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        if (isNaN(num) || num < 1) {
          return { ...r, quantity: isNaN(num) ? 0 : num, error: 'Must be >= 1' };
        }
        if (num > r.stockQuantity) {
          return {
            ...r,
            quantity: num,
            error: `Max stock is ${r.stockQuantity}`,
          };
        }
        return { ...r, quantity: num, error: null };
      })
    );
  };

  // Remove individual row
  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Clear all rows
  const handleClearAll = () => {
    if (rows.length === 0) return;
    if (confirm('Are you sure you want to clear all product rows?')) {
      setRows([]);
      setSubmissionFeedback(null);
    }
  };

  // CSV File Handler
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCsvFile(file);
  };

  const processCsvFile = async (file: File) => {
    setCsvFile(file);
    setCsvParsing(true);
    setCsvErrors([]);
    setCsvValidatedRows([]);

    try {
      const text = await file.text();
      const { rows: parsed, errors } = bulkOrderService.parseCsv(text);

      if (errors.length > 0) {
        setCsvErrors(errors);
        setCsvParsing(false);
        return;
      }

      // Validate parsed rows against backend PostgreSQL
      setCsvValidating(true);
      const validation = await bulkOrderService.validate(
        parsed.map((p) => ({
          sku: p.sku,
          quantity: p.quantity,
          rowNumber: p.rowNumber,
        }))
      );

      setCsvValidatedRows(validation.items);
    } catch (err: any) {
      setCsvErrors([err?.message || 'Failed to read and parse CSV file.']);
    } finally {
      setCsvParsing(false);
      setCsvValidating(false);
    }
  };

  // Append valid CSV rows to order list
  const handleImportValidCsvRows = () => {
    const validOnes = csvValidatedRows.filter((r) => r.isValid && r.productId);
    if (validOnes.length === 0) return;

    setRows((prev) => {
      const updated = [...prev];
      for (const item of validOnes) {
        const rowId = item.variantId ? `${item.productId}-${item.variantId}` : item.productId!;
        const existingIdx = updated.findIndex((r) => r.id === rowId);

        if (existingIdx > -1) {
          const newQty = Math.min(
            updated[existingIdx].quantity + item.requestedQuantity,
            item.availableStock
          );
          updated[existingIdx].quantity = newQty;
          updated[existingIdx].error = null;
        } else {
          updated.push({
            id: rowId,
            productId: item.productId!,
            variantId: item.variantId || null,
            sku: item.sku,
            name: item.name || item.sku,
            image: item.images?.[0],
            categoryName: item.categoryName,
            brandName: item.brandName,
            unitPriceCents: item.unitPriceCents,
            stockQuantity: item.availableStock,
            quantity: item.requestedQuantity,
            error: null,
          });
        }
      }
      return updated;
    });

    setIsCsvModalOpen(false);
    setCsvFile(null);
    setCsvValidatedRows([]);
    setCsvErrors([]);
  };

  // Live Summary Calculations
  const totalItemLines = rows.length;
  const totalUnits = rows.reduce((acc, r) => acc + (r.error ? 0 : r.quantity || 0), 0);
  const subtotalCents = rows.reduce(
    (acc, r) => acc + (r.error ? 0 : (r.quantity || 0) * r.unitPriceCents),
    0
  );
  const hasInvalidRows = rows.some((r) => r.error !== null && r.error !== undefined);
  const isFreeDelivery = subtotalCents >= FREE_DELIVERY_THRESHOLD_CENTS;

  // Add All to Cart Handler
  const handleAddAllToCart = async () => {
    if (rows.length === 0) return;
    if (hasInvalidRows) {
      alert('Please correct the invalid quantities highlighted in red before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const itemsToAdd = rows.map((r) => ({
      productId: r.productId,
      variantId: r.variantId || null,
      quantity: r.quantity,
    }));

    const response = await addBulkItems(itemsToAdd);

    setIsSubmitting(false);
    setSubmissionFeedback({
      addedCount: response.addedCount,
      failedCount: response.failedCount,
      results: response.results,
    });

    if (response.addedCount > 0 && response.failedCount === 0) {
      // Clear rows if all added cleanly
      setRows([]);
    } else if (response.addedCount > 0) {
      // Keep only failed rows for customer convenience
      const failedProductIds = new Set(
        response.results.filter((res) => !res.success).map((res) => res.productId)
      );
      setRows((prev) => prev.filter((r) => failedProductIds.has(r.productId)));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 select-none">
      {/* ========================================================= */}
      {/* 1. HEADER SECTION (DSL NAVY & BLUE IDENTITY)              */}
      {/* ========================================================= */}
      <section className="bg-gradient-to-b from-[#102A5E] to-[#0A1F45] text-white pt-10 pb-16 px-4 sm:px-8 lg:px-12 xl:px-16 relative overflow-hidden">
        {/* Subtle decorative square grid background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(to right, #087BFF 1px, transparent 1px), linear-gradient(to bottom, #087BFF 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
          aria-hidden="true"
        />

        {/* Ambient floating square accents */}
        <div className="absolute top-4 right-10 w-44 h-44 rounded-3xl bg-[#087BFF]/10 rotate-12 pointer-events-none" />
        <div className="absolute -bottom-10 left-12 w-52 h-52 rounded-3xl bg-[#087BFF]/10 -rotate-12 pointer-events-none" />

        <div className="w-full max-w-[1720px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#087BFF]/20 border border-[#087BFF]/40 text-xs font-bold text-sky-200 uppercase tracking-widest">
                <Layers className="w-3.5 h-3.5 text-[#087BFF]" />
                <span>B2B &amp; Wholesale Stationery Portal</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
                Bulk Order
              </h1>
              <p className="text-sm sm:text-base text-white/80 leading-relaxed font-medium">
                Order multiple stationery products quickly and conveniently. Enter SKUs, product names, or barcodes directly, or upload your pre-formatted order spreadsheet.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => bulkOrderService.downloadTemplate()}
                className="bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold px-5 py-3 rounded-full border border-white/25 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
              >
                <Download className="w-4 h-4 text-[#087BFF]" />
                <span>Download CSV Template</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCsvModalOpen(true)}
                className="bg-[#087BFF] hover:bg-[#006DEB] text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-full flex items-center gap-2 shadow-lg shadow-[#087BFF]/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload CSV Order</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. MAIN CONTAINER                                         */}
      {/* ========================================================= */}
      <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 -mt-8 relative z-20 space-y-8">
        {/* ========================================================= */}
        {/* SECTION A: PRODUCT SEARCH & QUICK-ADD ROW                 */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-md shadow-[#102A5E]/5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-[#102C60] tracking-tight">
                Add Products to Order
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Search catalogue by SKU, product name, or barcode.
              </p>
            </div>
            {selectedProduct && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                <span>Product Selected</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4 items-start">
            {/* Search Input with Autocomplete Dropdown */}
            <div className="md:col-span-7 lg:col-span-8 relative" ref={searchContainerRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-3.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (selectedProduct) setSelectedProduct(null);
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) setIsDropdownOpen(true);
                  }}
                  placeholder="Type product name, SKU (e.g. DSL-SPEED-RIM-BLUE), or barcode..."
                  className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#102C60] placeholder:text-slate-400 focus:outline-hidden focus:border-[#087BFF] focus:bg-white shadow-2xs font-medium"
                />
                {isSearching && (
                  <Loader2 className="w-4 h-4 text-[#087BFF] animate-spin absolute right-4 top-3.5" />
                )}
                {searchQuery && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedProduct(null);
                      setSearchResults([]);
                    }}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Autocomplete Dropdown Results */}
              {isDropdownOpen && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectProduct(item)}
                      className="w-full p-3 sm:p-3.5 text-left flex items-center justify-between gap-3 hover:bg-[#F0F7FE] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden p-1">
                          {item.images?.[0] ? (
                            <img
                              src={item.images[0]}
                              alt={item.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[#102C60] group-hover:text-[#087BFF] truncate transition-colors">
                            {item.name}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                            <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                              SKU: {item.sku}
                            </span>
                            {item.brandName && <span>• {item.brandName}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-xs sm:text-sm font-black text-[#102C60]">
                          {formatLKR(item.priceCents)}
                        </p>
                        <p
                          className={`text-[10px] font-bold ${
                            item.stockQuantity <= 0
                              ? 'text-rose-500'
                              : item.stockQuantity < 10
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.stockQuantity <= 0
                            ? 'Out of Stock'
                            : `${item.stockQuantity} in stock`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quantity Input */}
            <div className="md:col-span-3 lg:col-span-2">
              <div className="flex items-center rounded-2xl border border-slate-200 bg-[#F8FAFC] overflow-hidden focus-within:border-[#087BFF] focus-within:bg-white">
                <span className="px-3 text-xs font-bold text-slate-400 select-none">Qty:</span>
                <input
                  type="number"
                  min="1"
                  max={selectedProduct ? selectedProduct.stockQuantity : 10000}
                  value={quickAddQty}
                  onChange={(e) => setQuickAddQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full py-3 pr-3 text-xs sm:text-sm font-black text-[#102C60] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Add Row Button */}
            <div className="md:col-span-2 lg:col-span-2">
              <button
                type="button"
                onClick={handleAddQuickRow}
                className="w-full bg-[#102A5E] hover:bg-[#087BFF] text-white text-xs sm:text-sm font-bold py-3 px-4 rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Row</span>
              </button>
            </div>
          </div>

          {quickAddError && (
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600 bg-rose-50 px-3.5 py-2 rounded-xl border border-rose-200 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{quickAddError}</span>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* SECTION B: SUBMISSION FEEDBACK BANNER (IF APPLICABLE)     */}
        {/* ========================================================= */}
        {submissionFeedback && (
          <div
            className={`rounded-3xl p-6 border animate-fadeIn ${
              submissionFeedback.failedCount === 0
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : submissionFeedback.addedCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {submissionFeedback.failedCount === 0 ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h3 className="text-base font-black">
                    {submissionFeedback.failedCount === 0
                      ? `Successfully added ${submissionFeedback.addedCount} items to your cart!`
                      : `Added ${submissionFeedback.addedCount} items to cart (${submissionFeedback.failedCount} items had issues)`}
                  </h3>
                  <p className="text-xs opacity-90 leading-relaxed font-medium">
                    Your cart total and navbar item count have been updated. You can review items anytime using the shopping bag icon.
                  </p>

                  {/* List of failed items if any */}
                  {submissionFeedback.failedCount > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200/80 space-y-1">
                      <p className="text-xs font-bold text-rose-700">Failed / Rejected Items:</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        {submissionFeedback.results
                          .filter((r) => !r.success)
                          .map((r, i) => (
                            <li key={i}>
                              <span className="font-mono font-bold">{r.sku || r.productId}</span>:{' '}
                              {r.error || 'Insufficient stock or inactive item'}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSubmissionFeedback(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SECTION C: BULK ORDER PRODUCT SELECTION TABLE             */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md shadow-[#102A5E]/5 overflow-hidden">
          {/* Table Header Bar */}
          <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-black text-[#102C60] tracking-tight">
                  Order Review List
                </h2>
                <span className="bg-[#EAF4FE] text-[#087BFF] text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-200">
                  {totalItemLines} {totalItemLines === 1 ? 'Product' : 'Products'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Review line items, live inventory availability, and update wholesale quantities.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {rows.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => bulkOrderService.exportItemsToCsv(rows)}
                    className="text-xs font-bold text-[#087BFF] hover:text-[#102A5E] bg-blue-50/70 hover:bg-blue-100/70 px-4 py-2 rounded-xl border border-blue-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3.5 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Table Body or Empty State */}
          {rows.length === 0 ? (
            <div className="py-20 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-[#F0F7FE] border border-blue-100 flex items-center justify-center mx-auto text-[#087BFF]">
                <FileText className="w-8 h-8 opacity-80" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#102C60]">No products added yet</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  Use the quick search box above to add stationery items by SKU or name, or click &ldquo;Upload CSV Order&rdquo; to import an entire list at once.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setIsCsvModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-[#F0F7FE] hover:bg-blue-100 text-[#087BFF] text-xs font-bold px-5 py-2.5 rounded-full border border-blue-200 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import from CSV</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#F8FAFC] text-[#102C60] font-black uppercase text-[11px] tracking-wider border-b border-slate-200">
                    <th className="py-4 px-6">Product Details</th>
                    <th className="py-4 px-4 font-mono">SKU</th>
                    <th className="py-4 px-4">Available Stock</th>
                    <th className="py-4 px-4">Unit Price</th>
                    <th className="py-4 px-4 w-36">Quantity</th>
                    <th className="py-4 px-4 text-right">Subtotal</th>
                    <th className="py-4 px-4 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const lineSubtotal = (row.quantity || 0) * row.unitPriceCents;
                    return (
                      <tr
                        key={row.id}
                        className={`hover:bg-[#F8FAFC]/80 transition-colors ${
                          row.error ? 'bg-rose-50/40' : ''
                        }`}
                      >
                        {/* Product Info */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                              {row.image ? (
                                <img
                                  src={row.image}
                                  alt={row.name}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <Package className="w-5 h-5 text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[#102C60] line-clamp-1">{row.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                                {row.brandName && <span>by {row.brandName}</span>}
                                {row.categoryName && <span>• {row.categoryName}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* SKU */}
                        <td className="py-4 px-4">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                            {row.sku}
                          </span>
                        </td>

                        {/* Available Stock */}
                        <td className="py-4 px-4">
                          <span
                            className={`font-bold text-xs ${
                              row.stockQuantity <= 0
                                ? 'text-rose-600'
                                : row.stockQuantity < 10
                                ? 'text-amber-600'
                                : 'text-emerald-700'
                            }`}
                          >
                            {row.stockQuantity} in stock
                          </span>
                        </td>

                        {/* Unit Price */}
                        <td className="py-4 px-4 font-bold text-[#102C60]">
                          {formatLKR(row.unitPriceCents)}
                        </td>

                        {/* Quantity Input */}
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <input
                              type="number"
                              min="1"
                              max={row.stockQuantity}
                              value={row.quantity}
                              onChange={(e) => handleUpdateRowQty(row.id, e.target.value)}
                              className={`w-28 px-3 py-1.5 rounded-xl border font-black text-center text-xs sm:text-sm focus:outline-hidden transition-all ${
                                row.error
                                  ? 'border-rose-400 bg-rose-50 text-rose-700 focus:border-rose-500'
                                  : 'border-slate-200 bg-white text-[#102C60] focus:border-[#087BFF]'
                              }`}
                            />
                            {row.error && (
                              <p className="text-[10px] font-bold text-rose-600 leading-tight">
                                {row.error}
                              </p>
                            )}
                          </div>
                        </td>

                        {/* Line Subtotal */}
                        <td className="py-4 px-4 text-right font-black text-[#102C60]">
                          {formatLKR(lineSubtotal)}
                        </td>

                        {/* Remove Action */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors mx-auto cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION D: FOOTER SUMMARY & ADD ALL TO CART               */}
          {/* ========================================================= */}
          {rows.length > 0 && (
            <div className="bg-[#F8FAFC] p-6 sm:p-8 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              {/* Left Details */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[#102C60] font-medium">
                  <span>
                    Total Lines: <strong className="font-black">{totalItemLines}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Total Units: <strong className="font-black">{totalUnits} items</strong>
                  </span>
                </div>

                {isFreeDelivery ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Eligible for Free Islandwide Delivery (Order exceeds Rs. 5,000)</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Add{' '}
                    <strong className="text-[#087BFF]">
                      {formatLKR(FREE_DELIVERY_THRESHOLD_CENTS - subtotalCents)}
                    </strong>{' '}
                    more to unlock free islandwide delivery.
                  </p>
                )}
              </div>

              {/* Right Order Total & Cart Button */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 lg:gap-6">
                <div className="text-left sm:text-right">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                    Estimated Subtotal
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-[#102C60] tracking-tight">
                    {formatLKR(subtotalCents)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddAllToCart}
                  disabled={isSubmitting || hasInvalidRows || rows.length === 0}
                  className="bg-[#087BFF] hover:bg-[#006DEB] text-white text-sm font-bold px-8 py-4 rounded-full shadow-lg shadow-[#087BFF]/25 flex items-center justify-center gap-2.5 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating &amp; Adding...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>Add All to Cart</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================= */}
      {/* 3. CSV UPLOAD & VALIDATION MODAL                          */}
      {/* ========================================================= */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A5E]/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#087BFF] flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-[#102C60]">Import Orders from CSV</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Upload your spreadsheet formatted with SKU and Quantity columns.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCsvModalOpen(false);
                  setCsvFile(null);
                  setCsvValidatedRows([]);
                  setCsvErrors([]);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-blue-200 hover:border-[#087BFF] bg-[#F8FAFC] hover:bg-blue-50/50 rounded-2xl p-6 text-center space-y-2 cursor-pointer transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
                <FileSpreadsheet className="w-8 h-8 text-[#087BFF] mx-auto opacity-80" />
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#102C60]">
                    {csvFile ? csvFile.name : 'Click to select or drag & drop CSV file'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Columns required: <strong>SKU</strong>, <strong>Quantity</strong> (optional: Product Name)
                  </p>
                </div>
              </div>

              {/* Parsing / Validating Spinner */}
              {(csvParsing || csvValidating) && (
                <div className="py-6 text-center space-y-2 text-[#087BFF]">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  <p className="text-xs font-bold">
                    {csvParsing ? 'Reading spreadsheet...' : 'Validating SKUs against live database...'}
                  </p>
                </div>
              )}

              {/* CSV Parse Errors */}
              {csvErrors.length > 0 && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>CSV Formatting Issues</span>
                  </div>
                  <ul className="text-xs text-rose-600 space-y-1 list-disc list-inside">
                    {csvErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Validation Results Preview */}
              {csvValidatedRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#102C60]">
                    <span>Validation Summary:</span>
                    <span className="flex items-center gap-3">
                      <span className="text-emerald-600">
                        ✓ {csvValidatedRows.filter((r) => r.isValid).length} Valid
                      </span>
                      <span className="text-rose-600">
                        ✗ {csvValidatedRows.filter((r) => !r.isValid).length} Invalid
                      </span>
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[#F8FAFC] text-[10px] font-black uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Row</th>
                          <th className="py-2.5 px-3">SKU</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Qty</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {csvValidatedRows.map((row, idx) => (
                          <tr key={idx} className={row.isValid ? 'bg-white' : 'bg-rose-50/60'}>
                            <td className="py-2 px-3 font-mono text-slate-400">
                              #{row.rowNumber || idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-700">
                              {row.sku}
                            </td>
                            <td className="py-2 px-3 truncate max-w-[180px]">
                              {row.name || '-'}
                            </td>
                            <td className="py-2 px-3 font-bold">{row.requestedQuantity}</td>
                            <td className="py-2 px-3">
                              {row.isValid ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="text-rose-600 font-bold" title={row.error}>
                                  {row.error}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 bg-[#F8FAFC] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => bulkOrderService.downloadTemplate()}
                className="text-xs font-bold text-[#087BFF] hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Sample Template</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvModalOpen(false);
                    setCsvFile(null);
                    setCsvValidatedRows([]);
                    setCsvErrors([]);
                  }}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-bold text-slate-600 hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleImportValidCsvRows}
                  disabled={
                    csvValidatedRows.filter((r) => r.isValid).length === 0 ||
                    csvValidating ||
                    csvParsing
                  }
                  className="bg-[#102A5E] hover:bg-[#087BFF] text-white text-xs font-bold px-5 py-2 rounded-full transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  Import {csvValidatedRows.filter((r) => r.isValid).length} Valid Items
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
