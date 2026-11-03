import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Phone, Mail, MapPin, Sparkles, ArrowRight } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#FAF6EE] bg-[url('/images/about/about-bg.jpg')] bg-cover bg-top bg-no-repeat text-[#2D3748] font-sans relative selection:bg-[#BEE3F2] selection:text-[#08275E]">
      {/* ========================================================= */}
      {/* UPPER & MIDDLE CONTAINER (100% UNCHANGED)                 */}
      {/* ========================================================= */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-9 sm:space-y-11">
        {/* TOP FLOATING NAVIGATION PILL (100% ENGLISH) */}
        <div className="flex justify-center">
          <nav
            aria-label="About Navigation"
            className="inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 bg-white/95 backdrop-blur-md px-4 sm:px-7 py-2 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.06)] border border-[#C6E7FF] text-[11px] sm:text-xs font-bold text-[#384A65]"
          >
            <a href="#story" className="px-2 py-0.5 rounded-full hover:text-[#0066CC] transition-colors">
              Story of Creation
            </a>
            <span className="text-[#A0CBE8] select-none">•</span>
            <a href="#roots" className="px-2 py-0.5 rounded-full hover:text-[#0066CC] transition-colors">
              Our Roots
            </a>
            <span className="text-[#A0CBE8] select-none">•</span>
            <a href="#impact" className="px-2 py-0.5 rounded-full hover:text-[#0066CC] transition-colors">
              Community &amp; Impact
            </a>
            <span className="text-[#A0CBE8] select-none">•</span>
            <a href="#initiatives" className="px-2 py-0.5 rounded-full hover:text-[#0066CC] transition-colors">
              School Initiatives
            </a>
            <span className="text-[#A0CBE8] select-none">•</span>
            <a href="#contact" className="px-2 py-0.5 rounded-full hover:text-[#0066CC] transition-colors">
              Distribution &amp; Contact
            </a>
          </nav>
        </div>

        {/* TOP-LEFT VINTAGE PINNED SHIPPING TAG */}
        <div className="flex items-start">
          <div className="relative inline-block bg-[#FFFDF9]/95 backdrop-blur-xs px-5 py-3 rounded shadow-sm border-l-4 border-[#08275E] -rotate-1 hover:rotate-0 transition-transform">
            <div className="absolute -top-2 left-6 w-3.5 h-3.5 rounded-full bg-[#08275E] border-2 border-white shadow-sm flex items-center justify-center">
              <span className="w-1 h-1 bg-white rounded-full"></span>
            </div>
            <h2 className="text-xs sm:text-sm font-black tracking-wider text-[#08275E] uppercase mt-0.5">
              DSL ENTERPRISES (PVT) LTD
            </h2>
            <p className="text-[10.5px] text-[#556987] font-semibold tracking-tight">
              Serving Sri Lanka&apos;s Stationery Needs Since 2009
            </p>
          </div>
        </div>

        {/* UPPER ASYMMETRIC COLLAGE: POLAROID, STORY, SHOWROOM */}
        <div id="story" className="grid grid-cols-1 lg:grid-cols-12 gap-7 sm:gap-8 items-start">
          {/* LEFT: Tilted Polaroid + Washi Tape + Memo + Loop Arrow */}
          <div className="lg:col-span-3 flex flex-col items-center lg:items-start space-y-4">
            <div className="relative bg-white p-2.5 pb-5 rounded-md shadow-md border border-[#E2E8F0] -rotate-3 hover:rotate-0 transition-transform w-[205px]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#E2DAC9]/85 backdrop-blur-sm -rotate-1 rounded-xs shadow-[0_1px_2px_rgba(0,0,0,0.1)] border-t border-b border-white/60"></div>

              {/* 1. ART CUP EMOJI */}
              <div className="w-full h-40 relative rounded overflow-hidden flex items-center justify-center bg-transparent">
                <Image
                  src="/images/about/dsl-art-cup.png"
                  alt="DSL Stationery Art Supplies Cup"
                  fill
                  className="object-contain p-1"
                  priority
                />
              </div>

              <p className="mt-2 text-center text-[10px] italic font-serif text-[#64748B]">
                Original Craft &amp; Art
              </p>
            </div>

            {/* Lined Memo Note */}
            <div className="relative bg-[#FFFEEB] p-3 rounded shadow-xs border border-[#E8E2C6] w-[185px] text-[10px] text-[#554C38] leading-tight rotate-1">
              <div className="w-12 h-2.5 bg-[#E6DBC6]/80 absolute -top-1 left-5 -rotate-2 rounded-2xs border-t border-white/50"></div>
              <p className="font-medium pt-1">
                ✦ Established in 2009<br />
                ✦ Moratuwa Headquarters<br />
                ✦ 100% Quality Assured
              </p>
            </div>

            {/* Blue Hand-Drawn Looping Arrow */}
            <div className="hidden lg:block pl-8 pt-1">
              <svg width="75" height="48" viewBox="0 0 75 48" fill="none">
                <path
                  d="M 12 4 C 10 26, 26 38, 42 28 C 52 20, 36 8, 30 22 C 28 32, 45 42, 68 28"
                  stroke="#2563EB"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeDasharray="4 2"
                />
                <path
                  d="M 62 25 L 70 27 L 66 35"
                  stroke="#2563EB"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* CENTER: Editorial Story Narrative */}
          <div id="roots" className="lg:col-span-6 space-y-3.5 text-[#334155] leading-relaxed text-xs sm:text-[13px]">
            <p className="font-semibold text-[#1E293B]">
              The company is here to serve your needs in the current e-commerce market.
            </p>

            <p>
              <strong className="text-[#08275E]">DSL Enterprises (Pvt) Ltd</strong>, established in 2009 and
              headquartered in Moratuwa, Sri Lanka, offers a variety of products primarily in the stationery and
              educational supplies sector. Their main product range includes pens, clay, glue, marker pens, pencils,
              fabric paint, and general stationery items.
            </p>

            <p>
              The company is known for bringing high-quality brands such as{' '}
              <strong className="text-[#08275E]">Linc, Luxor, Fine, HP, Wetax, Speed, Doms, and Loto</strong> to the
              Sri Lankan market. They have a strong focus on innovation and quality, importing raw materials from
              countries like India and South Korea to ensure the superior standard of their products.
            </p>

            <p>
              In addition to stationery, DSL Enterprises is also involved in philanthropic efforts. Notably, they have
              introduced special pens and pencils under the <strong>Speed</strong> and <strong>Camlin</strong> brands,
              with a portion of proceeds supporting the <strong className="text-[#BF5E49]">&apos;Little Hearts&apos;</strong>{' '}
              project, aimed at building a Cardiac and Critical Care Complex at the Lady Ridgeway Hospital in Colombo.
            </p>

            <div className="pt-1">
              <span className="inline-block px-3 py-1 bg-[#F4EAE2] text-[#924334] text-xs font-bold rounded-full border border-[#E8D6CB]">
                Our Brand Promise: Quality, Integrity &amp; Educational Growth
              </span>
            </div>
          </div>

          {/* RIGHT: Showroom Illustration, Terracotta Tagline, Happy Student */}
          <div className="lg:col-span-3 flex flex-col items-center lg:items-end space-y-4">
            {/* 2. SHOWROOM SHELVES EMOJI */}
            <div className="w-[205px] h-[140px] relative">
              <Image
                src="/images/about/dsl-showroom-shelves.png"
                alt="DSL Stationery Retail Showroom Shelves"
                fill
                className="object-contain drop-shadow-sm"
                priority
              />
            </div>

            {/* Terracotta Tagline */}
            <div className="text-center lg:text-right space-y-0.5">
              <span className="block text-xs font-semibold text-[#556987]">Think of Doing.</span>
              <h3 className="text-sm sm:text-base font-extrabold text-[#BF5E49] leading-tight">
                Empowering Education &amp; Creativity.
              </h3>
            </div>

            {/* 3. HAPPY STUDENT EMOJI */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 relative">
              <Image
                src="/images/about/dsl-happy-student.png"
                alt="Happy DSL Student with Notebook and Pencils"
                fill
                className="object-contain drop-shadow-sm"
                priority
              />
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: COMMUNITY & IMPACT (FREE-FLOATING CARDS) */}
        <section id="impact" className="pt-6 sm:pt-10 space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-[#1E293B] tracking-tight uppercase">
              COMMUNITY &amp; IMPACT
            </h2>
            <p className="text-xs font-extrabold text-[#BF5E49] tracking-wider uppercase">
              CREATING SUSTAINABLE VALUE &amp; EDUCATIONAL GROWTH ACROSS SRI LANKA
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 pt-2">
            {/* 4. PILLAR 1: SUSTAINABLE NOTEBOOK EMOJI */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-36 h-36 relative flex items-center justify-center">
                <div className="w-32 h-32 relative">
                  <Image
                    src="/images/about/dsl-sustainable-notebook.png"
                    alt="Sustainable Recycled Notebook and Pen"
                    fill
                    className="object-contain drop-shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left w-full max-w-[270px]">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#1E293B] tracking-wide uppercase text-center">
                  SUSTAINABLE SOURCING:
                </h3>
                <ul className="text-xs text-[#475569] space-y-1 list-disc list-inside leading-relaxed">
                  <li>Offering a comprehensive range of eco-friendly and recycled stationery products.</li>
                  <li>Minimizing environmental impact through responsible sourcing and non-toxic materials.</li>
                </ul>
              </div>
            </div>

            {/* 5. PILLAR 2: EDUCATIONAL SCHOOLHOUSE EMOJI */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-36 h-36 relative flex items-center justify-center">
                <div className="w-32 h-32 relative">
                  <Image
                    src="/images/about/dsl-educational-school.png"
                    alt="Schoolhouse, Books and Pencils"
                    fill
                    className="object-contain drop-shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left w-full max-w-[270px]">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#1E293B] tracking-wide uppercase text-center">
                  EDUCATIONAL SUPPORT:
                </h3>
                <ul className="text-xs text-[#475569] space-y-1 list-disc list-inside leading-relaxed">
                  <li>Partnering with schools across Sri Lanka to provide essential supplies.</li>
                  <li>Fostering creativity and continuous learning in the next generation.</li>
                </ul>
              </div>
            </div>

            {/* 6. PILLAR 3: LOGISTICS WAREHOUSE EMOJI */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-36 h-36 relative flex items-center justify-center">
                <div className="w-32 h-32 relative">
                  <Image
                    src="/images/about/dsl-distribution-warehouse.png"
                    alt="DSL Distribution Hub and Delivery Vans"
                    fill
                    className="object-contain drop-shadow-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left w-full max-w-[270px]">
                <h3 className="text-xs sm:text-sm font-extrabold text-[#1E293B] tracking-wide uppercase text-center">
                  LOCAL EMPLOYMENT &amp; LOGISTICS:
                </h3>
                <ul className="text-xs text-[#475569] space-y-1 list-disc list-inside leading-relaxed">
                  <li>Investing in local infrastructure and creating stable employment.</li>
                  <li>Ensuring efficient and reliable supply chain operations island-wide.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Mission Quote Banner */}
          <div className="max-w-3xl mx-auto text-center pt-2 px-4">
            <p className="text-xs sm:text-sm text-[#4A5568] leading-relaxed italic font-serif">
              &ldquo;We believe in making a positive impact not through volunteerism alone, but through our core business
              operations. Our commitment to society focuses on providing sustainable stationery, supporting education with
              essential supplies, and investing in local employment and logistics across Sri Lanka.&rdquo;
            </p>
          </div>
        </section>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM SECTION: SRI LANKA MAP & CONTACT ON PASTEL WAVE    */}
      {/* ========================================================= */}
      <section id="contact" className="relative mt-4 sm:mt-6 w-full">
        {/* Exact Pastel Blue Wave Transition Curve */}
        <div className="w-full leading-none pointer-events-none -mb-1">
          <svg
            viewBox="0 0 1200 120"
            preserveAspectRatio="none"
            className="w-full h-14 sm:h-20 md:h-24 block"
          >
            <path
              d="M 0 30 C 120 8, 180 2, 240 2 C 360 2, 420 58, 600 58 C 780 58, 900 12, 1020 12 C 1100 12, 1160 28, 1200 28 L 1200 120 L 0 120 Z"
              fill="#C2E5F2"
            />
          </svg>
        </div>

        {/* Content resting directly on the pastel blue wave background */}
        <div className="bg-[#C2E5F2] pt-2 pb-16 sm:pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* 7. LEFT: SRI LANKA MAP EMOJI */}
            <div className="lg:col-span-5 flex justify-center -mt-6 sm:-mt-10">
              <div className="w-72 h-80 sm:w-80 sm:h-88 relative">
                <Image
                  src="/images/about/dsl-sri-lanka-map-v2.png"
                  alt="Sri Lanka Distribution Network and Moratuwa HQ"
                  fill
                  className="object-contain drop-shadow-sm"
                  priority
                />
              </div>
            </div>

            {/* RIGHT: Unboxed Floating Contact Block */}
            <div className="lg:col-span-7 space-y-5 text-xs sm:text-sm">
              <div>
                <h3 className="text-base sm:text-lg font-black text-[#1E293B] tracking-tight">
                  Contact info - shipped from Sri Lanka
                </h3>
                <p className="text-xs text-[#52637A] mt-0.5">
                  Supplying schools, retail bookshops, and nationwide customers directly from our hubs.
                </p>
              </div>

              <div className="space-y-3.5">
                {/* Landline */}
                <div className="flex items-start gap-4">
                  <span className="w-16 font-bold text-[#1E293B] shrink-0 pt-0.5">Line</span>
                  <a
                    href="tel:+94382236094"
                    className="inline-flex items-center gap-2 text-[#08275E] font-bold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0066CC]" />
                    <span>Line : +94 38 223 6094</span>
                  </a>
                </div>

                {/* Mobile / WhatsApp */}
                <div className="flex items-start gap-4">
                  <span className="w-16 font-bold text-[#1E293B] shrink-0 pt-0.5">Call</span>
                  <a
                    href="tel:+94773553555"
                    className="inline-flex items-center gap-2 text-[#08275E] font-bold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5 text-[#0066CC]" />
                    <span>Call : +94 77 355 3555</span>
                  </a>
                </div>

                {/* Addresses */}
                <div className="flex items-start gap-4">
                  <span className="w-16 font-bold text-[#1E293B] shrink-0 pt-0.5">Address</span>
                  <div className="space-y-1.5 text-[#334155]">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#08275E] shrink-0 mt-0.5" />
                      <div>
                        <strong>Head office:</strong> 30/3, Main Street, Moratuwa, Sri Lanka
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#08275E] shrink-0 mt-0.5" />
                      <div>
                        <strong>Distribution:</strong> No 14, Old Kottawa Road, Mirihana, Nugegoda
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 text-[#08275E] shrink-0 mt-0.5" />
                      <div>
                        <strong>Email:</strong>{' '}
                        <a href="mailto:support@dslstationery.lk" className="text-[#0066CC] hover:underline">
                          support@dslstationery.lk
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#0052a3] text-white text-xs font-bold px-6 py-2.5 rounded-full shadow-sm transition-transform hover:scale-105"
                >
                  <span>Explore Stationery Store</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 bg-white hover:bg-[#F8FAFC] text-[#1E293B] text-xs font-bold px-6 py-2.5 rounded-full border border-[#CBD5E1] shadow-xs transition-transform hover:scale-105"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0066CC]" />
                  <span>Get in Touch</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
