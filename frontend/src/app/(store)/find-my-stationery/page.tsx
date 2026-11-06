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
} from 'lucide-react';
import { recommendationService } from '@/services/recommendationService';
import {
  StationeryPurpose,
  RecommendedProductItem,
  RecommendationSubstitute,
  RecommendationConfig,
} from '@/types/recommendations';
import { formatLKR, rupeesToCents } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';
import { Product } from '@/types/product';
import { productService } from '@/services/productService';

interface PurposeCardData {
  id: StationeryPurpose;
  title: string;
  subtitle: string;
  bgColor: string;
  borderColor: string;
  imageSrc: string;
}

const PURPOSE_CARDS: PurposeCardData[] = [
  {
    id: 'school',
    title: 'School Student',
    subtitle: 'School student stage, school & A/L',
    bgColor: '#FFF0C7',
    borderColor: '#F6DE95',
    imageSrc: '/images/find-my-stationery/school_student.svg',
  },
  {
    id: 'art_craft',
    title: 'Art & Craft Enthusiast',
    subtitle: 'Cuts craft and pottery supplies',
    bgColor: '#FFE0CB',
    borderColor: '#F6C6A5',
    imageSrc: '/images/find-my-stationery/art_craft.svg',
  },
  {
    id: 'university',
    title: 'University & College',
    subtitle: 'University & College essentials',
    bgColor: '#DDF5E4',
    borderColor: '#BEE7C8',
    imageSrc: '/images/find-my-stationery/university.svg',
  },
  {
    id: 'office',
    title: 'Office & Business',
    subtitle: 'Filing, copiers & desk essentials',
    bgColor: '#DCEBFF',
    borderColor: '#BAD5F7',
    imageSrc: '/images/find-my-stationery/office_business.svg',
  },
  {
    id: 'gift',
    title: 'Stationery Gift Pack',
    subtitle: 'Curated stationery gift pack',
    bgColor: '#FCE0EF',
    borderColor: '#F3C4DF',
    imageSrc: '/images/find-my-stationery/gift_pack.svg',
  },
];

interface GradeOption {
  id: string;
  label: string;
  bgColor: string;
  borderColor: string;
  iconSrc: string;
}

const GRADE_OPTIONS: GradeOption[] = [
  {
    id: 'Grade 1-2',
    label: 'Grade 1–2',
    bgColor: '#D7F5D9',
    borderColor: '#B7E6BA',
    iconSrc: '/images/find-my-stationery/grade_1_2.png',
  },
  {
    id: 'Grade 3-9',
    label: 'Grade 3–9',
    bgColor: '#FFE0CB',
    borderColor: '#F6C6A5',
    iconSrc: '/images/find-my-stationery/grade_3_9.png',
  },
  {
    id: 'O/L (Grade 10-11)',
    label: 'O/L (Grade 10–11)',
    bgColor: '#FFF0B9',
    borderColor: '#F5DE88',
    iconSrc: '/images/find-my-stationery/grade_ol.png',
  },
  {
    id: 'A/L Science',
    label: 'A/L Science',
    bgColor: '#D8EDFF',
    borderColor: '#B8DBF7',
    iconSrc: '/images/find-my-stationery/grade_al_science.png',
  },
  {
    id: 'A/L Commerce',
    label: 'A/L Commerce',
    bgColor: '#E9DCFF',
    borderColor: '#D5C0F6',
    iconSrc: '/images/find-my-stationery/grade_al_commerce.png',
  },
];

