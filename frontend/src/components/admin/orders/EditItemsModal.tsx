'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { OrderItemSnapshot } from '@/types/order';
import { productService } from '@/services/productService';
import { orderService } from '@/services/orderService';
import { formatLKR } from '@/lib/currency';
import { Product } from '@/types/product';

interface EditItemsModalProps {
  orderId: string;
  currentItems: OrderItemSnapshot[];
  isLocked: boolean; // Shipped, delivered, cancelled
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedItems: any[]) => void;
}

export const EditItemsModal: React.FC<EditItemsModalProps> = ({
  orderId,
  currentItems,
  isLocked,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setItems(
        currentItems.map((it) => ({
          ...it,
          quantity: it.quantity || 1,
        }))
      );
      setAvailableProducts(productService.getAll().filter((p) => p.isActive));
      setError(null);
      setNotice(null);
    }
  }, [isOpen, currentItems]);

  if (!isOpen) return null;

  const handleQuantityChange = (index: number, delta: number) => {
    setItems((prev) => {
      const copy = [...prev];
      const newQty = copy[index].quantity + delta;
      if (newQty <= 0) return copy;

      // Check stock if product exists
      const prod = productService.getById(copy[index].productId);
      if (prod && newQty > prod.stockQuantity) {
        setError(
          `Cannot increase quantity beyond available stock (${prod.stockQuantity} available).`
        );
        return copy;
      }
      setError(null);
      copy[index] = {
        ...copy[index],
        quantity: newQty,
        totalPriceCents: (copy[index].unitPriceCents || 0) * newQty,
      };
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    if (items.length <= 1) {
      setError('An order must have at least one product line.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleAddProduct = () => {
    if (!selectedProductId) return;
    const prod = availableProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (prod.stockQuantity <= 0) {
      setError(`"${prod.name}" is currently out of stock.`);
      return;
    }

    const existingIndex = items.findIndex((it) => it.productId === prod.id);
    if (existingIndex >= 0) {
      handleQuantityChange(existingIndex, 1);
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: `new-item-${Date.now()}`,
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unitPriceCents: prod.priceCents,
          quantity: 1,
          totalPriceCents: prod.priceCents,
          product: {
            id: prod.id,
            name: prod.name,
            images: prod.images || [],
            sku: prod.sku,
          },
        },
      ]);
    }
    setSelectedProductId('');
    setError(null);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, it) => sum + (it.unitPriceCents || 0) * it.quantity, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) {
      setError('This order is ineligible for items modification due to its current status.');
      return;
    }
    if (items.length === 0) {
      setError('At least one item is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const payload = items.map((it) => ({
      productId: it.productId,
      variantId: it.variantId || null,
      quantity: it.quantity,
    }));

    const res = await orderService.updateOrderItems(orderId, payload, reason);
    setIsSubmitting(false);

    if (res.success) {
      onSuccess(items);
      onClose();
    } else {
      if (res.isBackendPending) {
        setNotice(res.error || 'Backend items endpoint pending.');
      } else {
        setError(res.error || 'Failed to update order items');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200 max-w-2xl w-full shadow-2xl overflow-hidden animate-scale-in max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#08275E]/10 text-[#08275E]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Edit Order Items</h3>
              <p className="text-[11px] text-slate-400">
                Adjust quantities or add/remove products before shipment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
          {isLocked && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Modifications Disabled:</strong> This order has already progressed to a locked
                or terminal state (Shipped / Delivered / Cancelled).
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">API Coordination Notice:</strong>
                <span>{notice}</span>
              </div>
            </div>
          )}

          {/* Add Product Toolbar */}
          {!isLocked && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="flex-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 text-xs focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              >
                <option value="">Select a stationery product to add...</option>
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id} disabled={p.stockQuantity <= 0}>
                    {p.name} ({p.sku}) — {formatLKR(p.priceCents)}{' '}
                    {p.stockQuantity <= 0 ? '(Out of stock)' : `[${p.stockQuantity} in stock]`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddProduct}
                disabled={!selectedProductId}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold text-xs disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Product</span>
              </button>
            </div>
          )}

          {/* Item List */}
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
            {items.map((item, idx) => {
              const liveProd = productService.getById(item.productId);
              const availableStock = liveProd?.stockQuantity ?? 'N/A';

              return (
                <div key={item.id || idx} className="p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">
                      {item.productName || item.product?.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      SKU: {item.sku || item.product?.sku || 'N/A'}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      Unit price: {formatLKR(item.unitPriceCents)} | Available stock:{' '}
                      <span className="font-bold text-slate-700">{availableStock}</span>
                    </div>
                  </div>

                  {/* Quantity and Actions */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, -1)}
                        disabled={isLocked || item.quantity <= 1}
                        className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="px-3 font-mono font-bold text-slate-900 text-xs">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(idx, 1)}
                        disabled={isLocked}
                        className="px-2.5 py-1.5 hover:bg-slate-200 text-slate-700 disabled:opacity-30 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="font-black text-slate-900 text-xs min-w-[70px] text-right">
                      {formatLKR(item.unitPriceCents * item.quantity)}
                    </span>

                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemove(idx)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                        title="Remove product"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modification Reason */}
          {!isLocked && (
            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px] tracking-wider block">
                Reason for Item Adjustment
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer requested extra notebooks via phone support"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
            </div>
          )}

          {/* Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs font-bold">
            <span className="text-slate-600">Calculated Items Subtotal:</span>
            <span className="text-sm font-black text-[#08275E]">
              {formatLKR(calculateSubtotal())}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          {!isLocked && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-[#08275E] hover:bg-[#103b8c] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save &amp; Recalculate Totals</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
