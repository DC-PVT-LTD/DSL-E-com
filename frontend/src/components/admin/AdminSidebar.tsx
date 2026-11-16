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
  ShieldCheck,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  Tag,
  Image,
  Mail,
  BarChart3,
  Settings,
  History,
  Store,
  LogOut,
  KeyRound,
  Scale,
  CreditCard,
  FileCheck,
  X,
} from 'lucide-react';
import { useUserStore } from '@/services/userStore';

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const logoutAdmin = useUserStore((state) => state.logoutAdmin);
  const currentUser = useUserStore((state) => state.currentUser);
  const roleSlug = useUserStore((state) => state.roleSlug);
  const hasPermission = useUserStore((state) => state.hasPermission);

  const handleLogout = async () => {
    if (onCloseMobile) onCloseMobile();
    await logoutAdmin();
    router.push('/admin/login');
  };

  const isSuperAdmin = roleSlug === 'super_admin' || currentUser?.roleSlug === 'super_admin';

  const navGroups = [
    {
      title: 'Core Store Management',
      items: [
        { href: '/admin/super-admin', label: 'Super Admin Center', icon: ShieldAlert, superAdminOnly: true, permission: 'admins.view' },
        { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
        { href: '/admin/products', label: 'Products Catalogue', icon: Package, permission: 'products.view' },
        { href: '/admin/categories', label: 'Categories', icon: Layers, permission: 'categories.view' },
        { href: '/admin/brands', label: 'Brands', icon: Award, permission: 'brands.view' },
        { href: '/admin/inventory', label: 'Inventory & Stock', icon: Boxes, permission: 'inventory.view' },
        { href: '/admin/orders', label: 'Customer Orders', icon: ShoppingCart, permission: 'orders.view' },
        { href: '/admin/payments', label: 'Payments Dashboard', icon: CreditCard, permission: 'orders.view' },
        { href: '/admin/payments/bank-transfers', label: 'Bank Transfers Queue', icon: FileCheck, permission: 'orders.view' },
        { href: '/admin/reconciliation', label: 'Financial Reconciliation', icon: Scale, permission: 'orders.view' },
        { href: '/admin/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
        { href: '/admin/admins', label: 'Admin Accounts', icon: ShieldCheck, permission: 'admins.view' },
        { href: '/admin/roles', label: 'Roles & Permissions', icon: KeyRound, permission: 'roles.view' },
      ],
    },
    {
      title: 'Smart Features & Bundles',
      items: [
        { href: '/admin/school-packs', label: 'School Packs', icon: GraduationCap, permission: 'school_packs.view' },
        { href: '/admin/find-my-stationery', label: 'Find My Stationery', icon: Sparkles, permission: 'recommendations.view' },
      ],
    },
    {
      title: 'Marketing & Configuration',
      items: [
        { href: '/admin/promotions', label: 'Promotions & Vouchers', icon: Tag, permission: 'promotions.view' },
        { href: '/admin/banners', label: 'Banners & Blue Line Ads', icon: Image, permission: 'banners.view' },
        { href: '/admin/newsletter', label: 'Newsletter & Consent', icon: Mail, permission: 'newsletter.view' },
        { href: '/admin/reports', label: 'Sales Reports', icon: BarChart3, permission: 'reports.view' },
        { href: '/admin/audit-logs', label: 'Audit Logs', icon: History, permission: 'audit_logs.view' },
        { href: '/admin/settings', label: 'Store Settings', icon: Settings, permission: 'settings.view' },
      ],
    },
  ];

  // Filter groups by dynamic permissions
  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if ((item as any).superAdminOnly) return isSuperAdmin;
        return hasPermission(item.permission);
      }),
    }))
    .filter((group) => group.items.length > 0);

  const displayRole = currentUser?.roleName || (roleSlug === 'super_admin' ? 'Super Admin' : currentUser?.role || 'Admin');

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Brand header with illuminated white logo card & high-contrast name tag */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between mb-3 lg:hidden">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Navigation</span>
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <Link href="/admin/dashboard" onClick={onCloseMobile} className="block group">
            <div className="bg-white rounded-2xl p-3 shadow-md border border-slate-100 flex flex-col items-center justify-center transition-all group-hover:shadow-lg">
              <img
                src="/images/dsl-logo-header.png"
                alt="DSL Enterprises (Pvt) Ltd"
                className="h-10 w-auto object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <span className="text-[9px] font-black uppercase tracking-[0.24em] text-[#0066CC] mt-1 text-center">
                Stationery Distributors
              </span>
            </div>
          </Link>

          {/* High-visibility Admin Console & Role Badge tag */}
          <div className="mt-3 flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 shadow-xs">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="font-bold text-slate-100 text-[11px] tracking-wide">
                Admin Console
              </span>
            </div>
            <span
              className="font-extrabold text-[10px] uppercase px-2 py-0.5 rounded-md bg-[#FFD84D] text-[#3A2A00] tracking-wider shrink-0 shadow-xs ml-2"
              title={displayRole}
            >
              {displayRole}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="p-4 space-y-6">
          {filteredGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-sky-300/80 uppercase tracking-wider block mb-1.5">
                {group.title}
              </span>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === '/admin/payments'
                    ? pathname === '/admin/payments'
                    : pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${isActive
                      ? 'bg-[#0066CC] text-white shadow-sm font-extrabold ring-1 ring-sky-400/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer with Store Switcher & Logout */}
      <div className="p-4 border-t border-slate-800/80 space-y-2 bg-[#08101E]">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-slate-300 hover:text-white rounded-xl hover:bg-slate-800/60 transition"
        >
          <Store className="w-4 h-4 text-sky-400" />
          <span>View Public Store</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-bold text-rose-300 hover:text-rose-200 rounded-xl hover:bg-rose-500/10 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 text-rose-400" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0B1528] text-white flex-col shrink-0 h-screen sticky top-0 overflow-y-auto border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0B1528] text-white flex flex-col h-full shadow-2xl z-10 overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