function getProductThumbnail(productName: string, categoryName?: string, imageUrl?: string): string {
  if (imageUrl) return imageUrl;
  const lower = `${productName} ${categoryName || ''}`.toLowerCase();
  if (lower.includes('book') || lower.includes('cr') || lower.includes('pad') || lower.includes('exercise')) {
    return '/images/find-my-stationery/product_books.png';
  }
  if (lower.includes('pen') || lower.includes('pencil') || lower.includes('ballpoint') || lower.includes('gel') || lower.includes('drawing')) {
    return '/images/find-my-stationery/product_pens.png';
  }
  if (lower.includes('geometry') || lower.includes('box') || lower.includes('math') || lower.includes('compass') || lower.includes('ruler')) {
    return '/images/find-my-stationery/product_geometry.png';
  }
  if (lower.includes('highlighter') || lower.includes('marker') || lower.includes('color')) {
    return '/images/find-my-stationery/product_highlighters.png';
  }
  if (lower.includes('glue') || lower.includes('scissor') || lower.includes('tape') || lower.includes('craft') || lower.includes('art') || lower.includes('paint') || lower.includes('clay')) {
    return '/images/find-my-stationery/product_craft.png';
  }
  return '/images/find-my-stationery/product_books.png';
}

export default function FindMyStationeryPage() {
  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [config, setConfig] = useState<RecommendationConfig | null>(null);

  // Criteria State
  const [selectedPurpose, setSelectedPurpose] = useState<StationeryPurpose>('school');
  const [selectedGrade, setSelectedGrade] = useState('Grade 3-9');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['General Writing', 'Mathematics']);
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

  // Initial load: Fetch recommendations so basket is immediately pre-populated matching the mockup
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
        subjects: selectedPurpose === 'school' ? selectedSubjects : undefined,
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
      // 1. Authoritative server check
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

      // If price changed or unavailable items, sync state
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

      // 2. Add each confirmed item to cart
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

  // Download PDF / Print list
  const handleDownloadPdf = () => {
    window.print();
  };

  // Share List
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
    <div className="w-full min-h-screen py-8 sm:py-12 px-4 sm:px-6 lg:px-8 font-nunito text-[#17234B]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#17234B] text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-[#7CE0C3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-8">
        {/* ========================================================= */}
        {/* HERO SECTION */}
        {/* ========================================================= */}
        <div className="text-center space-y-3">
          {/* Yellow Badge */}
          <div className="inline-flex items-center gap-2 bg-[#FFE79A] text-[#17234B] text-xs font-black px-4 py-1.5 rounded-full shadow-xs">
            <div className="relative w-5 h-5 shrink-0">
              <Image
                src="/images/find-my-stationery/star_badge.png"
                alt="Star"
                fill
                className="object-contain"
              />
            </div>
            <span className="tracking-wide">SMART RECOMMENDATION WIZARD</span>
          </div>

          {/* Heading */}
          <h1 className="font-fredoka text-fredoka-gradient font-bold text-4xl sm:text-5xl md:text-6xl tracking-tight">
            Find My Stationery
          </h1>

          {/* Subtitle */}
          <p className="font-nunito font-semibold text-xs sm:text-sm md:text-base text-[#17234B] max-w-2xl mx-auto leading-relaxed">
            Select your learning stage, school stage, or office purpose. We configure the right mix
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
        {/* WIZARD QUESTIONNAIRE SECTION */}
        {/* ========================================================= */}
        <div className="space-y-7">
          {/* 1. WHO ARE YOU SHOPPING FOR? */}
          <div className="space-y-3">
            <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
              1. WHO ARE YOU SHOPPING FOR?
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              {PURPOSE_CARDS.map((card) => {
                const isSelected = selectedPurpose === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedPurpose(card.id)}
                    style={{ backgroundColor: card.bgColor }}
                    className={`relative rounded-3xl p-4 sm:p-5 flex flex-col items-center text-center cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
                      isSelected
                        ? 'ring-4 ring-[#0875D1]/30 border-2 border-[#0875D1] shadow-lg'
                        : 'border-2 border-transparent shadow-xs'
                    }`}
                  >
                    {/* Illustration */}
                    <div className="relative w-16 h-14 sm:w-20 sm:h-16 mb-2">
                      <Image
                        src={card.imageSrc}
                        alt={card.title}
                        fill
                        className="object-contain"
                      />
                    </div>

                    {/* Title */}
                    <h3 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] leading-tight">
                      {card.title}
                    </h3>

                    {/* Subtitle */}
                    <p className="font-nunito font-medium text-[10px] sm:text-[11px] text-[#796D68] leading-tight mt-1 line-clamp-2">
                      {card.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. SELECT SCHOOL GRADE LEVEL (or conditional criterion) */}
          {selectedPurpose === 'school' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
                2. SELECT SCHOOL GRADE LEVEL
              </h2>

              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {GRADE_OPTIONS.map((grade) => {
                  const isSelected = selectedGrade === grade.id;
                  return (
                    <button
                      key={grade.id}
                      type="button"
                      onClick={() => setSelectedGrade(grade.id)}
                      style={{ backgroundColor: grade.bgColor }}
                      className={`rounded-full px-4 sm:px-5 py-2.5 flex items-center gap-2.5 font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] cursor-pointer transition-all duration-150 hover:scale-105 ${
                        isSelected
                          ? 'ring-3 ring-[#0875D1]/30 border-2 border-[#0875D1] shadow-sm'
                          : 'border-2 border-black/5'
                      }`}
                    >
                      <div className="relative w-6 h-6 shrink-0">
                        <Image
                          src={grade.iconSrc}
                          alt={grade.label}
                          fill
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

          {/* Conditional Criteria for other purposes */}
          {selectedPurpose === 'university' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
                2. SELECT STUDY AREA / DEGREE FIELD
              </h2>
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
                    className={`rounded-full px-4 py-2 font-nunito font-bold text-xs transition-all ${
                      selectedStudyArea === area
                        ? 'bg-[#DDF5E4] text-[#17234B] border-2 border-[#0875D1] ring-2 ring-[#0875D1]/20'
                        : 'bg-white border border-[#F0DCCB] text-[#17234B] hover:bg-slate-50'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'office' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
                2. OFFICE USAGE SCOPE
              </h2>
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
                    className={`rounded-full px-5 py-2 font-nunito font-bold text-xs transition-all ${
                      selectedOfficeScale === item.id
                        ? 'bg-[#DCEBFF] text-[#17234B] border-2 border-[#0875D1] ring-2 ring-[#0875D1]/20'
                        : 'bg-white border border-[#F0DCCB] text-[#17234B] hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'art_craft' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
                2. PRIMARY ART OR CRAFT ACTIVITY
              </h2>
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
                    className={`rounded-full px-4 py-2 font-nunito font-bold text-xs transition-all ${
                      selectedActivityType === act
                        ? 'bg-[#FFE0CB] text-[#17234B] border-2 border-[#0875D1] ring-2 ring-[#0875D1]/20'
                        : 'bg-white border border-[#F0DCCB] text-[#17234B] hover:bg-slate-50'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedPurpose === 'gift' && (
            <div className="space-y-3 animate-fade-in">
              <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
                2. GIFTING OCCASION
              </h2>
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
                    className={`rounded-full px-4 py-2 font-nunito font-bold text-xs transition-all ${
                      selectedOccasion === occ
                        ? 'bg-[#FCE0EF] text-[#17234B] border-2 border-[#0875D1] ring-2 ring-[#0875D1]/20'
                        : 'bg-white border border-[#F0DCCB] text-[#17234B] hover:bg-slate-50'
                    }`}
                  >
                    {occ}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. TARGET BUDGET IN LKR (OPTIONAL) */}
          <div className="space-y-3">
            <h2 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] uppercase tracking-wider">
              3. TARGET BUDGET IN LKR (OPTIONAL)
            </h2>

            <div className="flex flex-col lg:flex-row items-center gap-3.5 sm:gap-6 w-full">
              <div className="flex items-center gap-3 sm:gap-4 w-full flex-1">
                {/* Coin Purse Icon */}
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 shrink-0">
                  <Image
                    src="/images/find-my-stationery/coin_purse.png"
                    alt="Coin Purse"
                    fill
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
                    className="pastel-slider w-full"
                    aria-label="Target Budget"
                  />
                </div>

                {/* Selected Amount Pill */}
                <div className="shrink-0 bg-white border border-[#F0DCCB] px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-2xl shadow-xs font-nunito font-extrabold text-xs sm:text-base text-[#17234B]">
                  Rs. {budgetRupees.toLocaleString()}
                </div>
              </div>

              {/* Info Card with Coins */}
              <div className="shrink-0 bg-white/85 border border-[#F0DCCB] rounded-2xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs w-full lg:w-auto justify-center lg:justify-start">
                <div className="relative w-6 h-6 sm:w-7 sm:h-7 shrink-0">
                  <Image
                    src="/images/find-my-stationery/gold_coins.png"
                    alt="Gold Coins"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="font-nunito font-semibold text-[11px] sm:text-xs text-[#796D68]">
                  Set your budget and we&apos;ll recommend the best value mix.
                </span>
              </div>
            </div>
          </div>

          {/* Large CTA Button */}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#0084FF] to-[#0066CC] hover:from-[#0074e6] hover:to-[#005bb5] text-white font-nunito font-extrabold text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 rounded-full shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>Configuring Basket...</span>
                </>
              ) : (
                <>
                  <div className="relative w-7 h-7 shrink-0">
                    <Image
                      src="/images/find-my-stationery/star_badge.png"
                      alt="Star"
                      fill
                      className="object-contain"
                    />
                  </div>
                  <span>Generate Recommended Basket</span>
                  <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* DECORATIVE TRANSITION */}
        {/* ========================================================= */}
        <div className="flex flex-col items-center justify-center gap-1 text-[#7AB8FF] pt-2">
          <ChevronDown className="w-6 h-6 stroke-[3] -mb-3 animate-bounce" />
          <ChevronDown className="w-6 h-6 stroke-[3]" />
        </div>

        {/* ========================================================= */}
        {/* RECOMMENDED BASKET SECTION */}
        {/* ========================================================= */}
        <div ref={basketSectionRef} className="space-y-6 pt-2">
          {/* Banner */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-3.5 bg-gradient-to-r from-[#FFE3EC] via-[#EAE5FC] to-[#DCEBFF] border border-white/70 shadow-xs rounded-full px-6 py-3">
              <div className="relative w-8 h-8 shrink-0">
                <Image
                  src="/images/find-my-stationery/clipboard.png"
                  alt="Clipboard"
                  fill
                  className="object-contain"
                />
              </div>
              <h2 className="font-nunito font-extrabold text-lg sm:text-2xl text-[#17234B]">
                Your Recommended Basket
              </h2>
            </div>

            <p className="font-nunito font-semibold text-xs sm:text-sm text-[#796D68]">
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
            <div className="lg:col-span-8 bg-white/95 backdrop-blur-xs rounded-3xl border border-[#F0DCCB] p-5 sm:p-6 shadow-xs space-y-4">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F0DCCB]/60">
                <h3 className="font-nunito font-extrabold text-base sm:text-lg text-[#17234B]">
                  Recommended Items ({basketItems.length})
                </h3>

                <div className="inline-flex items-center gap-1.5 bg-[#E8F1FC] text-[#0875D1] text-xs font-bold px-3.5 py-1.5 rounded-full">
                  <span>
                    🎓 For{' '}
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
                  <h4 className="font-nunito font-extrabold text-sm text-[#17234B]">
                    No items in this basket
                  </h4>
                  <p className="font-nunito text-xs text-[#796D68]">
                    Click &ldquo;Generate Recommended Basket&rdquo; above to match stationery for
                    your selections.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#0066CC] text-white text-xs font-extrabold rounded-xl shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Generate Now</span>
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-[#F0DCCB]/50">
                  {basketItems.map((item, idx) => {
                    const thumb = getProductThumbnail(
                      item.productName,
                      item.categoryName,
                      (item as any).imageUrl
                    );
                    return (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        {/* Left: Thumbnail & Details */}
                        <div className="flex items-center gap-3.5 flex-1 min-w-0">
                          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFF8EF] border border-[#F0DCCB]/60 shrink-0 overflow-hidden p-1.5 flex items-center justify-center">
                            <Image
                              src={thumb}
                              alt={item.productName}
                              fill
                              className="object-contain p-1"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B] truncate">
                              {item.productName}
                            </h4>
                            <p className="font-nunito font-semibold text-[11px] text-[#796D68] mt-0.5">
                              {item.categoryName || 'School Essentials'} • SKU: {item.sku}
                            </p>

                            {/* Substitutes trigger */}
                            {item.substitutes && item.substitutes.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setActiveSubstituteIndex(idx)}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#0875D1] hover:underline mt-1"
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
                            <span className="font-nunito font-extrabold text-sm sm:text-base text-[#17234B]">
                              Rs. {(item.subtotalCents / 100).toLocaleString()}
                            </span>
                            {item.quantity > 1 && (
                              <span className="block text-[10px] text-[#796D68] font-medium">
                                Rs. {(item.unitPriceCents / 100).toLocaleString()} each
                              </span>
                            )}
                          </div>

                          {/* Quantity Stepper */}
                          <div className="flex items-center border border-[#F0DCCB] rounded-xl overflow-hidden bg-white shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                              title="Decrease"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-nunito font-extrabold text-xs text-[#17234B] min-w-[24px] text-center">
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
                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remove"
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
            <div className="lg:col-span-4 bg-[#F8F6FE] border border-[#E4DCFA] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 lg:sticky lg:top-24">
              {/* Header */}
              <div className="flex items-center gap-2.5 pb-2">
                <div className="relative w-7 h-7 shrink-0">
                  <Image
                    src="/images/find-my-stationery/shopping_basket.png"
                    alt="Shopping Basket"
                    fill
                    className="object-contain"
                  />
                </div>
                <h3 className="font-nunito font-extrabold text-base sm:text-lg text-[#17234B]">
                  Basket Summary
                </h3>
              </div>

              {/* Breakdown */}
              <div className="space-y-2.5 text-xs font-nunito font-bold">
                <div className="flex items-center justify-between text-[#17234B]">
                  <span className="font-medium text-[#796D68]">Items ({totalItemCount})</span>
                  <span>Rs. {(currentTotalCents / 100).toLocaleString()}</span>
                </div>

                <div className="flex items-center justify-between text-[#19A875]">
                  <span>Estimated Discount</span>
                  <span>- Rs. {(estimatedDiscountCents / 100).toLocaleString()}</span>
                </div>
              </div>

              {/* Total Pill Container */}
              <div className="bg-[#EFE8FF] rounded-2xl p-4 flex items-center justify-between my-3">
                <span className="font-nunito font-extrabold text-xs sm:text-sm text-[#17234B]">
                  Total (Est.)
                </span>
                <span className="font-nunito font-black text-lg sm:text-xl text-[#17234B]">
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
                  className="w-full bg-gradient-to-r from-[#FF7E9C] to-[#F85786] hover:from-[#ff6d8f] hover:to-[#eb4776] text-white font-nunito font-extrabold py-3.5 px-6 rounded-2xl shadow-md shadow-pink-500/20 flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-50 text-xs sm:text-sm"
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
                  className="w-full bg-white hover:bg-slate-50 text-[#0875D1] border-2 border-[#B8DBF7] font-nunito font-extrabold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download List (PDF)</span>
                </button>

                {/* 3. Share List */}
                <button
                  type="button"
                  onClick={handleShareList}
                  className="w-full bg-white hover:bg-slate-50 text-[#6B46C1] border-2 border-[#D5C0F6] font-nunito font-extrabold py-3 px-6 rounded-2xl flex items-center justify-center gap-2 cursor-pointer transition-all text-xs"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share List</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SUBSTITUTE SELECTION MODAL */}
      {/* ========================================================= */}
      {activeSubstituteIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-xl text-xs animate-scale-up font-nunito">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm text-[#17234B]">
                  Select Compatible Alternative
                </h3>
                <p className="text-[11px] text-[#796D68]">
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
                return (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-2xl border border-[#F0DCCB] hover:border-[#0875D1] hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-extrabold text-[#17234B] text-xs">{sub.name}</h4>
                      <span className="text-[10px] text-[#796D68]">
                        SKU: {sub.sku} • Stock: {sub.stockQuantity}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-extrabold text-[#17234B] block text-xs">
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
                        className="px-3.5 py-1.5 bg-[#0066CC] hover:bg-[#0052a3] text-white font-extrabold rounded-xl text-[11px] cursor-pointer"
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
