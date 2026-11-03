'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { ProductCategory, Brand, Product } from '@/types/product';
import { rupeesToCents, centsToRupees } from '@/lib/currency';

function AdminEditProductContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [priceRupees, setPriceRupees] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const p = productService.getById(id);
    const cats = categoryService.getCategories();
    const brs = categoryService.getBrands();

    setCategories(cats);
    setBrands(brs);

    if (p) {
      setProduct(p);
      setName(p.name);
      setSku(p.sku);
      setPriceRupees(centsToRupees(p.priceCents));
      setStockQuantity(p.stockQuantity);
      setCategoryId(p.categoryId);
      setBrandId(p.brandId);
      setDescription(p.description);
    }
  }, [id]);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
        Product not found.
      </div>
    );
  }

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const catObj = categories.find((c) => c.id === categoryId);
    const brandObj = brands.find((b) => b.id === brandId);

    productService.updateProduct(product.id, {
      name,
      sku,
      priceCents: rupeesToCents(Number(priceRupees)),
      stockQuantity: Number(stockQuantity),
      categoryId,
      categoryName: catObj ? catObj.name : product.categoryName,
      brandId,
      brandName: brandObj ? brandObj.name : product.brandName,
      description,
    });

    router.push('/admin/products');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <Link href="/admin/products" className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Products</span>
          </Link>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Edit: {product.name}</h1>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Product Title</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">SKU</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Selling Price (LKR Rupees)</label>
            <input
              type="number"
              value={priceRupees}
              onChange={(e) => setPriceRupees(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Stock Quantity</label>
            <input
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value ? Number(e.target.value) : '')}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <Link
            href="/admin/products"
            className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-[#FFD21C]" />
            <span>Save Changes</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AdminEditProductPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
          Loading product editor...
        </div>
      }
    >
      <AdminEditProductContent />
    </Suspense>
  );
}

