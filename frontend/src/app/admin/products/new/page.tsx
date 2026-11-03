'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { ProductCategory, Brand } from '@/types/product';
import { rupeesToCents } from '@/lib/currency';

export default function AdminNewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [priceRupees, setPriceRupees] = useState<number | ''>('');
  const [comparePriceRupees, setComparePriceRupees] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>(100);
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(15);
  const [tags, setTags] = useState('stationery, school');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const cats = categoryService.getCategories();
    const brs = categoryService.getBrands();
    setCategories(cats);
    setBrands(brs);
    if (cats.length > 0) setCategoryId(cats[0].id);
    if (brs.length > 0) setBrandId(brs[0].id);
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Product name is required';
    if (!sku.trim()) errs.sku = 'SKU is required';
    else if (productService.getBySku(sku)) errs.sku = 'This SKU is already taken';
    if (!priceRupees || Number(priceRupees) <= 0) errs.price = 'Valid price is required';
    if (stockQuantity === '' || Number(stockQuantity) < 0) errs.stock = 'Valid stock is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const catObj = categories.find((c) => c.id === categoryId);
    const brandObj = brands.find((b) => b.id === brandId);

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    productService.createProduct({
      name,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      sku: sku.trim().toUpperCase(),
      barcode: barcode.trim() || undefined,
      description: description || name,
      shortDescription: shortDescription || description.slice(0, 100),
      categoryId,
      categoryName: catObj ? catObj.name : 'General',
      brandId,
      brandName: brandObj ? brandObj.name : 'DSL Signature',
      priceCents: rupeesToCents(Number(priceRupees)),
      compareAtPriceCents: comparePriceRupees ? rupeesToCents(Number(comparePriceRupees)) : undefined,
      stockQuantity: Number(stockQuantity),
      lowStockThreshold: Number(lowStockThreshold) || 10,
      isActive: true,
      images: ['/products/default.png'],
      tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      rating: 5.0,
      reviewCount: 1,
      specifications: {
        'Origin': brandObj ? brandObj.originCountry : 'Sri Lanka',
        'Standard': 'SLS Compliant',
      },
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Add New Stationery Product</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs text-xs">
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">Product Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Product Title *</label>
              <input
                type="text"
                placeholder="e.g. Atlas Single Line CR Book 200 Pages"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
              {errors.name && <p className="text-rose-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">SKU (Stock Keeping Unit) *</label>
              <input
                type="text"
                placeholder="e.g. ATL-CR-200-SL"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-[#08275E]"
              />
              {errors.sku && <p className="text-rose-600 mt-1">{errors.sku}</p>}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Barcode (EAN-13)</label>
              <input
                type="text"
                placeholder="e.g. 4792011002001"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
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

            <div>
              <label className="font-bold text-slate-700 block mb-1">Brand *</label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
              >
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Short Description (for product card)</label>
              <input
                type="text"
                placeholder="Brief summary of paper weight, ruling, or pack size"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Full Detailed Description</label>
              <textarea
                rows={3}
                placeholder="Detailed information regarding durability, paper opacity, binding..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">Pricing &amp; Inventory</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Selling Price (Rs.) *</label>
              <input
                type="number"
                placeholder="450.00"
                value={priceRupees}
                onChange={(e) => setPriceRupees(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
              {errors.price && <p className="text-rose-600 mt-1">{errors.price}</p>}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Compare-at Price (Rs.)</label>
              <input
                type="number"
                placeholder="490.00"
                value={comparePriceRupees}
                onChange={(e) => setComparePriceRupees(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Current Stock Qty *</label>
              <input
                type="number"
                placeholder="100"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold"
              />
              {errors.stock && <p className="text-rose-600 mt-1">{errors.stock}</p>}
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Low Stock Alert Level</label>
              <input
                type="number"
                placeholder="15"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-2 pt-4 border-t border-slate-100">
          <label className="font-bold text-slate-700 block">Search Tags (comma separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
          />
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
            <span>Save &amp; Publish to Store</span>
          </button>
        </div>
      </form>
    </div>
  );
}
