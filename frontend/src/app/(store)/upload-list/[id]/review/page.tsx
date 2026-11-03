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
  ArrowRight,
  FileText,
  Check,
} from 'lucide-react';
import { uploadService } from '@/services/uploadService';
import { productService } from '@/services/productService';
import { UploadedListDocument, ExtractedStationeryItem } from '@/types/upload';
import { Product } from '@/types/product';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';

function UploadReviewContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [document, setDocument] = useState<UploadedListDocument | undefined>(undefined);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const doc = uploadService.getById(id);
    setDocument(doc);
    setAllProducts(productService.getAll());
  }, [id]);

  if (!document) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-800">Uploaded booklist not found</h1>
        <Link
          href="/upload-list"
          className="mt-4 inline-block bg-[#08275E] text-white text-xs font-bold px-4 py-2 rounded-xl"
        >
          Upload New Booklist
        </Link>
      </div>
    );
  }

  const handleUpdateQty = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    uploadService.updateExtractedItem(document.id, itemId, { quantity: newQty });
    setDocument(uploadService.getById(id));
  };

  const handleToggleSkip = (itemId: string, currentStatus: ExtractedStationeryItem['status']) => {
    const newStatus = currentStatus === 'skipped' ? 'matched' : 'skipped';
    uploadService.updateExtractedItem(document.id, itemId, { status: newStatus });
    setDocument(uploadService.getById(id));
  };

  const activeItems = document.extractedItems.filter((i) => i.status !== 'skipped');

  const matchedTotalCents = activeItems.reduce((acc, item) => {
    const product = allProducts.find((p) => p.id === item.matchedProductId);
    return acc + (product ? product.priceCents * item.quantity : 0);
  }, 0);

  const handleAddAllToCart = () => {
    activeItems.forEach((item) => {
      const product = allProducts.find((p) => p.id === item.matchedProductId);
      if (product) {
        addItem(product, item.quantity);
      }
    });

    uploadService.updateUploadStatus(document.id, 'converted_to_cart');
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      setDrawerOpen(true);
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#08275E] bg-blue-50 px-3 py-1 rounded-full">
            Review Extracted Stationery
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-2">
            Booklist Matching Review
          </h1>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>File: <strong>{document.fileName}</strong> • Status: {document.status}</span>
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-2 text-right">
          <span className="text-[10px] font-bold text-emerald-800 uppercase block">Matched Total</span>
          <span className="text-xl font-black text-emerald-900">{formatLKR(matchedTotalCents)}</span>
        </div>
      </div>

      <div className="space-y-4">
        {document.extractedItems.map((item) => {
          const product = allProducts.find((p) => p.id === item.matchedProductId);
          const isSkipped = item.status === 'skipped';

          return (
            <div
              key={item.id}
              className={`rounded-3xl border-2 p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isSkipped
                  ? 'bg-slate-50 border-slate-200 opacity-50'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    Line: &ldquo;{item.rawText}&rdquo;
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    item.confidence === 'high' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {Math.round(item.confidenceScore * 100)}% Match
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  {product ? product.name : item.itemDescription}
                </h3>
                <p className="text-xs font-semibold text-[#08275E]">
                  {product ? formatLKR(product.priceCents) : 'Price not set'} each
                </p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <button
                    onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                    disabled={isSkipped || item.quantity <= 1}
                    className="p-1.5 hover:bg-slate-200 text-slate-600 disabled:opacity-30"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-3 text-xs font-bold text-slate-900">{item.quantity}</span>
                  <button
                    onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                    disabled={isSkipped}
                    className="p-1.5 hover:bg-slate-200 text-slate-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="text-right min-w-24">
                  <span className="text-sm font-black text-[#08275E] block">
                    {product ? formatLKR(product.priceCents * item.quantity) : '-'}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleSkip(item.id, item.status)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                    isSkipped ? 'text-[#08275E] bg-blue-50' : 'text-slate-400 hover:text-rose-600'
                  }`}
                >
                  {isSkipped ? 'Include' : 'Skip'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md sticky bottom-6">
        <div>
          <span className="text-xs text-slate-500 block">Total for {activeItems.length} Matched Items:</span>
          <span className="text-2xl font-black text-[#08275E]">{formatLKR(matchedTotalCents)}</span>
        </div>

        <button
          onClick={handleAddAllToCart}
          disabled={activeItems.length === 0}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-sm px-8 py-3.5 rounded-2xl shadow-lg transition-all"
        >
          {added ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Items Added to Cart!</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-4 h-4 text-[#FFD21C]" />
              <span>Add Matched Booklist Items to Cart</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function UploadReviewPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-slate-400">Loading upload review...</div>}>
      <UploadReviewContent />
    </Suspense>
  );
}
