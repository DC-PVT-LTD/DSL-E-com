'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShoppingCart,
  ArrowRight,
  Trash2,
  Plus,
  Minus,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  Share2,
  ChevronDown,
  RotateCcw,
  Package,
  Sparkles,
} from 'lucide-react';
import { recommendationService } from '@/services/recommendationService';
import {
  StationeryPurpose,
  RecommendedProductItem,
  RecommendationSubstitute,
  RecommendationConfig,
} from '@/types/recommendations';
import { formatLKR } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { Product } from '@/types/product';
import { productService } from '@/services/productService';
import { INITIAL_PRODUCTS } from '@/mocks/products';

// Authoritative local image lookup cache for true product photos
const PRODUCT_IMAGE_BY_SKU = new Map<string, string>();
const PRODUCT_IMAGE_BY_ID = new Map<string, string>();
const PRODUCT_IMAGE_BY_NAME = new Map<string, string>();

for (const p of INITIAL_PRODUCTS) {
  const img = p.images?.[0];
  if (img) {
    if (p.sku) PRODUCT_IMAGE_BY_SKU.set(p.sku.toLowerCase().trim(), img);
    if (p.id) PRODUCT_IMAGE_BY_ID.set(p.id.toLowerCase().trim(), img);
    if (p.name) PRODUCT_IMAGE_BY_NAME.set(p.name.toLowerCase().trim(), img);
  }
}

function getProductThumbnail(
  productName: string,
  categoryName?: string,
  imageUrl?: string | null,
  sku?: string,
  productId?: string
): string {
  // 1. Direct image URL provided by backend or item
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl;
  }

  // 2. Lookup by SKU
  if (sku) {
    const bySku = PRODUCT_IMAGE_BY_SKU.get(sku.toLowerCase().trim());
    if (bySku) return bySku;
  }

  // 3. Lookup by Product ID
  if (productId) {
    const byId = PRODUCT_IMAGE_BY_ID.get(productId.toLowerCase().trim());
    if (byId) return byId;
  }

  // 4. Lookup by exact product name
  if (productName) {
    const byName = PRODUCT_IMAGE_BY_NAME.get(productName.toLowerCase().trim());
    if (byName) return byName;

    // 5. Partial / fuzzy name match in catalogue
    const lowerName = productName.toLowerCase();
    for (const [name, img] of PRODUCT_IMAGE_BY_NAME.entries()) {
      if (lowerName.includes(name) || name.includes(lowerName)) {
        return img;
      }
    }
  }

  // 6. Clean real product fallback from catalogue
  return 'https://www.dsl.lk/media/img/1722854176.jpg';
}

interface PurposeCardData {
  id: StationeryPurpose;
  title: string;
  subtitle: string;
  imageSrc: string;
}

const PURPOSE_CARDS: PurposeCardData[] = [
  {
    id: 'school',
    title: 'School Student',
    subtitle: 'School student stage, school & A/L',
    imageSrc: '/images/find-my-stationery/school_student.svg',
  },
  {
    id: 'art_craft',
    title: 'Art & Craft Enthusiast',
    subtitle: 'Colouring, sketching & DIY supplies',
    imageSrc: '/images/find-my-stationery/art_craft.svg',
  },
  {
    id: 'university',
    title: 'University & College',
    subtitle: 'Campus lectures & tutorials',
    imageSrc: '/images/find-my-stationery/university.svg',
  },
  {
    id: 'office',
    title: 'Office & Business',
    subtitle: 'Filing, copiers & desk essentials',
    imageSrc: '/images/find-my-stationery/office_business.svg',
  },
  {
    id: 'gift',
    title: 'Stationery Gift Pack',
    subtitle: 'Curated premium stationery sets',
    imageSrc: '/images/find-my-stationery/gift_pack.svg',
  },
];

interface GradeOption {
  id: string;
  label: string;
  iconSrc: string;
}

