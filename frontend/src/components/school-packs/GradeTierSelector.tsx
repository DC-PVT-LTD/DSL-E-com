'use client';

import React from 'react';
import { GraduationCap, Layers, ArrowLeft, ArrowRight, Check } from 'lucide-react';

interface GradeTierSelectorProps {
  grades: string[];
  tiers: string[];
  selectedGrade: string | null;
  selectedTier: string | null;
  onSelectGrade: (grade: string) => void;
  onSelectTier: (tier: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  className?: string;
}

export const GradeTierSelector: React.FC<GradeTierSelectorProps> = ({
  grades,
  tiers,
  selectedGrade,
  selectedTier,
  onSelectGrade,
  onSelectTier,
  onBack,
  onSubmit,
  className = '',
}) => {
  const canSubmit = Boolean(selectedGrade && selectedTier);

  return (
    <div
      className={`relative bg-white/95 backdrop-blur-md rounded-[24px] sm:rounded-[36px] p-4 sm:p-7 md:p-8 shadow-[0_20px_50px_rgba(9,40,92,0.18)] border border-white/80 max-w-xl w-full select-none ${className}`}
    >
      <div className="space-y-5 sm:space-y-7">
        {/* Step 1: Grade Selection */}
        <div>
          <div className="flex items-center gap-2 mb-2.5 sm:mb-3.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100/70 flex items-center justify-center text-[#0866F5] shrink-0">
              <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-black text-[#09285C]">
              What&apos;s your grade?
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2.5">
            {grades.map((grade) => {
              const isSelected = selectedGrade === grade;
              return (
                <button
                  key={grade}
                  type="button"
                  onClick={() => onSelectGrade(grade)}
                  className={`flex items-center justify-center text-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0866F5] text-white shadow-md shadow-blue-500/25 scale-[1.02] ring-2 ring-blue-400/40'
                      : 'bg-[#F4F7FB] hover:bg-[#EBF1FA] text-[#09285C] border border-slate-200/80 hover:border-blue-300'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                  <span className="truncate">{grade}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Tier Selection */}
        <div className="pt-2 sm:pt-3 border-t border-slate-100/80">
          <div className="flex items-center gap-2 mb-2.5 sm:mb-3.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-blue-100/70 flex items-center justify-center text-[#0866F5] shrink-0">
              <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <h3 className="text-sm sm:text-base md:text-lg font-black text-[#09285C]">
              Choose your pack type
            </h3>
          </div>

          <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-2.5">
            {tiers.map((tier) => {
              const isSelected = selectedTier?.toLowerCase() === tier.toLowerCase();
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onSelectTier(tier)}
                  className={`flex items-center justify-center text-center gap-1 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold capitalize transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#0866F5] text-white shadow-md shadow-blue-500/25 scale-[1.02] ring-2 ring-blue-400/40'
                      : 'bg-[#F4F7FB] hover:bg-[#EBF1FA] text-[#09285C] border border-slate-200/80 hover:border-blue-300'
                  }`}
                  aria-pressed={isSelected}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                  <span>{tier}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-3 sm:pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold text-[#09285C] bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <button
            type="button"
            data-testid="find-my-pack-btn"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={`flex items-center justify-center gap-2 px-5 sm:px-7 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-black transition-all cursor-pointer ${
              canSubmit
                ? 'bg-[#0866F5] hover:bg-[#0753C7] text-white shadow-lg shadow-blue-500/30 hover:scale-[1.02] animate-pulse'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
            }`}
          >
            <span>Find My Pack</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

