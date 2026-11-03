import React from 'react';
import Link from 'next/link';
import { Award, Heart, ArrowRight, Sparkles, Globe2 } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-12">
      {/* Header */}
      <div className="space-y-4 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-[#C6E7FF]/40 text-[#0066CC] text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full border border-[#C6E7FF]/60">
          <Sparkles className="w-4 h-4 text-[#0066CC]" />
          <span>About DSL Stationery</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-[#292525] tracking-tight leading-tight">
          Serving Sri Lanka’s Educational &amp; Stationery Needs Since 2009
        </h1>
        <p className="text-sm sm:text-base text-[#292525]/70 leading-relaxed max-w-2xl mx-auto">
          Headquartered in Moratuwa, Sri Lanka, DSL Enterprises (Pvt) Ltd is a trusted pioneer in the stationery
          and educational supplies sector, bringing world-class brands to Sri Lankan students, teachers, and offices.
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#EBD5FA] text-[#8629B3] flex items-center justify-center font-bold">
            <Award className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#292525]">World-Class Brand Portfolio</h2>
          <p className="text-xs text-[#292525]/60 leading-relaxed">
            Proudly introducing renowned stationery brands including Doms, Linc, Luxor, Speed, Camlin, Fine, Wetex, HP, and Lido to Sri Lanka.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF9D2] text-[#B38A00] flex items-center justify-center font-bold">
            <Globe2 className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#292525]">Global Sourcing &amp; Quality</h2>
          <p className="text-xs text-[#292525]/60 leading-relaxed">
            Strong focus on innovation and quality standards, importing superior raw materials from leading partners in India and South Korea.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-7 space-y-3 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-[#C6E7FF]/40 text-[#0066CC] flex items-center justify-center font-bold">
            <Heart className="w-6 h-6 fill-[#0066CC] text-[#0066CC]" />
          </div>
          <h2 className="text-base font-bold text-[#292525]">Little Hearts Philanthropy</h2>
          <p className="text-xs text-[#292525]/60 leading-relaxed">
            Proudly supporting the Little Hearts project at Lady Ridgeway Hospital in Colombo through special Speed and Camlin pens and pencils.
          </p>
        </div>
      </div>

      {/* Detailed Company Overview Card */}
      <div className="bg-white rounded-3xl border border-[#C6E7FF]/60 p-8 sm:p-10 space-y-6 text-sm text-[#292525]/80 leading-relaxed shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#292525]">Our Profile &amp; Mission</h2>
          <p className="mt-2 text-[#292525]/70">
            <strong>DSL Enterprises (Pvt) Ltd</strong>, established in 2009 and headquartered in Moratuwa, Sri Lanka,
            offers a diverse and innovative portfolio in the stationery and educational supplies sector.
            Our main product range includes high-performance ballpoint and gel pens, modelling clay, non-toxic craft glue,
            marker pens, color pencils, fabric paint, and comprehensive everyday stationery items.
          </p>
        </div>

        <div className="border-t border-stone-100 pt-5">
          <h3 className="text-base font-bold text-[#292525] mb-2">High-Quality International Brands</h3>
          <p className="text-[#292525]/70">
            The company is renowned for bringing household brands such as <strong>Linc, Luxor, Fine, HP, Wetex, Speed, Doms, and Lido</strong> to the Sri Lankan market.
            With a steadfast commitment to high product standards, we import raw materials from world-renowned producers in India and South Korea,
            ensuring safe, reliable, and vibrant materials for school children, artists, and working professionals.
          </p>
        </div>

        <div className="border-t border-[#C6E7FF]/30 pt-5 bg-[#FFFDF0] -mx-8 -mb-10 p-8 rounded-b-3xl border-[#C6E7FF]">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-[#0066CC] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#292525]">Supporting the &quot;Little Hearts&quot; Project</h3>
              <p className="text-xs sm:text-sm text-[#292525]/70 mt-1">
                In addition to stationery distribution, DSL Enterprises is passionately dedicated to social philanthropy.
                Notably, we have introduced special pens and pencils under the <strong>Speed</strong> and <strong>Camlin</strong> brands,
                with a portion of sales proceeds directly supporting the <strong>Little Hearts project</strong>—aimed at constructing
                the Cardiac and Critical Care Complex at the Lady Ridgeway Hospital in Colombo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Call to action */}
      <div className="text-center pt-4">
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white font-bold text-xs sm:text-sm px-8 py-4 rounded-full shadow-md transition-all hover:scale-105"
        >
          <span>Explore Our Stationery Collection</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
