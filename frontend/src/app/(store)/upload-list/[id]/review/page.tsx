'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertCircle,
  Plus,
  Minus,
  ShoppingCart,
  FileText,
  Check,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
  Edit2,
  AlertTriangle,
  Package,
  Layers,
  ArrowRight,
  Info,
  XCircle,
  Sparkles,
} from 'lucide-react';
import { uploadService } from '@/services/uploadService';
import { UploadedListDocument, ExtractedStationeryItem } from '@/types/upload';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';

function UploadReviewContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [document, setDocument] = useState<UploadedListDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Per-item inline edit states: itemId -> string description being edited
  const [editingDescriptions, setEditingDescriptions] = useState<Record<string, string>>({});
  const [rematchingItems, setRematchingItems] = useState<Record<string, boolean>>({});

  const loadDocument = async () => {
    try {
      setLoading(true);
      setError(null);
      const doc = await uploadService.getByIdAsync(id);
      setDocument(doc);
    } catch (err: any) {
      setError(err.message || 'Failed to load uploaded list details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-4">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#08275E]" />
        <h2 className="text-lg font-bold text-slate-800">Analyzing Your Stationery List...</h2>
        <p className="text-xs text-slate-500">
          Running OCR text extraction and catalogue verification.
        </p>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h1 className="text-xl font-bold text-slate-800">{error || 'Uploaded booklist not found'}</h1>
        <p className="text-xs text-slate-500">
          We could not load the specified document. It may have expired or belongs to another session.
        </p>
        <Link
          href="/upload-list"
          className="inline-flex items-center gap-2 bg-[#08275E] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-sm hover:bg-[#103b8c]"
        >
          Upload New Booklist
        </Link>
      </div>
    );
  }

  // Toggle explicit confirmation of an item
  const handleToggleConfirm = async (item: ExtractedStationeryItem) => {
    const nextVal = !item.isConfirmed;
    try {
      await uploadService.updateExtractedItem(document.id, item.id, {
        isConfirmed: nextVal,
      });
      setDocument((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          extractedItems: prev.extractedItems.map((i) =>
            i.id === item.id ? { ...i, isConfirmed: nextVal } : i
          ),
        };
      });
    } catch (err: any) {
      alert(`Could not update confirmation: ${err.message}`);
    }
  };

  // Update item quantity with positive limit checks
  const handleUpdateQty = async (item: ExtractedStationeryItem, newQty: number) => {
    if (newQty < 1 || newQty > 1000) return;
    try {
      await uploadService.updateExtractedItem(document.id, item.id, {
        quantity: newQty,
      });
      setDocument((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          extractedItems: prev.extractedItems.map((i) =>
            i.id === item.id ? { ...i, quantity: newQty } : i
          ),
        };
      });
    } catch (err: any) {
      alert(`Could not update quantity: ${err.message}`);
    }
  };

  // Select alternative candidate or suggested alternative product
  const handleSelectCandidate = async (item: ExtractedStationeryItem, candidateId: string) => {
    try {
      const selected =
        item.suggestedCandidates?.find((c) => c.id === candidateId) ||
        item.suggestedAlternatives?.find((c) => c.id === candidateId);
      const defaultVariant = selected?.variants?.find((v) => (v.stockQuantity ?? 0) > 0) || selected?.variants?.[0];

      await uploadService.updateExtractedItem(document.id, item.id, {
        selectedProductId: candidateId,
        selectedVariantId: defaultVariant?.id || null,
        isSubstituted: true,
        isConfirmed: false, // Strict requirement: Requires explicit customer checkbox confirmation!
      });
      await loadDocument();
    } catch (err: any) {
      alert(`Could not update candidate selection: ${err.message}`);
    }
  };

  // Switch variant (e.g. Red vs Blue ink, 50cm vs 30cm)
  const handleSelectVariant = async (item: ExtractedStationeryItem, variantId: string) => {
    try {
      await uploadService.updateExtractedItem(document.id, item.id, {
        selectedVariantId: variantId,
      });
      await loadDocument();
    } catch (err: any) {
      alert(`Could not update variant: ${err.message}`);
    }
  };

  // Start editing description
  const handleStartEdit = (itemId: string, currentDesc: string) => {
    setEditingDescriptions((prev) => ({ ...prev, [itemId]: currentDesc }));
  };

  // Cancel editing
  const handleCancelEdit = (itemId: string) => {
    setEditingDescriptions((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  // Save edited description & trigger catalogue rematch
  const handleSaveAndRematch = async (item: ExtractedStationeryItem) => {
    const updatedDesc = editingDescriptions[item.id]?.trim();
    if (!updatedDesc) return;

    setRematchingItems((prev) => ({ ...prev, [item.id]: true }));
    try {
      await uploadService.updateExtractedItem(document.id, item.id, {
        itemDescription: updatedDesc,
        rematch: true,
      });
      handleCancelEdit(item.id);
      await loadDocument();
    } catch (err: any) {
      alert(`Rematch failed: ${err.message}`);
    } finally {
      setRematchingItems((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Helper to resolve currently selected product, variant, and price for each item
  const getItemDetails = (item: ExtractedStationeryItem) => {
    const activeProdId = item.confirmedProductId || item.matchedProductId;
    const matchedProd =
      (item.matchedProduct && item.matchedProduct.id === activeProdId ? item.matchedProduct : null) ||
      item.suggestedCandidates?.find((c) => c.id === activeProdId) ||
      item.suggestedAlternatives?.find((c) => c.id === activeProdId) ||
      item.matchedProduct;

    const activeVarId = item.confirmedVariantId || item.matchedVariantId;
    const variants = matchedProd?.variants || [];
    const activeVariant = variants.find((v: any) => v.id === activeVarId) || variants[0] || null;

    const unitPriceCents = activeVariant?.priceCents || matchedProd?.priceCents || 0;
    const stockQuantity = activeVariant ? activeVariant.stockQuantity : (matchedProd?.stockQuantity ?? 0);
    const isOutOfStock = stockQuantity <= 0;
    const isInsufficientStock = stockQuantity > 0 && item.quantity > stockQuantity;
    const displayImage =
      (matchedProd as any)?.primaryImage ||
      (matchedProd as any)?.images?.[0] ||
      null;

    return {
      matchedProd,
      activeVariant,
      variants,
      unitPriceCents,
      stockQuantity,
      isOutOfStock,
      isInsufficientStock,
      displayImage,
    };
  };

  // Filter items
  const confirmedItems = document.extractedItems.filter((i) => {
    const { matchedProd, isOutOfStock, isInsufficientStock } = getItemDetails(i);
    return i.isConfirmed && matchedProd && !isOutOfStock && !isInsufficientStock;
  });

  const unconfirmedItems = document.extractedItems.filter((i) => !i.isConfirmed);
  const outOfStockItems = document.extractedItems.filter((i) => {
    const { isOutOfStock } = getItemDetails(i);
    return isOutOfStock;
  });
  const unmatchedItems = document.extractedItems.filter((i) => {
    const { matchedProd } = getItemDetails(i);
    return !matchedProd || i.status === 'UNMATCHED';
  });

  const confirmedTotalCents = confirmedItems.reduce((acc, item) => {
    const { unitPriceCents } = getItemDetails(item);
    return acc + unitPriceCents * item.quantity;
  }, 0);

  // Cart transfer submission
  const handleAddConfirmedToCart = async () => {
    if (confirmedItems.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSuccessMessage(null);

    try {
      const result = await uploadService.confirmToCart(
        document.id,
        confirmedItems.map((i) => i.id)
      );

      setSuccessMessage(result.message);
      setIsSubmitting(false);

      // Open shopping cart drawer
      setTimeout(() => {
        setDrawerOpen(true);
      }, 600);
    } catch (err: any) {
      setIsSubmitting(false);
      alert(`Could not add items to cart: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      {/* Top Banner / Review-first safety assurance */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-3.5 py-1 rounded-full uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Review-First Safety Guarantee</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mt-2">
            Confirm Your Stationery List
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Document: <strong>{document.fileName}</strong> ({Math.round(document.fileSizeBytes / 1024)} KB) • Status:{' '}
              <span className="font-bold uppercase text-[#08275E]">{document.status}</span>
            </span>
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl px-5 py-3 text-right">
          <span className="text-[10px] font-bold text-emerald-800 uppercase block tracking-wider">
            Estimated Cart Value
          </span>
          <span className="text-2xl font-black text-emerald-900">{formatLKR(confirmedTotalCents)}</span>
          <span className="text-[11px] text-emerald-700 block font-semibold">
            {confirmedItems.length} of {document.extractedItems.length} items ready to add
          </span>
        </div>
      </div>

      {/* Safety Policy Box */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 text-xs text-blue-950 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#08275E] shrink-0 mt-0.5" />
        <div>
          <strong>Customer Confirmation Policy:</strong> No items will be charged or added to your shopping cart without your explicit approval.
          Unchecked items, out-of-stock items, or unresolved requests will remain safely excluded.
        </div>
      </div>

      {/* Extracted Items Review Cards */}
      <div className="space-y-4">
        {document.extractedItems.map((item, idx) => {
          const {
            matchedProd,
            activeVariant,
            variants,
            unitPriceCents,
            stockQuantity,
            isOutOfStock,
            isInsufficientStock,
            displayImage,
          } = getItemDetails(item);

          const isConfirmed = item.isConfirmed;
          const isSubstituted = item.isSubstituted;
          const isMatched = item.status === 'MATCHED' || item.status === 'CONFIRMED' || !!matchedProd;
          const isEditing = editingDescriptions[item.id] !== undefined;
          const isRematching = rematchingItems[item.id] === true;

          // Determine status category and badge styling without relying on colour alone
          const isAmbiguous = isSubstituted && item.suggestedCandidates && item.suggestedCandidates.length > 1;

          return (
            <div
              key={item.id}
              className={`rounded-3xl border-2 p-5 sm:p-6 transition-all space-y-4 ${
                isConfirmed && !isOutOfStock && !isInsufficientStock
                  ? 'bg-white border-emerald-500 shadow-sm'
                  : isOutOfStock
                  ? 'bg-rose-50/40 border-rose-200'
                  : isInsufficientStock
                  ? 'bg-amber-50/40 border-amber-300'
                  : 'bg-slate-50/80 border-slate-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                {/* Left section: Checkbox, status badges, titles */}
                <div className="flex items-start gap-3.5">
                  <input
                    type="checkbox"
                    id={`confirm-${item.id}`}
                    checked={isConfirmed && !isOutOfStock && !isInsufficientStock}
                    disabled={!isMatched || isOutOfStock || isInsufficientStock}
                    onChange={() => handleToggleConfirm(item)}
                    className="mt-1 w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  />

                  <div className="space-y-1.5 flex-1">
                    {/* Status Badges with clear icons & text */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" />
                        Line {idx + 1}: &ldquo;{item.rawText}&rdquo;
                      </span>

                      {/* OCR Confidence */}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          item.extractionConfidence >= 0.85
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        OCR: {Math.round(item.extractionConfidence * 100)}%
                      </span>

                      {/* Out of Stock Badge */}
                      {isOutOfStock && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Out of Stock
                        </span>
                      )}

                      {/* Insufficient Stock Badge */}
                      {!isOutOfStock && isInsufficientStock && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          Insufficient Stock
                        </span>
                      )}

                      {/* Ambiguous match badge */}
                      {!isOutOfStock && !isInsufficientStock && isAmbiguous && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <HelpCircle className="w-3 h-3 text-amber-700" />
                          Multiple Models — Selection Needed
                        </span>
                      )}

                      {/* Substitution badge */}
                      {!isOutOfStock && !isInsufficientStock && !isAmbiguous && isSubstituted && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Info className="w-3 h-3 text-purple-700" />
                          Recommended Alternative
                        </span>
                      )}

                      {/* Unmatched badge */}
                      {!isMatched && (
                        <span className="text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-slate-600" />
                          Unmatched
                        </span>
                      )}

                      {/* Exact Match badge */}
                      {!isOutOfStock && !isInsufficientStock && isMatched && !isSubstituted && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          Exact Match
                        </span>
                      )}
                    </div>

                    {/* Matched Product Title & Image */}
                    <div className="flex items-start gap-3 mt-1">
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={matchedProd?.name || 'Product'}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                          <Package className="w-6 h-6" />
                        </div>
                      )}

                      <div>
                        <h3 className="text-base font-bold text-slate-900 leading-tight">
                          {matchedProd ? matchedProd.name : item.itemDescription}
                        </h3>

                        {matchedProd && (
                          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                            <span>SKU: <strong className="font-mono text-slate-700">{matchedProd.sku}</strong></span>
                            {matchedProd.brandName && (
                              <span>• Brand: <strong>{matchedProd.brandName}</strong></span>
                            )}
                            {matchedProd.categoryName && (
                              <span>• Category: <strong>{matchedProd.categoryName}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Match explanation */}
                    {item.matchReason && (
                      <p className="text-xs text-slate-600 bg-slate-100/70 rounded-xl px-3 py-1.5 border border-slate-200/50">
                        <strong>Match Note:</strong> {item.matchReason}
                      </p>
                    )}

                    {/* Stock & Availability Info */}
                    <div className="flex items-center gap-3 text-xs pt-0.5">
                      {matchedProd && (
                        <>
                          <span className="font-semibold text-[#08275E]">
                            Unit Price: {formatLKR(unitPriceCents)}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className={`font-semibold ${isOutOfStock ? 'text-rose-600' : isInsufficientStock ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {isOutOfStock ? 'Out of stock (0 available)' : `In Stock: ${stockQuantity} units`}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Insufficient Stock Warning Banner */}
                    {isInsufficientStock && (
                      <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 font-medium mt-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p>
                            <strong>Insufficient Stock:</strong> You requested <strong>{item.quantity}</strong> units, but only <strong>{stockQuantity}</strong> are available.
                          </p>
                          <p className="text-amber-700 text-[11px]">
                            Please reduce your requested quantity to {stockQuantity} or choose a suitable alternative below to proceed with confirmation.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Variant Selector (e.g. Red vs Blue Ink, 50cm vs 30cm) */}
                    {variants.length > 1 && (
                      <div className="mt-2 p-2.5 bg-slate-100/80 rounded-2xl border border-slate-200 space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-500" />
                          <span>Select Variant / Colour / Size:</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {variants.map((v: any) => {
                            const isSelected = v.id === activeVariant?.id;
                            const vStock = v.stockQuantity ?? 0;
                            const vOutOfStock = vStock <= 0;

                            return (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => handleSelectVariant(item, v.id)}
                                className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-2 transition-all ${
                                  isSelected
                                    ? 'bg-[#08275E] text-white border-[#08275E] font-bold shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                                }`}
                              >
                                <span>{v.name}</span>
                                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                                  isSelected
                                    ? 'bg-white/20 text-white'
                                    : vOutOfStock
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {vOutOfStock ? 'OOS' : `${vStock} avail`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Inline Description Editing & Rematching */}
                    <div className="pt-1">
                      {isEditing ? (
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 mt-1">
                          <label className="text-[11px] font-bold text-amber-900 block">
                            Edit Requested Item Description:
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingDescriptions[item.id] || ''}
                              onChange={(e) =>
                                setEditingDescriptions((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="e.g. Speed Rim Ball Pen Black or MI GOLD 556N Calculator"
                              className="flex-1 text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#08275E] outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveAndRematch(item)}
                              disabled={isRematching || !editingDescriptions[item.id]?.trim()}
                              className="bg-[#08275E] hover:bg-[#103b8c] text-white text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                            >
                              {isRematching ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="w-3.5 h-3.5" />
                              )}
                              <span>Rematch</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelEdit(item.id)}
                              className="text-xs text-slate-600 hover:text-slate-800 px-2 py-2"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item.id, item.itemDescription)}
                          className="text-[11px] font-semibold text-[#08275E] hover:underline inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit description & retry match</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right controls: Quantity, Subtotal, Status */}
                <div className="flex items-center justify-between sm:justify-end gap-5 pl-8 sm:pl-0 shrink-0">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                    <button
                      onClick={() => handleUpdateQty(item, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      className="p-2 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={item.quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          handleUpdateQty(item, Math.min(1000, val));
                        }
                      }}
                      className="w-12 text-center text-xs font-bold text-slate-900 border-none outline-none focus:ring-0 p-1"
                    />
                    <button
                      onClick={() => handleUpdateQty(item, item.quantity + 1)}
                      disabled={item.quantity >= 1000}
                      className="p-2 hover:bg-slate-100 text-slate-600 disabled:opacity-30"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-28">
                    <span className="text-sm font-black text-[#08275E] block">
                      {matchedProd && !isOutOfStock ? formatLKR(unitPriceCents * item.quantity) : '-'}
                    </span>
                    <span className="text-[10px] block">
                      {isOutOfStock ? (
                        <span className="text-rose-600 font-bold">Out of Stock</span>
                      ) : isInsufficientStock ? (
                        <span className="text-amber-700 font-bold">Reduce Qty</span>
                      ) : isConfirmed ? (
                        <span className="text-emerald-600 font-bold flex items-center justify-end gap-1">
                          <Check className="w-3 h-3" /> Confirmed
                        </span>
                      ) : (
                        <span className="text-slate-400">Unconfirmed</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verified Suitable Alternatives Section */}
              {item.suggestedAlternatives && item.suggestedAlternatives.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Verified Suitable Alternatives ({item.suggestedAlternatives.length} available):</span>
                    </span>
                    {(isOutOfStock || isInsufficientStock) && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        In-Stock Substitutes
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {item.suggestedAlternatives.map((alt) => {
                      const isCurrent = alt.id === (item.confirmedProductId || item.matchedProductId);
                      const altStock = alt.stockQuantity ?? 0;
                      const altPrice = alt.priceCents ?? 0;

                      return (
                        <div
                          key={alt.id}
                          className={`p-3.5 rounded-2xl border text-xs flex flex-col justify-between gap-2.5 transition-all ${
                            isCurrent
                              ? 'bg-emerald-50/90 border-emerald-500 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {alt.primaryImage ? (
                              <img
                                src={alt.primaryImage}
                                alt={alt.name}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-white"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                                <Package className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-900 leading-snug line-clamp-2">
                                {alt.name}
                              </div>
                              <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                                {alt.brandName && (
                                  <span className="font-semibold text-slate-700">Brand: {alt.brandName}</span>
                                )}
                                <span>• SKU: {alt.sku}</span>
                              </div>
                              {alt.specDifferences && (
                                <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/60 rounded-md px-2 py-0.5 mt-1 font-medium">
                                  {alt.specDifferences}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <div>
                              <span className="font-black text-[#08275E]">{formatLKR(altPrice)}</span>
                              <span className="text-[10px] text-emerald-700 font-semibold block">
                                In Stock ({altStock} units)
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectCandidate(item, alt.id)}
                              className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 ${
                                isCurrent
                                  ? 'bg-emerald-700 text-white cursor-default'
                                  : 'bg-[#08275E] hover:bg-[#103b8c] text-white shadow-2xs cursor-pointer'
                              }`}
                            >
                              {isCurrent ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Selected</span>
                                </>
                              ) : (
                                <span>Select this alternative</span>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Alternative Candidates Carousel / Selector */}
              {item.suggestedCandidates && item.suggestedCandidates.length > 1 && (
                <div className="pt-3 border-t border-slate-200/80 mt-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-slate-500" />
                      <span>Catalogue Candidates ({item.suggestedCandidates.length} options):</span>
                    </span>
                    {isAmbiguous && (
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        Please select your model
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {item.suggestedCandidates.map((cand) => {
                      const isCurrent = cand.id === (item.confirmedProductId || item.matchedProductId);
                      const candStock = cand.stockQuantity ?? 0;
                      const candOutOfStock = candStock <= 0 && (!cand.variants || cand.variants.every((v) => (v.stockQuantity ?? 0) <= 0));
                      const priceDiff = unitPriceCents ? cand.priceCents - unitPriceCents : 0;

                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => handleSelectCandidate(item, cand.id)}
                          className={`text-left p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 transition-all ${
                            isCurrent
                              ? 'bg-blue-50/80 border-[#08275E] text-[#08275E] font-bold shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-bold text-slate-900">{cand.name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>SKU: {cand.sku}</span>
                              <span>•</span>
                              <span className={candOutOfStock ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                                {candOutOfStock ? 'Out of stock' : `${candStock} in stock`}
                              </span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-mono text-xs font-bold block">
                              {formatLKR(cand.priceCents)}
                            </span>
                            {priceDiff !== 0 && !isCurrent && (
                              <span className={`text-[10px] font-semibold block ${priceDiff > 0 ? 'text-slate-500' : 'text-emerald-600'}`}>
                                {priceDiff > 0 ? `+${formatLKR(priceDiff)}` : `-${formatLKR(Math.abs(priceDiff))}`}
                              </span>
                            )}
                            {isCurrent && (
                              <span className="text-[10px] text-emerald-600 font-bold block">
                                Selected ✓
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-bold">{successMessage}</span>
        </div>
      )}

      {/* Summary of Unresolved Items before Confirmation (Req. 4) */}
      {(unconfirmedItems.length > 0 || outOfStockItems.length > 0 || unmatchedItems.length > 0) && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2 text-xs text-amber-950">
          <div className="font-bold flex items-center gap-2 text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Summary of Items Not Being Added to Cart:</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-700">
            {outOfStockItems.length > 0 && (
              <li>
                <strong>{outOfStockItems.length} item(s) are currently out of stock</strong> and cannot be ordered until restocked.
              </li>
            )}
            {unmatchedItems.length > 0 && (
              <li>
                <strong>{unmatchedItems.length} item(s) could not be matched</strong> in our catalogue. You can edit their descriptions above to retry.
              </li>
            )}
            {unconfirmedItems.filter((i) => !outOfStockItems.includes(i) && !unmatchedItems.includes(i)).length > 0 && (
              <li>
                <strong>
                  {unconfirmedItems.filter((i) => !outOfStockItems.includes(i) && !unmatchedItems.includes(i)).length} item(s) remain unchecked
                </strong> and will be left behind in your review.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg sticky bottom-6 z-20">
        <div>
          <span className="text-xs text-slate-500 block">
            Approved Items Ready to Order ({confirmedItems.length} of {document.extractedItems.length}):
          </span>
          <span className="text-3xl font-black text-[#08275E]">{formatLKR(confirmedTotalCents)}</span>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            Prices and stock will be verified by the server when added to your cart.
          </span>
        </div>

        <button
          onClick={handleAddConfirmedToCart}
          disabled={confirmedItems.length === 0 || isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-sm px-8 py-4 rounded-2xl shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-[#FFD21C]" />
              <span>Verifying & Adding to Cart...</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 text-[#FFD21C]" />
              <span>Confirm & Add {confirmedItems.length} Item(s) to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function UploadReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="p-12 text-center text-xs text-slate-400">Loading upload review...</div>
      }
    >
      <UploadReviewContent />
    </Suspense>
  );
}
