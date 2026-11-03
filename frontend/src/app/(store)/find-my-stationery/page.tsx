'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  School,
  GraduationCap,
  Briefcase,
  Palette,
  Gift,
  Check,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  RotateCcw,
  Info,
} from 'lucide-react';
import { recommendationService } from '@/services/recommendationService';
import { StationeryPersona, RecommendationResultItem } from '@/types/upload';
import { formatLKR, rupeesToCents } from '@/lib/currency';
import { useCartStore } from '@/services/cartStore';

const PERSONAS: { id: StationeryPersona; title: string; subtitle: string; icon: any }[] = [
  { id: 'school', title: 'School Student', subtitle: 'Grade 1 through O/L & A/L', icon: School },
  { id: 'university', title: 'University & College', subtitle: 'Campus lectures & tutorials', icon: GraduationCap },
  { id: 'office', title: 'Office & Business', subtitle: 'Filing, copiers & desk essentials', icon: Briefcase },
  { id: 'art_craft', title: 'Art & Craft Enthusiast', subtitle: 'Colouring, sketching & DIY', icon: Palette },
  { id: 'gift', title: 'Stationery Gift Pack', subtitle: 'Curated premium stationery sets', icon: Gift },
];

const SCHOOL_GRADES = [
  'Grade 1-2',
  'Grade 3-5',
  'Grade 6-9',
  'O/L (Grade 10-11)',
  'A/L Science',
  'A/L Commerce',
];

