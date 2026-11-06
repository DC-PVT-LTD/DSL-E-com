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
import { useUserStore } from '@/services/userStore';
import { ProductCard } from '@/components/products/ProductCard';
import { SaveToListModal } from '@/components/products/SaveToListModal';
import { BackInStockButton } from '@/components/products/BackInStockButton';

function ProductDetailSkeleton() {
  return (
    <div className="bg-[#FFFDF0] min-h-screen py-8 sm:py-12 animate-pulse">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="h-4 bg-stone-200 rounded-full w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6">
            <div className="bg-stone-200 rounded-3xl aspect-square w-full" />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <div className="h-6 bg-stone-200 rounded-full w-1/4" />
            <div className="h-8 bg-stone-200 rounded-full w-3/4" />
            <div className="h-14 bg-stone-200 rounded-3xl w-1/2" />
            <div className="h-20 bg-stone-100 rounded-2xl w-full" />
            <div className="h-12 bg-stone-200 rounded-full w-full" />
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

        // Fetch related products in this category from the backend
        try {
          const relatedRes = await productService.fetchProducts(
            { category: p.categoryId },
            'newest',
            1,
            5
          );
          setRelatedProducts(relatedRes.items.filter((item) => item.id !== p?.id).slice(0, 4));
        } catch {
          // Non-critical if related products fail
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

  if (error) {
    return (
      <div className="bg-[#FFFDF0] min-h-screen py-16 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold text-[#292525]">Failed to load product details</h1>
        <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={loadProduct}
            className="inline-flex items-center gap-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center gap-1.5 bg-white border border-[#C6E7FF] text-[#292525] text-xs font-bold px-5 py-2.5 rounded-full shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Catalogue</span>
          </Link>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-[#FFFDF0] min-h-screen py-16 text-center">
        <h1 className="text-xl font-bold text-[#292525]">Product not found</h1>
        <p className="text-xs text-[#292525]/60 mt-2">The product you requested might have been moved or deactivated.</p>
        <Link
          href="/shop"
          className="mt-5 inline-flex items-center gap-1.5 bg-[#0066CC] text-white text-xs font-bold px-5 py-2.5 rounded-full"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Catalogue</span>
        </Link>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);
  const currentPrice = selectedVariant ? selectedVariant.priceCents : product.priceCents;
  const comparePrice = selectedVariant?.compareAtPriceCents || product.compareAtPriceCents;
  const currentStock = selectedVariant ? selectedVariant.stockQuantity : product.stockQuantity;
  const isOutOfStock = currentStock <= 0;
  const isLowStock = currentStock > 0 && currentStock <= product.lowStockThreshold;

  const savings = comparePrice ? calculateSavingsPercent(comparePrice, currentPrice) : 0;

  const handleAddToCart = async () => {
    if (isOutOfStock || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const success = await addItem(product, quantity, selectedVariant);
      if (success) {
        setAdded(true);
        setTimeout(() => setAdded(false), 1500);
        // Note: Do not automatically open the cart drawer per requirement.
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FFFDF0] min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1.5 text-xs text-[#292525]/60 font-medium">
          <Link href="/home" className="hover:text-[#0066CC]">Home</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/shop" className="hover:text-[#0066CC]">Shop</Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href={`/categories/${(product as any).category?.slug || product.categoryId}`} className="hover:text-[#0066CC]">
            {product.categoryName || (product as any).category?.name || 'Category'}
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-[#292525] font-bold truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left: Product Visual Presentation */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-white rounded-3xl border border-[#C6E7FF]/70 aspect-square flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-xs">
              {savings > 0 && (
                <span className="absolute top-4 left-4 bg-[#FFD84D] text-[#292525] text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-xs">
                  {savings}% OFF
                </span>
              )}
              {(() => {
                const activeImg = (product.images && product.images[activeImageIdx]) || (product.images && product.images[0]);
                if (activeImg && typeof activeImg === 'string' && (activeImg.startsWith('http') || !activeImg.includes('.png'))) {
                  return (
                    <img
                      src={activeImg}
                      alt={product.name}
                      className="w-full h-full object-contain object-center p-4 rounded-2xl transition-all duration-200"
                    />
                  );
                }
                return (
                  <div className="w-36 h-36 rounded-3xl bg-[#FAF7EE] border border-[#C6E7FF] text-[#0066CC] flex flex-col items-center justify-center p-4">
                    <span className="font-heylowitch text-6xl leading-none">{product.name.charAt(0)}</span>
                    <span className="text-xs font-bold uppercase text-[#292525]/60 mt-2">
                      {product.brandName}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Thumbnail Gallery (when product has multiple images) */}
            {product.images && product.images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                {product.images.map((imgUrl, idx) => {
                  const isActive = idx === activeImageIdx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={`relative w-20 h-20 rounded-2xl bg-white border-2 p-1.5 shrink-0 overflow-hidden transition-all ${
                        isActive
                          ? 'border-[#0066CC] ring-2 ring-[#0066CC]/20 shadow-xs'
                          : 'border-[#C6E7FF]/80 hover:border-[#0066CC]/50'
                      }`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      <img
                        src={imgUrl}
                        alt={`${product.name} view ${idx + 1}`}
                        className="w-full h-full object-contain object-center"
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Product Buy Box & Configuration */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0066CC] uppercase tracking-wider bg-[#C6E7FF]/30 border border-[#C6E7FF] px-3 py-1 rounded-full">
                  {product.brandName || (product as any).brand?.name || 'DSL Genuine'}
                </span>
                <div className="flex items-center gap-1 text-xs text-[#292525]/70 font-semibold">
                  <Star className="w-4 h-4 fill-[#FFD84D] text-[#FFD84D]" />
                  <span>{(product.rating || 5).toFixed(1)}</span>
                  <span className="text-[#292525]/50 font-normal">({product.reviewCount || 0} customer reviews)</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-[#292525] mt-2 leading-tight">
                {product.name}
              </h1>

              <div className="flex items-center gap-4 text-xs text-[#292525]/50 mt-1.5 font-mono">
                <span>SKU: {selectedVariant ? selectedVariant.sku : product.sku}</span>
                {product.barcode && <span>Barcode: {product.barcode}</span>}
              </div>
            </div>

            {/* Pricing */}
            <div className="p-5 rounded-3xl bg-white border border-[#C6E7FF]/70 flex items-baseline gap-3 shadow-xs">
              {currentPrice > 0 ? (
                <>
                  <span className="text-3xl font-black text-[#292525]">
                    {formatLKR(currentPrice)}
                  </span>
                  {comparePrice && comparePrice > currentPrice && (
                    <>
                      <span className="text-base text-[#292525]/40 line-through">
                        {formatLKR(comparePrice)}
                      </span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        Save {formatLKR(comparePrice - currentPrice)}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-2xl font-black text-[#0066CC]">
                  Price on Request
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-[#292525]/75 leading-relaxed font-medium">
              {product.description}
            </p>

            {/* Variants selection */}
            {product.variants && product.variants.filter((v) => v.isActive).length > 0 && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-[#292525] block uppercase tracking-wider">
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
                          onClick={() => {
                            setSelectedVariant(variant);
                            setQuantity(1);
                          }}
                          className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-[#0066CC] text-white shadow-xs'
                              : 'bg-white border border-[#C6E7FF] text-[#292525] hover:bg-[#FFFDF0]'
                          }`}
                        >
                          {variant.name} ({formatLKR(variant.priceCents)})
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Stock Status Indicator */}
            <div>
              {isOutOfStock ? (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full inline-block">
                  Currently Out of Stock
                </span>
              ) : isLowStock ? (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-full inline-block">
                  Only {currentStock} left in stock!
                </span>
              ) : (
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  In Stock &amp; Ready to Ship ({currentStock} available)
                </span>
              )}
            </div>

            {/* Quantity and Add to Cart or Back-in-Stock Alert Row */}
            {isOutOfStock ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <BackInStockButton
                      productId={product.id}
                      productName={product.name}
                    />
                  </div>

                  <button
                    onClick={async () => {
                      if (!product) return;
                      const res = await toggleWishlist(product);
                      if (res.requiresAuth) {
                        router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
                      }
                    }}
                    className={`p-3.5 rounded-full border transition-all ${
                      inWishlist
                        ? 'bg-rose-50 border-[#0066CC] text-[#0066CC]'
                        : 'bg-white border-[#C6E7FF] text-[#292525] hover:text-[#0066CC]'
                    }`}
                    title={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                    aria-label={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                  >
                    <Heart className={`w-5 h-5 ${inWishlist ? 'fill-[#0066CC]' : ''}`} />
                  </button>

                  <button
                    onClick={() => setIsSaveModalOpen(true)}
                    className="p-3.5 rounded-full border border-[#C6E7FF] bg-white text-[#292525] hover:text-[#0066CC] hover:bg-[#F0F7FF] transition-all"
                    title="Save to Stationery List"
                    aria-label="Save to Stationery List"
                  >
                    <Bookmark className="w-5 h-5 text-[#0066CC]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-white shadow-xs">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="p-3 hover:bg-[#FFFDF0] text-[#292525] disabled:opacity-40 transition-colors"
                    title="Decrease"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 py-2 font-bold text-sm text-[#292525]">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(currentStock, q + 1))}
                    disabled={quantity >= currentStock}
                    className="p-3 hover:bg-[#FFFDF0] text-[#292525] disabled:opacity-40 transition-colors"
                    title="Increase"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={isSubmitting}
                  className={`flex-1 py-3.5 px-6 rounded-full font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md ${
                    isSubmitting
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                      : added
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0066CC] hover:bg-[#0052a3] text-white hover:scale-102'
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
                        Add to Cart{currentPrice > 0 ? ` • ${formatLKR(currentPrice * quantity)}` : ''}
                      </span>
                    </>
                  )}
                </button>

                <button
                  onClick={async () => {
                    if (!product) return;
                    const res = await toggleWishlist(product);
                    if (res.requiresAuth) {
                      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
                    }
                  }}
                  className={`p-3.5 rounded-full border transition-all ${
                    inWishlist
                      ? 'bg-rose-50 border-[#0066CC] text-[#0066CC]'
                      : 'bg-white border-[#C6E7FF] text-[#292525] hover:text-[#0066CC]'
                  }`}
                  title={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                  aria-label={inWishlist ? 'In your Wishlist' : 'Add to Wishlist'}
                >
                  <Heart className={`w-5 h-5 ${inWishlist ? 'fill-[#0066CC]' : ''}`} />
                </button>

                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="p-3.5 rounded-full border border-[#C6E7FF] bg-white text-[#292525] hover:text-[#0066CC] hover:bg-[#F0F7FF] transition-all"
                  title="Save to Stationery List"
                  aria-label="Save to Stationery List"
                >
                  <Bookmark className="w-5 h-5 text-[#0066CC]" />
                </button>
              </div>
            )}

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

            {/* Reassurance Features */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[#C6E7FF]/40 text-[11px] text-[#292525]/75 font-medium">
              <div className="flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#0066CC] shrink-0" />
                <span>Fast Dispatch</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#0066CC] shrink-0" />
                <span>100% Genuine</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-[#0066CC] shrink-0" />
                <span>Easy Returns</span>
              </div>
            </div>

            {/* Share product */}
            <div className="pt-4 border-t border-[#C6E7FF]/40 flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[#292525]/70 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-[#0066CC]" />
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
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    typeof window !== 'undefined' ? window.location.href : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full bg-[#EEF4FF] text-[#1877F2] font-bold text-xs hover:bg-[#DBE7FF] transition-colors"
                >
                  Facebook
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
                  className="px-3 py-1.5 rounded-full bg-stone-100 text-[#292525] font-bold text-xs hover:bg-stone-200 transition-colors inline-flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-[#292525]/60" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Product Specifications Section */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-8 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-[#292525] uppercase tracking-wider">
              Technical Specifications
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between py-2 border-b border-[#C6E7FF]/30 text-xs">
                  <span className="font-semibold text-[#292525]/60">{key}</span>
                  <span className="font-bold text-[#292525]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="space-y-6 pt-6">
            <h3 className="text-xl font-black text-[#292525] tracking-tight">
              — You might also love —
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
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
