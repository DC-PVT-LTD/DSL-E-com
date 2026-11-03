import React from 'react';
import Link from 'next/link';
import { Logo } from './Logo';
import { Mail, Phone, MapPin, Truck, ShieldCheck, Clock, RotateCcw, Heart } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#FFFDF0] text-[#292525] pt-16 pb-12 border-t border-[#C6E7FF]/60">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 space-y-12">
        {/* Value Proposition Grid - Soft Pastel Rounded Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pb-12 border-b border-[#C6E7FF]/40">
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#B9D5FF]/60 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#B9D5FF]/30 flex items-center justify-center shrink-0 text-[#2563eb]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#292525]">Islandwide Delivery</h4>
              <p className="text-[11px] text-[#292525]/70 mt-0.5">
                Fast 2-3 business days delivery to all 25 districts in Sri Lanka.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#C6E7FF]/60 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#C6E7FF]/30 flex items-center justify-center shrink-0 text-[#0066CC]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#292525]">100% Genuine Brands</h4>
              <p className="text-[11px] text-[#292525]/70 mt-0.5">
                Authentic stock from Atlas, Promate, Nataraj, Faber-Castell.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#FFD84D]/60 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#FFD84D]/30 flex items-center justify-center shrink-0 text-[#926002]">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#292525]">Free Shipping Available</h4>
              <p className="text-[11px] text-[#292525]/70 mt-0.5">
                Enjoy free standard shipping on qualifying orders over Rs. 5,000.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-white border border-[#EBD5FA]/60 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-[#EBD5FA]/40 flex items-center justify-center shrink-0 text-[#6b21a8]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#292525]">Hassle-Free Returns</h4>
              <p className="text-[11px] text-[#292525]/70 mt-0.5">
                Simple 7-day return policy for unopened stationery items.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 py-6 border-b border-[#C6E7FF]/40">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Logo variant="dark" />
            <p className="text-xs text-[#292525]/75 leading-relaxed max-w-sm font-medium">
              <strong>DSL Enterprises (Pvt) Ltd</strong> (dsl.lk), established in 2009 and headquartered in Moratuwa, 
              is a leading distributor of stationery and educational supplies in Sri Lanka. 
              Proud official partner for Doms, Linc, Luxor, Speed, Camlin, Fine, HP, Wetex, and Lido.
            </p>
            <div className="flex flex-col gap-2 pt-1 text-xs text-[#292525]/80">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0066CC] shrink-0" />
                <span>DSL Enterprises (Pvt) Ltd, Moratuwa, Sri Lanka</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#0066CC] shrink-0" />
                <span>+94 11 200 9000</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#0066CC] shrink-0" />
                <span>info@dsl.lk</span>
              </div>
            </div>
          </div>

          {/* Shop Categories */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-[#0066CC] uppercase tracking-wider">
              Shop Categories
            </h5>
            <ul className="space-y-2 text-xs text-[#292525]/80 font-medium">
              <li><Link href="/shop" className="hover:text-[#0066CC] transition-colors">All Products</Link></li>
              <li><Link href="/categories/exercise-books" className="hover:text-[#0066CC] transition-colors">CR Books &amp; Notebooks</Link></li>
              <li><Link href="/categories/pens-and-writing" className="hover:text-[#0066CC] transition-colors">Pens &amp; Writing</Link></li>
              <li><Link href="/categories/art-and-drawing" className="hover:text-[#0066CC] transition-colors">Art &amp; Drawing</Link></li>
              <li><Link href="/school-packs" className="hover:text-[#0066CC] transition-colors">School Stationery Packs</Link></li>
              <li><Link href="/offers" className="hover:text-[#0066CC] transition-colors">Special Offers 🌸</Link></li>
            </ul>
          </div>

          {/* Smart Features */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-[#0066CC] uppercase tracking-wider">
              Smart Shopping
            </h5>
            <ul className="space-y-2 text-xs text-[#292525]/80 font-medium">
              <li><Link href="/find-my-stationery" className="hover:text-[#0066CC] transition-colors">Find My Stationery Quiz</Link></li>
              <li><Link href="/upload-list" className="hover:text-[#0066CC] transition-colors">Upload Your Booklist</Link></li>
              <li><Link href="/account/wishlist" className="hover:text-[#0066CC] transition-colors">My Wishlist</Link></li>
              <li><Link href="/cart" className="hover:text-[#0066CC] transition-colors">Shopping Cart</Link></li>
              <li><Link href="/admin/dashboard" className="text-[#0066CC] font-bold hover:underline">Admin Portal →</Link></li>
            </ul>
          </div>

          {/* Customer Service & Policies */}
          <div className="space-y-3">
            <h5 className="text-xs font-bold text-[#0066CC] uppercase tracking-wider">
              Help &amp; Policies
            </h5>
            <ul className="space-y-2 text-xs text-[#292525]/80 font-medium">
              <li><Link href="/about" className="hover:text-[#0066CC] transition-colors">About DSL Stationery</Link></li>
              <li><Link href="/contact" className="hover:text-[#0066CC] transition-colors">Contact Us</Link></li>
              <li><Link href="/faq" className="hover:text-[#0066CC] transition-colors">FAQ</Link></li>
              <li><Link href="/delivery" className="hover:text-[#0066CC] transition-colors">Delivery Information</Link></li>
              <li><Link href="/returns" className="hover:text-[#0066CC] transition-colors">Returns &amp; Refunds</Link></li>
              <li><Link href="/privacy" className="hover:text-[#0066CC] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-[#0066CC] transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-xs text-[#292525]/60 gap-4">
          <p className="flex items-center gap-1">
            <span>© 2026 DSL Enterprises (Pvt) Ltd. Handcrafted with</span>
            <Heart className="w-3.5 h-3.5 fill-[#0066CC] text-[#0066CC] inline" />
            <span>for stationery lovers.</span>
          </p>
          <div className="flex items-center gap-2">
            <span className="bg-white border border-[#C6E7FF] px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#292525]">
              Prices in Sri Lankan Rupees (LKR)
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

