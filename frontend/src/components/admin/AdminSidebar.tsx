'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  Award,
  Boxes,
  ShoppingCart,
  Users,
  GraduationCap,
  Upload,
  Tag,
  Image,
  BarChart3,
  Settings,
  History,
  Store,
  LogOut,
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { useUserStore } from '@/services/userStore';

export const AdminSidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const logoutAdmin = useUserStore((state) => state.logoutAdmin);

  const handleLogout = async () => {
    await logoutAdmin();
    router.push('/admin/login');
  };

  const navGroups = [
    {
      title: 'Core Store Management',
      items: [
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/products', label: 'Products Catalogue', icon: Package },
        { href: '/admin/categories', label: 'Categories', icon: Layers },
        { href: '/admin/brands', label: 'Brands', icon: Award },
        { href: '/admin/inventory', label: 'Inventory & Stock', icon: Boxes },
        { href: '/admin/orders', label: 'Customer Orders', icon: ShoppingCart },
        { href: '/admin/customers', label: 'Customers', icon: Users },
      ],
    },
    {
      title: 'Smart Features & Bundles',
      items: [
        { href: '/admin/school-packs', label: 'School Packs', icon: GraduationCap },
        { href: '/admin/upload-reviews', label: 'Upload Reviews Queue', icon: Upload },
      ],
    },
    {
      title: 'Marketing & Configuration',
      items: [
        { href: '/admin/promotions', label: 'Promotions & Vouchers', icon: Tag },
        { href: '/admin/banners', label: 'Store Banners', icon: Image },
        { href: '/admin/reports', label: 'Sales Reports', icon: BarChart3 },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: History },
        { href: '/admin/settings', label: 'Store Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#292525] text-white flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-y-auto border-r border-stone-800">
      <div>
        {/* Brand header */}
        <div className="p-6 border-b border-stone-800">
          <Logo variant="light" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-stone-300 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700/60">
            <span>Admin Console</span>
            <span className="font-bold text-[#FFD84D] uppercase font-mono">v1.0 Demo</span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="p-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-[#C6E7FF]/80 uppercase tracking-wider block mb-1.5">
                {group.title}
              </span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                        ? 'bg-[#0066CC] text-white shadow-sm font-extrabold'
                        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                      }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Switcher */}
      <div className="p-4 border-t border-stone-800 space-y-2">
        <Link
          href="/home"
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors"
        >
          <Store className="w-4 h-4 text-[#FFD84D]" />
          <span>View Customer Store</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-stone-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Exit Admin Session</span>
        </button>
      </div>
    </aside>
  );
};