export default function FindMyStationeryPage() {
  const addItem = useCartStore((state) => state.addItem);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedPersona, setSelectedPersona] = useState<StationeryPersona>('school');
  const [selectedGrade, setSelectedGrade] = useState('Grade 6-9');
  const [budgetRupees, setBudgetRupees] = useState<number | ''>(5000);
  const [results, setResults] = useState<RecommendationResultItem[]>([]);
  const [addedAll, setAddedAll] = useState(false);

  const handleGenerate = () => {
    const items = recommendationService.getRecommendations({
      persona: selectedPersona,
      grade: selectedPersona === 'school' ? selectedGrade : undefined,
      budgetLkr: budgetRupees ? Number(budgetRupees) : undefined,
      preferences: [],
    });
    setResults(items);
    setStep(2);
  };

  const handleToggleItem = (index: number) => {
    const updated = [...results];
    updated[index].selected = !updated[index].selected;
    setResults(updated);
  };

  const handleUpdateQty = (index: number, newQty: number) => {
    if (newQty < 1) return;
    const updated = [...results];
    const item = updated[index];
    const finalQty = Math.min(newQty, item.product.stockQuantity);
    updated[index] = {
      ...item,
      quantity: finalQty,
      subtotalCents: item.unitPriceCents * finalQty,
    };
    setResults(updated);
  };

  const selectedItems = results.filter((r) => r.selected);
  const totalCents = selectedItems.reduce((acc, r) => acc + r.subtotalCents, 0);
  const budgetCents = budgetRupees ? rupeesToCents(Number(budgetRupees)) : undefined;
  const remainingBudgetCents = budgetCents !== undefined ? budgetCents - totalCents : undefined;

  const handleAddAllToCart = () => {
    selectedItems.forEach((item) => {
      addItem(item.product, item.quantity);
    });
    setAddedAll(true);
    setTimeout(() => {
      setAddedAll(false);
      setDrawerOpen(true);
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-1.5 bg-[#FFD84D] text-[#594300] text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider shadow-2xs">
          <Sparkles className="w-4 h-4 text-[#594300]" />
          <span>Smart Recommendation Wizard</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight">
          Find My Stationery
        </h1>
        <p className="text-sm text-[#292525]/70 leading-relaxed">
          Select your learning stage, school grade, or office persona. We configure the right mix
          of CR books, writing pens, and geometry essentials tailored to your budget.
        </p>
      </div>

      {step === 1 ? (
        /* STEP 1: Inputs & Questionnaire */
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 sm:p-10 shadow-sm space-y-8 animate-fade-in">
          {/* Persona Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-[#292525] uppercase tracking-wider block">
              1. Who are you shopping for?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PERSONAS.map((p) => {
                const Icon = p.icon;
                const isSelected = selectedPersona === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPersona(p.id)}
                    className={`p-4 rounded-2xl border-2 text-left flex items-start gap-3 transition-all ${
                      isSelected
                        ? 'border-[#0066CC] bg-[#C6E7FF]/15 shadow-xs ring-2 ring-[#C6E7FF]/40'
                        : 'border-stone-200 hover:border-[#C6E7FF] bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#0066CC] text-white' : 'bg-[#FFFDF0] text-[#292525] border border-[#C6E7FF]/50'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-[#292525] block">{p.title}</span>
                      <span className="text-[11px] text-[#292525]/60 mt-0.5 block">{p.subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional Grade Selection */}
          {selectedPersona === 'school' && (
            <div className="space-y-3 pt-4 border-t border-[#C6E7FF]/30 animate-fade-in">
              <label className="text-xs font-bold text-[#292525] uppercase tracking-wider block">
                2. Select School Grade Level
              </label>
              <div className="flex flex-wrap gap-2">
                {SCHOOL_GRADES.map((g) => {
                  const isSelected = selectedGrade === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#0066CC] text-white shadow-xs'
                          : 'bg-[#FFFDF0] text-[#292525]/80 hover:bg-[#C6E7FF]/20 border border-[#C6E7FF]/50'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Budget Input */}
          <div className="space-y-3 pt-4 border-t border-[#C6E7FF]/30">
            <label className="text-xs font-bold text-[#292525] uppercase tracking-wider block">
              3. Target Budget in LKR (Optional)
            </label>
            <div className="max-w-xs relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#292525]/50">
                Rs.
              </span>
              <input
                type="number"
                placeholder="5,000"
                value={budgetRupees}
                onChange={(e) => setBudgetRupees(e.target.value ? Number(e.target.value) : '')}
                className="w-full pl-12 pr-4 py-3 rounded-full border border-stone-200 text-xs font-bold text-[#292525] focus:outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#C6E7FF]/40 bg-[#FFFDF0]/50"
              />
            </div>
            <p className="text-[11px] text-[#292525]/50">
              We will calculate your running total and notify you if recommendations exceed your budget.
            </p>
          </div>

          {/* Generate CTA */}
          <div className="pt-4 border-t border-[#C6E7FF]/30">
            <button
              onClick={handleGenerate}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-sm px-8 py-4 rounded-full shadow-md transition-all group"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>Generate Recommended Basket</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      ) : (
        /* STEP 2: Results & Customization */
        <div className="space-y-8 animate-fade-in">
          {/* Budget Indicator Bar */}
          <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 text-[#B38A00]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#292525]">
                  Recommended for {selectedPersona === 'school' ? selectedGrade : selectedPersona.toUpperCase()}
                </h3>
                <span className="text-xs text-[#292525]/60">
                  {selectedItems.length} of {results.length} items selected
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-[#292525]/50 block text-[10px] uppercase">Running Total</span>
                <span className="text-lg font-black text-[#0066CC]">{formatLKR(totalCents)}</span>
              </div>

              {budgetCents !== undefined && (
                <div>
                  <span className="text-[#292525]/50 block text-[10px] uppercase">Remaining Budget</span>
                  <span className={`text-lg font-black ${
                    remainingBudgetCents! >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {formatLKR(remainingBudgetCents!)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Items List */}
          <div className="space-y-3">
            {results.map((item, idx) => (
              <div
                key={item.product.id}
                className={`p-4 rounded-3xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  item.selected
                    ? 'bg-white border-[#C6E7FF]/60 shadow-xs'
                    : 'bg-stone-50 border-stone-200/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={() => handleToggleItem(idx)}
                    className="w-5 h-5 rounded border-stone-300 text-[#0066CC] focus:ring-[#0066CC] cursor-pointer"
                  />
                  <div className="w-12 h-12 rounded-2xl bg-[#FFFDF0] border border-[#C6E7FF] text-[#0066CC] flex items-center justify-center font-bold text-sm shrink-0">
                    {item.product.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[#292525]">{item.product.name}</h4>
                    <p className="text-[11px] text-[#292525]/60 flex items-center gap-1 mt-0.5">
                      <Info className="w-3 h-3 text-[#0066CC]" />
                      <span>{item.reason}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 pl-8 sm:pl-0">
                  {/* Quantity selector */}
                  <div className="flex items-center border border-[#C6E7FF] rounded-full overflow-hidden bg-[#FFFDF0]">
                    <button
                      onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                      disabled={!item.selected || item.quantity <= 1}
                      className="p-1.5 hover:bg-[#C6E7FF]/30 text-[#292525] disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold text-[#292525]">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                      disabled={!item.selected || item.quantity >= item.product.stockQuantity}
                      className="p-1.5 hover:bg-[#C6E7FF]/30 text-[#292525] disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right min-w-24">
                    <span className="text-sm font-black text-[#0066CC] block">
                      {formatLKR(item.subtotalCents)}
                    </span>
                    <span className="text-[10px] text-[#292525]/50">
                      {formatLKR(item.unitPriceCents)} each
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Actions */}
          <div className="p-6 bg-white rounded-3xl border border-[#C6E7FF]/60 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <button
              onClick={() => setStep(1)}
              className="text-xs font-bold text-[#292525]/60 hover:text-[#0066CC] flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Change Criteria</span>
            </button>

            <button
              onClick={handleAddAllToCart}
              disabled={selectedItems.length === 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-sm px-8 py-3.5 rounded-full shadow-md transition-all disabled:opacity-40"
            >
              {addedAll ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>Added {selectedItems.length} Items to Cart!</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 text-white" />
                  <span>Add Selected Items to Cart ({formatLKR(totalCents)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
