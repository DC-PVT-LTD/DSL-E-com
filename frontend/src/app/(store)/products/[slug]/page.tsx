'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Heart,
  ShoppingCart,
  Check,
  Star,
  ChevronRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Plus,
  Minus,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Share2,
  Copy,
  Bookmark,
} from 'lucide-react';
import { productService } from '@/services/productService';
import { Product, ProductVariant } from '@/types/product';
import { formatLKR, calculateSavingsPercent } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { useWishlistStore } from '@/services/wishlistStore';
import { ProductCard } from '@/components/products/ProductCard';
import { SaveToListModal } from '@/components/products/SaveToListModal';
import { BackInStockButton } from '@/components/products/BackInStockButton';

function ProductDetailSkeleton() {
  return (
    <div className="bg-[#F7FAFF] min-h-screen py-8 sm:py-12 animate-pulse">
      <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 space-y-8">
        <div className="h-4 bg-slate-200 rounded-full w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-6">
            <div className="bg-slate-200 rounded-3xl aspect-square w-full" />
          </div>
          <div className="lg:col-span-6 space-y-5">
            <div className="h-5 bg-slate-200 rounded-full w-1/4" />
            <div className="h-8 bg-slate-200 rounded-full w-3/4" />
            <div className="h-10 bg-slate-200 rounded-2xl w-1/2" />
            <div className="h-24 bg-slate-100 rounded-2xl w-full" />
            <div className="h-12 bg-slate-200 rounded-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductDetailContent() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;

  const [product, setProduct] = useState<Product | null | undefined>(undefined);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const isInWishlist = useWishlistStore((state) => state.isInWishlist);
  const toggleWishlist = useWishlistStore((state) => state.toggleWishlist);

  const loadProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let p = await productService.fetchProductBySlug(slug);
      if (!p) {
        p = await productService.fetchProductById(slug);
      }

      setProduct(p);
      setActiveImageIdx(0);

      if (p) {
        const activeVariants = (p.variants || []).filter((v) => v.isActive);
        if (activeVariants.length > 0) {
          setSelectedVariant(activeVariants[0]);
        } else {
          setSelectedVariant(undefined);
        }
        setQuantity(1);

        try {
          const relatedRes = await productService.fetchProducts(
            { category: p.categoryId },
            'newest',
            1,
            5
          );
          setRelatedProducts(relatedRes.items.filter((item) => item.id !== p?.id).slice(0, 4));
        } catch {
          setRelatedProducts([]);
        }
      }
    } catch (err: unknown) {
      console.error(`Error loading product "${slug}":`, err);
      setError(err instanceof Error ? err.message : 'Unable to connect to product service.');
    } finally {
      setIsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-[#09285C]">Product Not Found</h1>
        <p className="text-xs sm:text-sm text-[#64748B] max-w-md mx-auto">
          {error || 'The requested product could not be found or is no longer listed in our catalogue.'}
        </p>
        <div className="pt-2">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-[#09285C] hover:bg-[#0866E8] text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-full transition-all shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse Full Catalogue</span>
          </Link>
        </div>
      </div>
    );
  }

  const currentPrice = selectedVariant ? selectedVariant.priceCents : product.priceCents;
  const comparePrice = selectedVariant ? selectedVariant.compareAtPriceCents : product.compareAtPriceCents;
  const currentStock = selectedVariant ? (selectedVariant.availableStock ?? selectedVariant.stockQuantity) : (product.availableStock ?? product.stockQuantity);
  const isOutOfStock = currentStock <= 0;
  const isLowStock = currentStock > 0 && currentStock <= 5;
  const inWishlist = isInWishlist(product.id);

  const savingsPercent = comparePrice && comparePrice > currentPrice
    ? calculateSavingsPercent(comparePrice, currentPrice)
    : 0;

  const handleAddToCart = async () => {
    if (isOutOfStock || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const success = await addItem(product, quantity, selectedVariant);
      if (success) {
        setAdded(true);
        setTimeout(() => {
          setAdded(false);
          setDrawerOpen(true);
        }, 800);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAFF]/40 pb-20 sm:pb-12">
      <div className="w-full max-w-[1720px] mx-auto px-3.5 sm:px-6 lg:px-12 xl:px-16 py-5 sm:py-10 space-y-6 sm:space-y-10">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-1.5 text-xs text-[#64748B] font-medium overflow-x-auto whitespace-nowrap">
          <Link href="/home" className="hover:text-[#0866E8]">Home</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link href="/shop" className="hover:text-[#0866E8]">Catalogue</Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <Link href={`/categories/${product.categoryId}`} className="hover:text-[#0866E8]">
            {product.categoryName}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[#09285C] font-bold truncate max-w-[200px]">{product.name}</span>
        </nav>

        {/* Product Hero: Gallery on Left, Details & Controls on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT: Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 aspect-square flex items-center justify-center overflow-hidden shadow-xs">
              {product.images && product.images.length > 0 && typeof product.images[activeImageIdx] === 'string' && (product.images[activeImageIdx].startsWith('http') || !product.images[activeImageIdx].includes('.png')) ? (
                <img
                  src={product.images[activeImageIdx]}
                  alt={product.name}
                  className="w-full h-full object-contain object-center transition-transform duration-300 hover:scale-105"
                />
              ) : (
                <div className="w-32 h-32 rounded-3xl bg-[#EAF4FF] text-[#0866E8] flex flex-col items-center justify-center font-black text-5xl">
                  {product.name.charAt(0)}
                  <span className="text-xs font-bold uppercase text-slate-400 mt-2">
                    {product.brandName}
                  </span>
                </div>
              )}

              {/* Discount Badge */}
              {savingsPercent > 0 && (
                <span className="absolute top-4 left-4 bg-[#0866E8] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                  SAVE {savingsPercent}%
                </span>
              )}
            </div>

            {/* Thumbnail Carousel */}
            {product.images && product.images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border p-2 shrink-0 transition-all cursor-pointer ${
                      activeImageIdx === idx
                        ? 'border-[#0866E8] ring-2 ring-[#0866E8]/20 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt={`Thumb ${idx + 1}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info & Purchasing Controls */}
          <div className="lg:col-span-6 space-y-5">
            {/* Header / Brand */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-[#0866E8] uppercase tracking-wider bg-[#EAF4FF] px-3 py-1 rounded-full">
                  {product.categoryName}
                </span>
                <span className="text-xs text-[#64748B] font-medium">
                  SKU: {selectedVariant?.sku || product.sku}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#09285C] tracking-tight leading-tight">
                {product.name}
              </h1>
              <div className="text-sm font-semibold text-[#64748B] mt-1">
                Authorised Brand: <strong className="text-[#09285C]">{product.brandName}</strong>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-3xl sm:text-4xl font-black text-[#09285C] tracking-tight">
                {formatLKR(currentPrice)}
              </span>
              {comparePrice && comparePrice > currentPrice && (
                <>
                  <span className="text-base sm:text-lg text-slate-400 line-through">
                    {formatLKR(comparePrice)}
                  </span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Save {formatLKR(comparePrice - currentPrice)}
                  </span>
                </>
              )}
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#09285C]/80 leading-relaxed font-normal">
              {product.description}
            </p>

            {/* Variants selection */}
            {product.variants && product.variants.filter((v) => v.isActive).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-black text-[#09285C] block uppercase tracking-wider">
                  Select Option:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants
                    .filter((v) => v.isActive)
                    .map((variant) => {
                      const isSelected = selectedVariant?.id === variant.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => {
                            setSelectedVariant(variant);
                            setQuantity(1);
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer touch-target ${
                            isSelected
                              ? 'bg-[#09285C] text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-[#09285C] hover:bg-slate-50'
                          }`}
                        >
                          {variant.name} ({formatLKR(variant.priceCents)})
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Stock Availability */}
            <div className="pt-1">
              {isOutOfStock ? (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl inline-block">
                  Currently Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl inline-block">
                  Only {currentStock} units left in stock!
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  In Stock &amp; Ready to Ship ({currentStock} available)
                </span>
              )}
            </div>

            {/* Quantity Stepper & Add to Cart Controls */}
            {isOutOfStock ? (
              <div className="space-y-3 pt-2">
                <BackInStockButton
                  productId={product.id}
                  productName={product.name}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-3">
                {/* Stepper */}
                <div className="flex items-center border border-slate-200 rounded-2xl bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-3 hover:bg-slate-50 text-[#09285C] disabled:opacity-30 transition-colors touch-target flex items-center justify-center cursor-pointer"
                    title="Decrease"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 font-black text-sm text-[#09285C]">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                    disabled={quantity >= currentStock}
                    className="p-3 hover:bg-slate-50 text-[#09285C] disabled:opacity-30 transition-colors touch-target flex items-center justify-center cursor-pointer"
                    title="Increase"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Primary Add to Cart Button */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isSubmitting}
                  className={`flex-1 py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md touch-target cursor-pointer ${
                    isSubmitting
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : added
                      ? 'bg-[#16A34A] text-white'
                      : 'bg-[#09285C] hover:bg-[#0866E8] active:bg-[#0866E8] text-white active:scale-95'
                  }`}
                >
                  {added ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>
                        Add to Cart • {formatLKR(currentPrice * quantity)}
                      </span>
                    </>
                  )}
                </button>

                {/* Wishlist Button */}
                <button
                  type="button"
                  onClick={async () => {
                    if (!product) return;
                    await toggleWishlist(product);
                  }}
                  className={`p-3.5 rounded-2xl border transition-all touch-target cursor-pointer flex items-center justify-center ${
                    inWishlist
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'bg-white border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                  }`}
                  title={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                  aria-label={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                >
                  <Heart className={`w-5 h-5 ${inWishlist ? 'fill-rose-600' : ''}`} />
                </button>

                {/* Save to List Button */}
                <button
                  type="button"
                  onClick={() => setIsSaveModalOpen(true)}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-[#0866E8] hover:bg-slate-50 transition-all touch-target cursor-pointer flex items-center justify-center"
                  title="Save to Stationery List"
                  aria-label="Save to Stationery List"
                >
                  <Bookmark className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Reassurance Features */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-[11px] text-[#64748B] font-medium">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#0866E8] shrink-0" />
                <span>Fast Dispatch</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#0866E8] shrink-0" />
                <span>100% Genuine</span>
              </div>
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#0866E8] shrink-0" />
                <span>Easy Returns</span>
              </div>
            </div>

            {/* Share product */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[#09285C]/70 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#0866E8]" />
                Share this item:
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `Check out ${product.name} on DSL Stationery: ${typeof window !== 'undefined' ? window.location.href : ''}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full bg-[#E8F8EE] text-[#0A8A3A] font-bold text-xs hover:bg-[#D3F3DC] transition-colors"
                >
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(window.location.href);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full bg-slate-100 text-[#09285C] font-bold text-xs hover:bg-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-500" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-8 space-y-4 shadow-xs">
            <h3 className="text-sm sm:text-base font-black text-[#09285C] uppercase tracking-wider">
              Product Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-slate-100 text-xs">
                  <span className="font-semibold text-[#64748B]">{key}</span>
                  <span className="font-bold text-[#09285C] text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="space-y-4 pt-4 sm:pt-6">
            <h3 className="text-lg sm:text-2xl font-black text-[#09285C] tracking-tight">
              Related Supplies
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Mobile Add-to-Cart Bar (Floats above mobile bottom nav) */}
      {!isOutOfStock && (
        <div className="sm:hidden fixed bottom-16 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-2.5 shadow-lg flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex flex-col">
            <span className="text-sm font-black text-[#09285C]">
              {formatLKR(currentPrice)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold">
              In Stock
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isSubmitting}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shadow-sm touch-target ${
              added
                ? 'bg-[#16A34A] text-white'
                : 'bg-[#09285C] active:bg-[#0866E8] text-white'
            }`}
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Add to Cart</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Save to list modal */}
      {product && (
        <SaveToListModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          product={{
            id: product.id,
            name: product.name,
            images: product.images,
            priceCents: currentPrice,
          }}
        />
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense fallback={<ProductDetailSkeleton />}>
      <ProductDetailContent />
    </Suspense>
  );
}
