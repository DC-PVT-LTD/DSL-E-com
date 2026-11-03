'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertCircle, RotateCcw, Upload, Image as ImageIcon, X } from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { brandService } from '@/services/brandService';
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
  const [images, setImages] = useState<string[]>(['/products/default.png']);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [cats, brs] = await Promise.all([
          categoryService.fetchCategories(),
          brandService.fetchBrands(),
        ]);
        setCategories(cats);
        setBrands(brs);
        if (cats.length > 0) setCategoryId(cats[0].id);
        if (brs.length > 0) setBrandId(brs[0].id);
      } catch (err) {
        console.error('Error loading categories/brands:', err);
      }
    }
    loadOptions();
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Product name is required';
    if (!sku.trim()) errs.sku = 'SKU is required';
    if (!priceRupees || Number(priceRupees) <= 0) errs.price = 'Valid price is required';
    if (stockQuantity === '' || Number(stockQuantity) < 0) errs.stock = 'Valid stock is required';
    if (!categoryId) errs.category = 'Category selection is required';
    if (!brandId) errs.brand = 'Brand selection is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploadedUrl = await productService.uploadProductImage(file);
      setImages((prev) => [
        uploadedUrl,
        ...prev.filter((img) => img !== '/products/default.png'),
      ]);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setUploadError(err?.message || 'Failed to upload image to server');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (imgUrl: string) => {
    setImages((prev) => {
      const next = prev.filter((u) => u !== imgUrl);
      return next.length > 0 ? next : ['/products/default.png'];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    setApiError(null);

    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    try {
      await productService.createProductApi({
        name: name.trim(),
        slug: `${slug}-${Date.now().toString().slice(-4)}`,
        sku: sku.trim().toUpperCase(),
        barcode: barcode.trim() || undefined,
        description: description || name,
        shortDescription: shortDescription || (description ? description.slice(0, 100) : name),
        categoryId,
        brandId,
        priceCents: rupeesToCents(Number(priceRupees)),
        compareAtPriceCents: comparePriceRupees ? rupeesToCents(Number(comparePriceRupees)) : undefined,
        stockQuantity: Number(stockQuantity),
        lowStockThreshold: Number(lowStockThreshold) || 5,
        isActive: true,
        images: images.length > 0 ? images : ['/products/default.png'],
        tags: tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        specifications: {
          'Standard': 'SLS Compliant',
        },
      });

      router.push('/admin/products');
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setApiError(err?.message || 'Failed to create product on server');
    } finally {
      setIsSubmitting(false);
    }
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

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{apiError}</div>
          <button type="button" onClick={() => setApiError(null)} className="text-rose-500 hover:text-rose-700 font-bold">Dismiss</button>
        </div>
      )}

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

        {/* Product Media & Image Upload */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-700 block">Product Images</label>
            <span className="text-xs text-slate-500">Supports JPG, PNG, WebP up to 5MB</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {images.map((imgUrl, index) => (
              <div
                key={index}
                className="relative w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgUrl} alt={`Product ${index + 1}`} className="w-full h-full object-cover" />
                {imgUrl !== '/products/default.png' && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(imgUrl)}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#08275E] bg-white flex flex-col items-center justify-center cursor-pointer transition-colors group">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={isUploading}
                onChange={handleImageUpload}
              />
              {isUploading ? (
                <RotateCcw className="w-5 h-5 text-slate-400 animate-spin" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#08275E] transition-colors" />
                  <span className="text-[10px] text-slate-500 font-medium mt-1">Upload</span>
                </>
              )}
            </label>
          </div>

          {uploadError && (
            <p className="text-xs text-rose-600 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{uploadError}</span>
            </p>
          )}
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
            disabled={isSubmitting}
            className="bg-[#08275E] hover:bg-[#103b8c] text-white font-bold px-6 py-2.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <RotateCcw className="w-4 h-4 animate-spin text-[#FFD21C]" />
            ) : (
              <Save className="w-4 h-4 text-[#FFD21C]" />
            )}
            <span>{isSubmitting ? 'Saving to Server...' : 'Save & Publish to Store'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
