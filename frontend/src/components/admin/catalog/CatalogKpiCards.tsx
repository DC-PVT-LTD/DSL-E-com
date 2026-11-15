'use client';

import React from 'react';

export interface KpiCardData {
  id: string;
  label: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate';
  active?: boolean;
  onClick?: () => void;
}

interface CatalogKpiCardsProps {
  cards: KpiCardData[];
  isLoading?: boolean;
}

const colorMap = {
  blue: {
    bg: 'bg-blue-50/50',
    border: 'border-blue-200',
    activeBorder: 'border-blue-600 ring-2 ring-blue-500/20',
    text: 'text-blue-700',
    iconBg: 'bg-blue-100 text-blue-700',
  },
  emerald: {
    bg: 'bg-emerald-50/50',
    border: 'border-emerald-200',
    activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/20',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-700',
  },
  amber: {
    bg: 'bg-amber-50/50',
    border: 'border-amber-200',
    activeBorder: 'border-amber-600 ring-2 ring-amber-500/20',
    text: 'text-amber-700',
    iconBg: 'bg-amber-100 text-amber-700',
  },
  rose: {
    bg: 'bg-rose-50/50',
    border: 'border-rose-200',
    activeBorder: 'border-rose-600 ring-2 ring-rose-500/20',
    text: 'text-rose-700',
    iconBg: 'bg-rose-100 text-rose-700',
  },
  purple: {
    bg: 'bg-purple-50/50',
    border: 'border-purple-200',
    activeBorder: 'border-purple-600 ring-2 ring-purple-500/20',
    text: 'text-purple-700',
    iconBg: 'bg-purple-100 text-purple-700',
  },
  slate: {
    bg: 'bg-slate-50/50',
    border: 'border-slate-200',
    activeBorder: 'border-slate-800 ring-2 ring-slate-500/20',
    text: 'text-slate-700',
    iconBg: 'bg-slate-100 text-slate-700',
  },
};

export const CatalogKpiCards: React.FC<CatalogKpiCardsProps> = ({ cards, isLoading }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => {
        const theme = colorMap[card.color || 'blue'];
        const isClickable = !!card.onClick;

        return (
          <div
            key={card.id}
            onClick={card.onClick}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            className={`p-3.5 rounded-xl border bg-white transition-all shadow-sm ${
              card.active
                ? `${theme.activeBorder} ${theme.bg}`
                : `border-slate-200 hover:border-slate-300 ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-500 truncate" title={card.label}>
                {card.label}
              </span>
              <div className={`p-1.5 rounded-lg ${theme.iconBg}`}>
                {card.icon}
              </div>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {isLoading ? (
                  <span className="inline-block w-8 h-6 bg-slate-100 animate-pulse rounded" />
                ) : (
                  card.value
                )}
              </span>
              {card.subtitle && (
                <span className="text-[11px] font-medium text-slate-400 truncate">
                  {card.subtitle}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