const GRADE_OPTIONS: GradeOption[] = [
  {
    id: 'Grade 1-2',
    label: 'Grade 1–2',
    iconSrc: '/images/find-my-stationery/grade_1_2.png',
  },
  {
    id: 'Grade 3-9',
    label: 'Grade 3–9',
    iconSrc: '/images/find-my-stationery/grade_3_9.png',
  },
  {
    id: 'O/L (Grade 10-11)',
    label: 'O/L (Grade 10–11)',
    iconSrc: '/images/find-my-stationery/grade_ol.png',
  },
  {
    id: 'A/L Science',
    label: 'A/L Science',
    iconSrc: '/images/find-my-stationery/grade_al_science.png',
  },
  {
    id: 'A/L Commerce',
    label: 'A/L Commerce',
    iconSrc: '/images/find-my-stationery/grade_al_commerce.png',
  },
];



export default function FindMyStationeryPage() {
  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [, setConfig] = useState<RecommendationConfig | null>(null);

  // Criteria State
  const [selectedPurpose, setSelectedPurpose] = useState<StationeryPurpose>('school');
  const [selectedGrade, setSelectedGrade] = useState('Grade 3-9');
  const [selectedStudyArea, setSelectedStudyArea] = useState('Engineering & STEM');
  const [selectedOfficeScale, setSelectedOfficeScale] = useState('individual');
  const [selectedActivityType, setSelectedActivityType] = useState('Water Colour Painting');
  const [selectedOccasion, setSelectedOccasion] = useState('Birthday Gift');
  const [budgetRupees, setBudgetRupees] = useState<number>(5000);

  // Recommendations & Basket State
  const [basketItems, setBasketItems] = useState<RecommendedProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [serverWarnings, setServerWarnings] = useState<string[]>([]);
  const [activeSubstituteIndex, setActiveSubstituteIndex] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasAddedToCart, setHasAddedToCart] = useState(false);

  const basketSectionRef = useRef<HTMLDivElement>(null);

  // Initial load: Fetch recommendations so basket is immediately pre-populated
  useEffect(() => {
    async function init() {
      try {
        const conf = await recommendationService.getConfig();
        setConfig(conf);
      } catch (err) {
        console.warn('Could not load recommendation config:', err);
      }

      try {
        setIsLoading(true);
        const res = await recommendationService.getRecommendations({
          purpose: 'school',
          grade: 'Grade 3-9',
          budgetLkr: 5000,
        });
        if (res && res.items && res.items.length > 0) {
          setBasketItems(res.items);
        }
      } catch (err: any) {
        console.warn('Initial recommendations error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // Show temporary toast message
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Generate / Regenerate Recommendations
  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setServerWarnings([]);
    setHasAddedToCart(false);

    try {
      const res = await recommendationService.getRecommendations({
        purpose: selectedPurpose,
        grade: selectedPurpose === 'school' ? selectedGrade : undefined,
        studyArea: selectedPurpose === 'university' ? selectedStudyArea : undefined,
        officeScale: selectedPurpose === 'office' ? selectedOfficeScale : undefined,
        activityType: selectedPurpose === 'art_craft' ? selectedActivityType : undefined,
        occasion: selectedPurpose === 'gift' ? selectedOccasion : undefined,
        budgetLkr: budgetRupees ? Number(budgetRupees) : undefined,
      });

      setBasketItems(res.items);

      // Smooth scroll down to the recommended basket section
      setTimeout(() => {
        basketSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to generate recommendations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quantity updates
  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setBasketItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const boundedQty = Math.min(newQty, item.stockQuantity || 99);
      copy[index] = {
        ...item,
        quantity: boundedQty,
        subtotalCents: item.unitPriceCents * boundedQty,
      };
      return copy;
    });
  };

  // Remove item from basket
  const handleRemoveItem = (index: number) => {
    setBasketItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Substitute alternative product
  const handleSelectSubstitute = (index: number, sub: RecommendationSubstitute) => {
    setBasketItems((prev) => {
      const copy = [...prev];
      const old = copy[index];
      const subtotal = sub.priceCents * old.quantity;

      copy[index] = {
        ...old,
        productId: sub.id,
        productName: sub.name,
        productSlug: sub.slug,
        sku: sub.sku,
        unitPriceCents: sub.priceCents,
        stockQuantity: sub.stockQuantity,
        subtotalCents: subtotal,
        lowStock: sub.stockQuantity <= 5,
        reason: `Substituted alternative for ${old.productName}`,
      };
      return copy;
    });
    setActiveSubstituteIndex(null);
  };

  // Calculations
  const currentTotalCents = basketItems.reduce((acc, it) => acc + it.subtotalCents, 0);
  const totalItemCount = basketItems.reduce((acc, it) => acc + it.quantity, 0);
  const estimatedDiscountCents = currentTotalCents >= 300000 ? 20000 : Math.round(currentTotalCents * 0.05);
  const finalTotalCents = Math.max(0, currentTotalCents - estimatedDiscountCents);

  // Add All to Cart with Authoritative Verification
  const handleAddToCart = async () => {
    if (basketItems.length === 0) return;
    setIsValidating(true);
    setServerWarnings([]);
    setErrorMessage(null);

    try {
      const validation = await recommendationService.validateBasket(
        basketItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          submittedPriceCents: item.unitPriceCents,
        })),
        budgetRupees
      );

      if (validation.warnings && validation.warnings.length > 0) {
        setServerWarnings(validation.warnings);
      }

      if (!validation.isValid) {
        setBasketItems((prev) =>
          prev
            .map((local) => {
              const validated = validation.items.find((v) => v.productId === local.productId);
              if (!validated || !validated.isAvailable) return null;
              return {
                ...local,
                unitPriceCents: validated.priceCents,
                quantity: validated.quantity,
                subtotalCents: validated.subtotalCents,
              };
            })
            .filter(Boolean) as RecommendedProductItem[]
        );
        setIsValidating(false);
        return;
      }

      for (const item of basketItems) {
        let product: Product;
        try {
          const fetched = await productService.fetchProductById(item.productId);
          if (fetched) {
            product = fetched;
          } else {
            throw new Error('Not found');
          }
        } catch {
          product = {
            id: item.productId,
            name: item.productName,
            slug: item.productSlug,
            sku: item.sku,
            priceCents: item.unitPriceCents,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: 5,
            isActive: true,
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            images: [],
            tags: [],
            description: item.reason,
            shortDescription: item.reason,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as unknown as Product;
        }

        await addItem(product, item.quantity);
      }

      setHasAddedToCart(true);
      triggerToast('All recommended items successfully added to your cart!');
      setTimeout(() => {
        setDrawerOpen(true);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Server validation failed. Please review your basket.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  const handleShareList = () => {
    if (typeof window !== 'undefined') {
      const url = `${window.location.origin}/find-my-stationery?purpose=${selectedPurpose}&grade=${encodeURIComponent(selectedGrade)}&budget=${budgetRupees}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        triggerToast('Link copied to clipboard! Share it with anyone.');
      }
    }
  };

  return (
    <div className="w-full min-h-screen py-8 sm:py-14 px-4 sm:px-6 lg:px-10 xl:px-14 bg-gradient-to-b from-[#F7FAFF] via-white to-[#EAF4FF]/40 text-[#09285C]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#09285C] text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in border border-blue-900/40">
          <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="w-full max-w-7xl xl:max-w-[1520px] mx-auto space-y-8 sm:space-y-12">
        {/* ========================================================= */}
        {/* HERO SECTION (DSL ENTERPRISES THEME)                      */}
        {/* ========================================================= */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-[#EAF4FF] text-[#0866E8] text-xs font-black px-4 py-1.5 rounded-full border border-[#0866E8]/20 shadow-2xs">
            <Sparkles className="w-4 h-4 text-[#FFD84D]" />
            <span className="tracking-wider uppercase">Smart Recommendation Wizard</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-[#09285C] tracking-tight">
            Find My Stationery
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-[#64748B] max-w-2xl mx-auto leading-relaxed">
            Select your learning stage, school stage, or office persona. We configure the ideal mix
            of CR books, writing pens, and geometry essentials tailored to your budget.
          </p>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-2xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* WIZARD QUESTIONNAIRE SECTION                              */}
        {/* ========================================================= */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 lg:p-10 shadow-xs space-y-8">
          {/* 1. WHO ARE YOU SHOPPING FOR? */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                Who Are You Shopping For?
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {PURPOSE_CARDS.map((card) => {
                const isSelected = selectedPurpose === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedPurpose(card.id)}
                    className={`relative rounded-3xl p-4 sm:p-5 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? 'border-2 border-[#0866E8] bg-[#EAF4FF]/40 shadow-lg shadow-[#0866E8]/10 ring-4 ring-[#0866E8]/15'
                        : 'border border-slate-200/80 bg-white hover:border-[#0866E8]/40 shadow-2xs'
                    }`}
                  >
                    {/* Illustration Container */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F7FAFF] border border-slate-100 flex items-center justify-center p-2.5 mb-2.5 relative">
                      <Image
                        src={card.imageSrc}
                        alt={card.title}
                        width={64}
                        height={64}
                        className="object-contain"
                      />
                    </div>

                    {/* Title */}
                    <h3 className="font-black text-xs sm:text-sm text-[#09285C] leading-tight">
                      {card.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="text-[10px] sm:text-[11px] text-[#64748B] leading-tight mt-1 line-clamp-2">
                      {card.subtitle}
                    </p>

                    {/* Selected badge */}
                    {isSelected && (
                      <span className="mt-2 text-[10px] font-bold text-[#0866E8] bg-white border border-[#0866E8]/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Check className="w-3 h-3 text-[#0866E8]" /> Selected
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SELECT SCHOOL GRADE LEVEL (or conditional criterion) */}
          {selectedPurpose === 'school' && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                  Select School Grade Level
                </h2>
              </div>

              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {GRADE_OPTIONS.map((grade) => {
                  const isSelected = selectedGrade === grade.id;
                  return (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => setSelectedGrade(grade.id)}
                      className={`rounded-2xl px-4 sm:px-5 py-2.5 flex items-center gap-2.5 font-bold text-xs sm:text-sm cursor-pointer transition-all duration-150 hover:scale-102 ${
                        isSelected
                          ? 'bg-[#09285C] text-white border-2 border-[#09285C] shadow-md shadow-[#09285C]/15 ring-2 ring-[#0866E8]/20'
                          : 'bg-white border border-slate-200/90 text-[#09285C] hover:bg-[#F7FAFF] hover:border-[#0866E8]/40 shadow-2xs'
                      }`}
                    >
                      <div className="relative w-6 h-6 shrink-0">
                        <Image
                          src={grade.iconSrc}
                          alt={grade.label}
                          width={24}
                          height={24}
                          className="object-contain"
                        />
                      </div>
                      <span>{grade.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Conditional Criteria for other personas */}
          {selectedPurpose === 'university' && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                  Select Study Area / Degree Field
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  'Engineering & STEM',
                  'Medical & Life Sciences',
                  'Business & Management',
                  'Law & Humanities',
                  'General Studies',
                ].map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setSelectedStudyArea(area)}
                    className={`rounded-2xl px-4 py-2 font-bold text-xs transition-all ${
                      selectedStudyArea === area
                        ? 'bg-[#09285C] text-white border-2 border-[#09285C] shadow-sm'
                        : 'bg-white border border-slate-200 text-[#09285C] hover:bg-[#F7FAFF]'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'office' && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                  Office Usage Scope
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  { id: 'individual', label: 'Individual Desk' },
                  { id: 'team', label: 'Small Team (2-5)' },
                  { id: 'department', label: 'Department' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedOfficeScale(item.id)}
                    className={`rounded-2xl px-5 py-2 font-bold text-xs transition-all ${
                      selectedOfficeScale === item.id
                        ? 'bg-[#09285C] text-white border-2 border-[#09285C] shadow-sm'
                        : 'bg-white border border-slate-200 text-[#09285C] hover:bg-[#F7FAFF]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'art_craft' && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                  Primary Art or Craft Activity
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  'Water Colour Painting',
                  'Sketching & Drawing',
                  'Fabric Painting',
                  'Modelling Clay & Sculpting',
                  'General Craft',
                ].map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setSelectedActivityType(act)}
                    className={`rounded-2xl px-4 py-2 font-bold text-xs transition-all ${
                      selectedActivityType === act
                        ? 'bg-[#09285C] text-white border-2 border-[#09285C] shadow-sm'
                        : 'bg-white border border-slate-200 text-[#09285C] hover:bg-[#F7FAFF]'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'gift' && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                  Gifting Occasion
                </h2>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {[
                  'Birthday Gift',
                  'Student Achievement',
                  'Teacher Appreciation',
                  'Executive Colleague',
                  'Creative Gift',
                ].map((occ) => (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => setSelectedOccasion(occ)}
                    className={`rounded-2xl px-4 py-2 font-bold text-xs transition-all ${
                      selectedOccasion === occ
                        ? 'bg-[#09285C] text-white border-2 border-[#09285C] shadow-sm'
                        : 'bg-white border border-slate-200 text-[#09285C] hover:bg-[#F7FAFF]'
                    }`}
                  >
                    {occ}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. TARGET BUDGET IN LKR (OPTIONAL) */}
          <div className="space-y-3.5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#0866E8] text-white text-xs font-black flex items-center justify-center">
                3
              </span>
              <h2 className="text-xs sm:text-sm font-black text-[#09285C] uppercase tracking-wider">
                Target Budget in LKR (Optional)
              </h2>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-4 sm:gap-6 w-full">
              <div className="flex items-center gap-3 sm:gap-4 w-full flex-1">
                {/* Coin Purse Icon */}
                <div className="w-11 h-11 rounded-2xl bg-[#EAF4FF] border border-[#0866E8]/20 flex items-center justify-center p-2 shrink-0">
                  <Image
                    src="/images/find-my-stationery/coin_purse.png"
                    alt="Coin Purse"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>

                {/* Slider Track */}
                <div className="flex-1 w-full flex items-center min-w-0">
                  <input
                    type="range"
                    min="1000"
                    max="25000"
                    step="500"
                    value={budgetRupees}
                    onChange={(e) => setBudgetRupees(Number(e.target.value))}
                    className="w-full accent-[#0866E8] h-2 bg-slate-200 rounded-full cursor-pointer"
                    aria-label="Target Budget"
                  />
                </div>

                {/* Selected Amount Pill */}
                <div className="shrink-0 bg-[#F7FAFF] border border-slate-200 px-4 py-2 rounded-2xl shadow-2xs font-black text-sm sm:text-base text-[#09285C]">
                  Rs. {budgetRupees.toLocaleString()}
                </div>
              </div>

              {/* Info Card with Coins */}
              <div className="shrink-0 bg-[#F7FAFF] border border-slate-200/80 rounded-2xl px-4 py-2 flex items-center gap-2.5 shadow-2xs w-full lg:w-auto justify-center lg:justify-start">
                <div className="w-6 h-6 shrink-0 relative">
                  <Image
                    src="/images/find-my-stationery/gold_coins.png"
                    alt="Gold Coins"
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
                <span className="font-semibold text-xs text-[#64748B]">
                  Set your budget and we&apos;ll configure the best value mix.
                </span>
              </div>
            </div>
          </div>

          {/* Large CTA Button */}
          <div className="pt-4 text-center">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-3 bg-[#0866E8] hover:bg-[#005cd9] text-white font-bold text-sm sm:text-base px-8 sm:px-10 py-3.5 sm:py-4 rounded-full shadow-lg shadow-[#0866E8]/25 hover:shadow-xl active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Configuring Recommended Basket...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-[#FFD84D]" />
                  <span>Generate Recommended Basket</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DECORATIVE TRANSITION                                     */}
        {/* ========================================================= */}
        <div className="flex flex-col items-center justify-center gap-1 text-[#0866E8]/60 pt-2">
          <ChevronDown className="w-6 h-6 stroke-[3] -mb-3 animate-bounce" />
          <ChevronDown className="w-6 h-6 stroke-[3]" />
        </div>

        {/* ========================================================= */}
        {/* RECOMMENDED BASKET SECTION (DSL ENTERPRISES THEME)        */}
        {/* ========================================================= */}
        <div ref={basketSectionRef} className="space-y-6 pt-2">
          {/* Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-3 bg-[#EAF4FF] border border-[#0866E8]/20 shadow-2xs rounded-full px-6 py-2.5">
              <div className="w-6 h-6 shrink-0 relative">
                <Image
                  src="/images/find-my-stationery/clipboard.png"
                  alt="Clipboard"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </div>
              <h2 className="font-black text-lg sm:text-2xl text-[#09285C]">
                Your Recommended Basket
              </h2>
            </div>

            <p className="font-semibold text-xs sm:text-sm text-[#64748B]">
              A personalized stationery list based on your selections.
            </p>
          </div>

          {/* Server Warnings Banner (if any) */}
          {serverWarnings.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-2xl space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Authoritative Inventory &amp; Price Update:</span>
              </div>
              <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                {serverWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Two-Column Grid: Left (Recommended Items) vs Right (Basket Summary) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: RECOMMENDED ITEMS */}
            <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-7 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <h3 className="font-black text-base sm:text-lg text-[#09285C]">
                  Recommended Items ({basketItems.length})
                </h3>

                <div className="inline-flex items-center gap-1.5 bg-[#EAF4FF] text-[#0866E8] text-xs font-bold px-3.5 py-1.5 rounded-full border border-[#0866E8]/20">
                  <span>
                    For{' '}
                    {selectedPurpose === 'school'
                      ? selectedGrade
                      : selectedPurpose.replace('_', ' & ')}{' '}
                    • Budget: ~ Rs. {budgetRupees.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              {basketItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="font-black text-sm text-[#09285C]">
                    No items in this basket
                  </h4>
                  <p className="text-xs text-[#64748B]">
                    Click &ldquo;Generate Recommended Basket&rdquo; above to match stationery for
                    your selections.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0866E8] text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Generate Now</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {basketItems.map((item, idx) => {
                    const thumb = getProductThumbnail(
                      item.productName,
                      item.categoryName,
                      item.imageUrl || (item as any).imageUrl,
                      item.sku,
                      item.productId
                    );
                    return (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white border border-slate-200/80 shadow-2xs shrink-0 overflow-hidden p-1.5 flex items-center justify-center relative">
                            <Image
                              src={thumb}
                              alt={item.productName}
                              width={56}
                              height={56}
                              className="w-full h-full object-contain"
                              unoptimized={thumb.startsWith('http')}
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-xs sm:text-sm text-[#09285C] truncate">
                              {item.productName}
                            </h4>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              {item.categoryName || 'Stationery'} • SKU: {item.sku}
                            </p>

                            {/* Substitutes trigger */}
                            {item.substitutes && item.substitutes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveSubstituteIndex(idx)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0866E8] hover:underline mt-1 cursor-pointer"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                                <span>{item.substitutes.length} Alternative(s)</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Right: Price, Quantity Stepper, Delete */}
                        <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 shrink-0 pt-2 sm:pt-0">
                          {/* Unit / Line Price */}
                          <div className="text-left sm:text-right min-w-[70px]">
                            <span className="font-black text-sm sm:text-base text-[#09285C]">
                              Rs. {(item.subtotalCents / 100).toLocaleString()}
                            </span>
                            {item.quantity > 1 && (
                              <span className="block text-[10px] text-[#64748B] font-medium">
                                Rs. {(item.unitPriceCents / 100).toLocaleString()} each
                              </span>
                            )}
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Decrease"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-black text-xs text-[#09285C] min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                              disabled={item.quantity >= (item.stockQuantity || 99)}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Increase"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Remove Trash Can */}
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: BASKET SUMMARY */}
            <div className="lg:col-span-4 bg-[#F7FAFF] border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 lg:sticky lg:top-24">
              {/* Header */}
              <div className="flex items-center gap-2.5 pb-2">
                <div className="w-7 h-7 shrink-0 relative">
                  <Image
                    src="/images/find-my-stationery/shopping_basket.png"
                    alt="Shopping Basket"
                    width={28}
                    height={28}
                    className="object-contain"
                  />
                </div>
                <h3 className="font-black text-base sm:text-lg text-[#09285C]">
                  Basket Summary
                </h3>
              </div>

              {/* Breakdown */}
              <div className="space-y-2.5 text-xs font-bold">
                <div className="flex items-center justify-between text-[#09285C]">
                  <span className="font-medium text-[#64748B]">Items ({totalItemCount})</span>
                  <span>Rs. {(currentTotalCents / 100).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-emerald-600">
                  <span>Estimated Bundle Discount</span>
                  <span>- Rs. {(estimatedDiscountCents / 100).toLocaleString()}</span>
                </div>
              </div>

              {/* Total Pill Container */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between my-3 shadow-2xs">
                <span className="font-bold text-xs sm:text-sm text-[#09285C]">
                  Total (Est.)
                </span>
                <span className="font-black text-lg sm:text-xl text-[#09285C]">
                  Rs. {(finalTotalCents / 100).toLocaleString()}
                </span>
              </div>

              {/* 3 Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {/* 1. Add All to Cart */}
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={isValidating || basketItems.length === 0}
                  className="w-full bg-[#09285C] hover:bg-[#0866E8] text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-[#09285C]/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 text-xs sm:text-sm"
                >
                  {isValidating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying Stock...</span>
                    </>
                  ) : hasAddedToCart ? (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Added to Cart!</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-4 h-4" />
                      <span>Add All to Cart</span>
                    </>
                  )}
                </button>

                {/* 2. Download List (PDF) */}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="w-full bg-white hover:bg-slate-50 text-[#09285C] border border-slate-200 font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs"
                >
                  <Download className="w-4 h-4 text-[#0866E8]" />
                  <span>Download List (PDF)</span>
                </button>

                {/* 3. Share List */}
                <button
                  type="button"
                  onClick={handleShareList}
                  className="w-full bg-white hover:bg-slate-50 text-[#0866E8] border border-slate-200 font-bold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs"
                >
                  <Share2 className="w-4 h-4 text-[#0866E8]" />
                  <span>Share List</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBSTITUTE SELECTION MODAL                                */}
      {/* ========================================================= */}
      {activeSubstituteIndex !== null && (
        <div className="fixed inset-0 z-50 bg-[#09285C]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-sm text-[#09285C]">
                  Select Compatible Alternative
                </h3>
                <p className="text-[11px] text-[#64748B]">
                  Replacing &ldquo;{basketItems[activeSubstituteIndex]?.productName}&rdquo;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSubstituteIndex(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {basketItems[activeSubstituteIndex]?.substitutes?.map((sub) => {
                const diffCents =
                  sub.priceCents - basketItems[activeSubstituteIndex].unitPriceCents;
                const subThumb = getProductThumbnail(
                  sub.name,
                  undefined,
                  sub.imageUrl,
                  sub.sku,
                  sub.id
                );
                return (
                  <div
                    key={sub.id}
                    className="p-3 rounded-2xl border border-slate-200 hover:border-[#0866E8] hover:bg-[#EAF4FF]/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200/80 shadow-2xs shrink-0 overflow-hidden p-1 flex items-center justify-center relative">
                        <Image
                          src={subThumb}
                          alt={sub.name}
                          width={40}
                          height={40}
                          className="w-full h-full object-contain"
                          unoptimized={subThumb.startsWith('http')}
                        />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-[#09285C] text-xs truncate">{sub.name}</h4>
                        <span className="text-[10px] text-[#64748B] block">
                          SKU: {sub.sku} • Stock: {sub.stockQuantity}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-black text-[#09285C] block text-xs">
                          {formatLKR(sub.priceCents)}
                        </span>
                        <span
                          className={`text-[10px] font-bold block ${
                            diffCents > 0
                              ? 'text-amber-600'
                              : diffCents < 0
                              ? 'text-emerald-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {diffCents > 0
                            ? `+${formatLKR(diffCents)}`
                            : diffCents < 0
                            ? `-${formatLKR(Math.abs(diffCents))}`
                            : 'Same price'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectSubstitute(activeSubstituteIndex, sub)}
                        className="px-3.5 py-1.5 bg-[#0866E8] hover:bg-[#005cd9] text-white font-bold rounded-xl text-[11px] cursor-pointer"
                      >
                        Choose
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
