'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, RotateCcw, Layers, Upload, X, Sparkles } from 'lucide-react';
import { productService } from '@/services/productService';
import { categoryService } from '@/services/categoryService';
import { brandService } from '@/services/brandService';
import { ProductCategory, Brand, Product } from '@/types/product';
import { rupeesToCents, centsToRupees, formatLKR } from '@/lib/currency';

function AdminEditProductContent() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [product, setProduct] = useState<Product | undefined>(undefined);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [variants, setVariants] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [priceRupees, setPriceRupees] = useState<number | ''>('');
  const [stockQuantity, setStockQuantity] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Variant modal / inline form state
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [newVarTitle, setNewVarTitle] = useState('');
  const [newVarSku, setNewVarSku] = useState('');
  const [newVarColor, setNewVarColor] = useState('');
  const [newVarAttrKey, setNewVarAttrKey] = useState('');
  const [newVarAttrVal, setNewVarAttrVal] = useState('');
  const [newVarPriceRupees, setNewVarPriceRupees] = useState<number | ''>('');
  const [newVarStock, setNewVarStock] = useState<number | ''>(0);
  const [isGeneratingVarSku, setIsGeneratingVarSku] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const loadAllData = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      const [p, cats, brs, vars] = await Promise.all([
        productService.fetchProductById(id),
        categoryService.fetchCategories(),
        brandService.fetchBrands(),
        productService.fetchVariants(id),
      ]);

      setCategories(cats);
      setBrands(brs);
      setVariants(vars || []);

      if (p) {
        setProduct(p);
        setName(p.name);
        setSku(p.sku);
        setPriceRupees(centsToRupees(p.priceCents));
        setStockQuantity(p.stockQuantity);
        setCategoryId(p.categoryId);
        setSubcategoryId(p.subcategoryId || '');
        setBrandId(p.brandId);
        setDescription(p.description);
        setImages(p.images && p.images.length > 0 ? p.images : ['/products/default.png']);
      }
    } catch (err: any) {
      console.error('Failed to load product for editing:', err);
      setApiError(err?.message || 'Failed to load product from server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [id]);

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setIsSubmitting(true);
    setApiError(null);

    try {
      await productService.updateProductApi(product.id, {
        name,
        sku,
        priceCents: rupeesToCents(Number(priceRupees)),
        stockQuantity: Number(stockQuantity),
        categoryId,
        subcategoryId: subcategoryId ? subcategoryId : null,
        brandId,
        description,
        images: images.length > 0 ? images : ['/products/default.png'],
      });

      router.push('/admin/products');
    } catch (err: any) {
      console.error('Failed to update product:', err);
      setApiError(err?.message || 'Failed to update product on server');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateVarSku = async () => {
    setIsGeneratingVarSku(true);
    setVariantError(null);
    try {
      const generated = await productService.generateVariantSku(id, newVarColor.trim());
      setNewVarSku(generated);
    } catch (err: any) {
      console.error('Failed to generate variant SKU:', err);
      setVariantError(err?.message || 'Failed to auto-generate variant SKU');
    } finally {
      setIsGeneratingVarSku(false);
    }
  };

  const handleAddVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarTitle.trim()) {
      setVariantError('Variant title is required');
      return;
    }
    setVariantError(null);

    const attributes: Record<string, any> = {};
    if (newVarColor.trim()) {
      attributes.color = newVarColor.trim();
    }
    if (newVarAttrKey.trim() && newVarAttrVal.trim()) {
      attributes[newVarAttrKey.trim()] = newVarAttrVal.trim();
    }

    try {
      await productService.createVariant(id, {
        title: newVarTitle.trim(),
        name: newVarTitle.trim(),
        sku: newVarSku.trim() ? newVarSku.trim().toUpperCase() : undefined,
        priceCents: newVarPriceRupees ? rupeesToCents(Number(newVarPriceRupees)) : undefined,
        initialStock: Number(newVarStock) || 0,
        attributes,
      });
      setNewVarTitle('');
      setNewVarSku('');
      setNewVarColor('');
      setNewVarAttrKey('');
      setNewVarAttrVal('');
      setNewVarPriceRupees('');
      setNewVarStock(0);
      setIsAddingVariant(false);
      // Reload product & variants to reflect updated aggregate stock
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to create variant:', err);
      setVariantError(err?.message || 'Failed to create variant');
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    if (!confirm('Are you sure you want to deactivate this variant?')) return;
    try {
      await productService.deleteVariant(id, variantId);
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to delete variant:', err);
      alert(err?.message || 'Failed to deactivate variant');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-xs text-slate-500">
        <RotateCcw className="w-5 h-5 animate-spin mx-auto text-[#08275E] mb-2" />
        <p>Loading product details from server...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center text-xs text-slate-500">
        Product not found or failed to load.
        <div className="mt-3">
          <Link href="/admin/products" className="text-[#08275E] font-bold hover:underline">
            Return to Products List
          </Link>
        </div>
      </div>
    );
  }

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

      {apiError && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <div className="flex-1 font-medium">{apiError}</div>
          <button type="button" onClick={() => setApiError(null)} className="text-rose-500 hover:text-rose-700 font-bold">Dismiss</button>
        </div>
      )}

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
            <label className="font-bold text-slate-700 block mb-1">
              Stock Quantity {variants.length > 0 && <span className="text-[10px] text-slate-400 font-normal">(Aggregated across variants)</span>}
            </label>
            <input
              type="number"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value ? Number(e.target.value) : '')}
              required
              readOnly={variants.length > 0}
              className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-bold ${variants.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Parent Category</label>
            <select
              value={categoryId}
              onChange={(e) => {
                const newCatId = e.target.value;
                setCategoryId(newCatId);
                const belongs = categories.some((c) => c.id === subcategoryId && c.parentId === newCatId);
                if (!belongs) {
                  setSubcategoryId('');
                }
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white"
            >
              {categories
                .filter((c) => !c.parentId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Subcategory (Optional)</label>
            {(() => {
              const availableSubs = categories.filter((c) => c.parentId === categoryId);
              return (
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={availableSubs.length === 0}
                >
                  <option value="">
                    {availableSubs.length > 0 ? '-- Select Subcategory (Optional) --' : 'No subcategories under selected category'}
                  </option>
                  {availableSubs.map((sc) => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))}
                </select>
              );
            })()}
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Brand</label>
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
            <label className="font-bold text-slate-700 block mb-1">Description</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
            />
          </div>

          {/* Product Media & Image Upload */}
          <div className="sm:col-span-2 space-y-3 pt-2">
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
            <span>{isSubmitting ? 'Saving Changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>

      {/* Product Variants Section (Phase 6, P2 Integration) */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#08275E]" />
            <h2 className="text-sm font-bold text-slate-900">Product Variants</h2>
            <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
              {variants.length} SKU{variants.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingVariant(!isAddingVariant)}
            className="inline-flex items-center gap-1 text-[#08275E] hover:underline font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAddingVariant ? 'Cancel' : 'Add Variant'}</span>
          </button>
        </div>

        {variantError && (
          <p className="text-rose-600 font-semibold text-[11px]">{variantError}</p>
        )}

        {isAddingVariant && (
          <form onSubmit={handleAddVariant} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 animate-fade-in">
            <h3 className="font-bold text-slate-800">Add New SKU Variant</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Variant Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Blue Ink, 0.5mm"
                  value={newVarTitle}
                  onChange={(e) => setNewVarTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                  required
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Color / Variant Shade</label>
                <input
                  type="text"
                  placeholder="e.g. Blue, Red, Black"
                  value={newVarColor}
                  onChange={(e) => setNewVarColor(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Custom Attribute (Key: Value)</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. size"
                    value={newVarAttrKey}
                    onChange={(e) => setNewVarAttrKey(e.target.value)}
                    className="w-1/2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                  <input
                    type="text"
                    placeholder="e.g. 0.5mm"
                    value={newVarAttrVal}
                    onChange={(e) => setNewVarAttrVal(e.target.value)}
                    className="w-1/2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 block">Variant SKU</label>
                  <button
                    type="button"
                    onClick={handleGenerateVarSku}
                    disabled={isGeneratingVarSku}
                    className="text-xs font-semibold text-[#08275E] hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    <Sparkles className={`w-3 h-3 ${isGeneratingVarSku ? 'animate-spin text-[#FFD21C]' : ''}`} />
                    <span>{isGeneratingVarSku ? 'Generating...' : 'Auto-generate'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Leave blank to auto-generate"
                  value={newVarSku}
                  onChange={(e) => setNewVarSku(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Price (LKR)</label>
                <input
                  type="number"
                  placeholder="Leave empty for base price"
                  value={newVarPriceRupees}
                  onChange={(e) => setNewVarPriceRupees(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">Initial Stock</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newVarStock}
                  onChange={(e) => setNewVarStock(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingVariant(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#08275E] text-white px-4 py-1.5 rounded-xl font-bold"
              >
                Save Variant
              </button>
            </div>
          </form>
        )}

        {variants.length === 0 ? (
          <p className="text-slate-400 text-center py-4">
            No variants created yet. This product operates as a standalone SKU using its parent stock.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold">Variant Title</th>
                  <th className="py-2.5 px-3 font-bold">Attributes</th>
                  <th className="py-2.5 px-3 font-bold">SKU</th>
                  <th className="py-2.5 px-3 font-bold">Price</th>
                  <th className="py-2.5 px-3 font-bold">Stock</th>
                  <th className="py-2.5 px-3 font-bold">Status</th>
                  <th className="py-2.5 px-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-800">{v.name || v.title}</td>
                    <td className="py-2.5 px-3">
                      {v.attributes && Object.keys(v.attributes).length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(v.attributes).map(([k, val]) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                            >
                              {k === 'color' ? (
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-full inline-block border border-black/20"
                                    style={{
                                      backgroundColor:
                                        String(val).toLowerCase() === 'white'
                                          ? '#ffffff'
                                          : String(val).toLowerCase(),
                                    }}
                                  />
                                  {String(val)}
                                </span>
                              ) : (
                                `${k}: ${val}`
                              )}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{v.sku}</td>
                    <td className="py-2.5 px-3 font-bold text-[#08275E]">
                      {v.priceCents ? formatLKR(v.priceCents) : `${formatLKR(product.priceCents)} (Base)`}
                    </td>
                    <td className="py-2.5 px-3 font-bold">{v.stockQuantity}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${v.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                        {v.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteVariant(v.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Deactivate variant"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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

