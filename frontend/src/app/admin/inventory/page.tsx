'use client';

import React, { useState, useEffect } from 'react';
import { Boxes, AlertTriangle, ArrowUpDown, History, Plus, RefreshCw, Check } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { productService } from '@/services/productService';
import { Product } from '@/types/product';
import { InventoryMovement } from '@/types/admin';
import { formatLKR } from '@/lib/currency';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState<number>(0);
  const [reason, setReason] = useState<InventoryMovement['reason']>('restock');
  const [note, setNote] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  const loadData = () => {
    setProducts(productService.getAll(true));
    setMovements(inventoryService.getMovements());
  };

  useEffect(() => {
    loadData();
    const unsubInv = inventoryService.subscribe(loadData);
    const unsubProd = productService.subscribe(loadData);
    return () => {
      unsubInv();
      unsubProd();
    };
  }, []);

  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setNewQuantity(product.stockQuantity);
    setReason('restock');
    setNote('');
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    inventoryService.adjustStock(
      adjustingProduct.id,
      newQuantity,
      reason,
      note || undefined,
      'Store Admin'
    );

    setSuccessMsg(true);
    setTimeout(() => {
      setSuccessMsg(false);
      setAdjustingProduct(null);
    }, 700);
  };

  const displayedProducts = filterLowStock
    ? products.filter((p) => p.stockQuantity <= p.lowStockThreshold)
    : products;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Inventory &amp; Stock Control
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time warehouse inventory adjustments, movement logs, and low-stock alerts
          </p>
        </div>

        <button
          onClick={() => setFilterLowStock(!filterLowStock)}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto ${
            filterLowStock
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{filterLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock Alert'}</span>
        </button>
      </div>

      {/* Stock Overview Table */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Current Warehouse Stock Levels</h2>
          <span className="text-xs text-slate-400">{displayedProducts.length} items</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4 font-bold">Product</th>
                <th className="py-3 px-4 font-bold">SKU</th>
                <th className="py-3 px-4 font-bold">Selling Price</th>
                <th className="py-3 px-4 font-bold">Current Stock</th>
                <th className="py-3 px-4 font-bold">Alert Level</th>
                <th className="py-3 px-4 font-bold">Status</th>
                <th className="py-3 px-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedProducts.map((p) => {
                const isLow = p.stockQuantity <= p.lowStockThreshold;
                const isOut = p.stockQuantity <= 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate">{p.name}</td>
                    <td className="py-3.5 px-4 font-mono text-slate-500">{p.sku}</td>
                    <td className="py-3.5 px-4 font-black text-[#08275E]">{formatLKR(p.priceCents)}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-sm font-black text-slate-900">{p.stockQuantity}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">{p.lowStockThreshold} units</td>
                    <td className="py-3.5 px-4">
                      {isOut ? (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full uppercase">
                          Out of Stock
                        </span>
                      ) : isLow ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase">
                          Low Stock
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                          Healthy
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => openAdjustModal(p)}
                        className="bg-slate-100 hover:bg-[#08275E] hover:text-white text-[#08275E] font-bold text-[11px] px-3 py-1.5 rounded-xl transition-colors"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Movements Log */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <History className="w-4 h-4 text-[#08275E]" />
            <span>Audit Trail: Stock Movement History</span>
          </h2>
          <span className="text-xs text-slate-400">{movements.length} logged adjustments</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-semibold">Timestamp</th>
                <th className="pb-2 font-semibold">Product</th>
                <th className="pb-2 font-semibold">Reason</th>
                <th className="pb-2 font-semibold">Adjustment</th>
                <th className="pb-2 font-semibold">New Qty</th>
                <th className="pb-2 font-semibold">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="py-2.5 text-slate-400 font-mono text-[11px]">
                    {new Date(m.timestamp).toLocaleString()}
                  </td>
                  <td className="py-2.5 font-bold text-slate-800">{m.productName}</td>
                  <td className="py-2.5">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold uppercase">
                      {m.reason.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 font-bold">
                    <span className={m.changeAmount >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {m.changeAmount >= 0 ? `+${m.changeAmount}` : m.changeAmount}
                    </span>
                  </td>
                  <td className="py-2.5 font-mono font-bold text-slate-900">{m.newQuantity}</td>
                  <td className="py-2.5 text-slate-500">{m.performedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fade-in">
          <form onSubmit={handleSaveAdjustment} className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full space-y-4 shadow-xl text-xs">
            <h3 className="text-base font-bold text-slate-900">
              Adjust Inventory: {adjustingProduct.name}
            </h3>

            <div>
              <label className="font-bold text-slate-700 block mb-1">New Stock Level (Units)</label>
              <input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(Math.max(0, Number(e.target.value)))}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Current stock is {adjustingProduct.stockQuantity}. Change: {newQuantity - adjustingProduct.stockQuantity}
              </span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Adjustment Reason *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
              >
                <option value="restock">Restock / Container Intake</option>
                <option value="correction">Audit Stock Count Correction</option>
                <option value="damaged">Damaged / Expired Stationery</option>
                <option value="order_fulfillment">Manual Order Fulfillment</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Audit Note (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Received shipment from Atlas distributor"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-5 py-2 rounded-xl shadow-xs transition-colors"
              >
                {successMsg ? 'Updated!' : 'Confirm Adjustment'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
