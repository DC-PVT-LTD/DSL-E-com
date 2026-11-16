'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  ArrowRight,
  MapPin,
  Mail,
  Phone,
  UserCheck,
  UserX,
  ShoppingBag,
  Calendar,
  Download,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Eye,
  Check,
  X,
  Filter,
  DollarSign,
  User,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Lock,
} from 'lucide-react';
import { customerService } from '@/services/customerService';
import { CustomerListItem, CustomerAnalytics, CustomerQueryFilters } from '@/types/customer';
import { formatLKR } from '@/lib/currency';
import { useUserStore } from '@/services/userStore';
import {
  CatalogKpiCards,
  KpiCardData,
  CatalogFilterToolbar,
  ActiveFilterChip,
  ColumnVisibilityDropdown,
  ColumnDefinition,
  CatalogPagination,
  CatalogExportModal,
} from '@/components/admin/catalog';
import { AdminPageAccess } from '@/components/admin/AdminPageAccess';

const DEFAULT_COLUMNS: ColumnDefinition[] = [
  { id: 'name', label: 'Customer Name', visible: true, locked: true },
  { id: 'customerType', label: 'Customer Type', visible: true, locked: true },
  { id: 'email', label: 'Email Address', visible: true },
  { id: 'phone', label: 'Telephone', visible: true },
  { id: 'primaryDistrict', label: 'Primary District', visible: true },
  { id: 'status', label: 'Account Status', visible: true },
  { id: 'isEmailVerified', label: 'Email Verified', visible: false },
  { id: 'orderCount', label: 'Orders Placed', visible: true },
  { id: 'totalSpend', label: 'Total Spent (LKR)', visible: true, locked: true },
  { id: 'firstPurchaseDate', label: 'First Purchase', visible: false },
  { id: 'lastPurchaseDate', label: 'Last Purchase', visible: true },
  { id: 'createdAt', label: 'Registration Date', visible: true },
  { id: 'actions', label: 'Actions', visible: true, locked: true },
];

export default function AdminCustomersPage() {
  const hasPermission = useUserStore((state) => state.hasPermission);
  const currentUser = useUserStore((state) => state.currentUser);
  const isManagerOrAdmin =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';

  // Data state
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs: 'all' | 'registered' | 'guest'
  const [activeTab, setActiveTab] = useState<'all' | 'registered' | 'guest'>('all');

  // Filters & Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [ordersFilter, setOrdersFilter] = useState<'all' | 'with_orders' | 'no_orders'>('all');
  const [districtFilter, setDistrictFilter] = useState('');
  const [minSpend, setMinSpend] = useState<string>('');
  const [maxSpend, setMaxSpend] = useState<string>('');
  const [minOrders, setMinOrders] = useState<string>('');
  const [maxOrders, setMaxOrders] = useState<string>('');
  const [firstPurchaseDate, setFirstPurchaseDate] = useState<string>('');
  const [lastPurchaseDate, setLastPurchaseDate] = useState<string>('');

  // Advanced filters expansion
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Sorting state
  const [sortBy, setSortBy] = useState<
    'createdAt' | 'name' | 'email' | 'orderCount' | 'totalSpendCents' | 'lastPurchaseDate'
  >('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection & Export state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Column visibility state (persisted under 'dsl_admin_customer_columns_v1')
  const [columns, setColumns] = useState<ColumnDefinition[]>(DEFAULT_COLUMNS);

  const isColVisible = (colId: string) => {
    return columns.find((c) => c.id === colId)?.visible ?? true;
  };

  // Status toggle modal state
  const [statusModalCustomer, setStatusModalCustomer] = useState<CustomerListItem | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await customerService.fetchCustomerAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.warn('Failed to load customer analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Load customers
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters: CustomerQueryFilters = {
        page,
        limit,
        search: search.trim() || undefined,
        customerType: activeTab,
        status: statusFilter,
        hasOrders: ordersFilter,
        district: districtFilter.trim() || undefined,
        minSpendCents: minSpend ? Math.round(parseFloat(minSpend) * 100) : undefined,
        maxSpendCents: maxSpend ? Math.round(parseFloat(maxSpend) * 100) : undefined,
        minOrderCount: minOrders ? parseInt(minOrders, 10) : undefined,
        maxOrderCount: maxOrders ? parseInt(maxOrders, 10) : undefined,
        firstPurchaseDate: firstPurchaseDate || undefined,
        lastPurchaseDate: lastPurchaseDate || undefined,
        sortBy,
        sortOrder,
      };

      const result = await customerService.fetchCustomers(filters);
      setCustomers(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      console.error('Failed to load customers:', err);
      setError(err?.message || 'Failed to load customer directory.');
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    activeTab,
    statusFilter,
    ordersFilter,
    districtFilter,
    minSpend,
    maxSpend,
    minOrders,
    maxOrders,
    firstPurchaseDate,
    lastPurchaseDate,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleClearAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setOrdersFilter('all');
    setDistrictFilter('');
    setMinSpend('');
    setMaxSpend('');
    setMinOrders('');
    setMaxOrders('');
    setFirstPurchaseDate('');
    setLastPurchaseDate('');
    setPage(1);
  };

  // Active filter chips
  const activeChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    if (activeTab !== 'all') {
      chips.push({
        id: 'customerType',
        label: 'Type',
        value: activeTab === 'registered' ? 'Registered' : 'Guest',
        onRemove: () => setActiveTab('all'),
      });
    }
    if (statusFilter !== 'all') {
      chips.push({
        id: 'status',
        label: 'Account Status',
        value: statusFilter === 'active' ? 'Active' : 'Suspended',
        onRemove: () => setStatusFilter('all'),
      });
    }
    if (ordersFilter !== 'all') {
      chips.push({
        id: 'orders',
        label: 'Order Activity',
        value: ordersFilter === 'with_orders' ? 'With Orders' : 'No Orders',
        onRemove: () => setOrdersFilter('all'),
      });
    }
    if (districtFilter.trim()) {
      chips.push({
        id: 'district',
        label: 'District',
        value: districtFilter,
        onRemove: () => setDistrictFilter(''),
      });
    }
    if (minSpend || maxSpend) {
      chips.push({
        id: 'spend',
        label: 'Spend Range',
        value: `LKR ${minSpend || '0'} - ${maxSpend || '∞'}`,
        onRemove: () => {
          setMinSpend('');
          setMaxSpend('');
        },
      });
    }
    if (minOrders || maxOrders) {
      chips.push({
        id: 'orderCounts',
        label: 'Order Count',
        value: `${minOrders || '0'} - ${maxOrders || '∞'}`,
        onRemove: () => {
          setMinOrders('');
          setMaxOrders('');
        },
      });
    }
    if (firstPurchaseDate) {
      chips.push({
        id: 'firstPurchase',
        label: 'First Purchase After',
        value: firstPurchaseDate,
        onRemove: () => setFirstPurchaseDate(''),
      });
    }
    if (lastPurchaseDate) {
      chips.push({
        id: 'lastPurchase',
        label: 'Last Purchase Before',
        value: lastPurchaseDate,
        onRemove: () => setLastPurchaseDate(''),
      });
    }
    return chips;
  }, [
    activeTab,
    statusFilter,
    ordersFilter,
    districtFilter,
    minSpend,
    maxSpend,
    minOrders,
    maxOrders,
    firstPurchaseDate,
    lastPurchaseDate,
  ]);

  // KPI Cards
  const kpiCards: KpiCardData[] = useMemo(() => {
    return [
      {
        id: 'total',
        label: 'Total Customers',
        value: analytics?.totalCustomers ?? '—',
        icon: <Users className="w-4 h-4" />,
        color: 'blue',
        active: activeTab === 'all' && statusFilter === 'all' && ordersFilter === 'all',
        onClick: () => {
          setActiveTab('all');
          handleClearAllFilters();
        },
      },
      {
        id: 'registered',
        label: 'Registered Customers',
        value: analytics?.registeredCustomers ?? '—',
        icon: <UserCheck className="w-4 h-4" />,
        color: 'emerald',
        active: activeTab === 'registered',
        onClick: () => {
          setActiveTab('registered');
          setPage(1);
        },
      },
      {
        id: 'guest',
        label: 'Guest Customers',
        value: analytics?.guestBuyers ?? '—',
        icon: <ShoppingBag className="w-4 h-4" />,
        color: 'purple' as any,
        active: activeTab === 'guest',
        onClick: () => {
          setActiveTab('guest');
          setPage(1);
        },
      },
      {
        id: 'orders',
        label: 'Customers with Orders',
        value: analytics?.customersWithOrders ?? '—',
        icon: <DollarSign className="w-4 h-4" />,
        color: 'amber',
        active: ordersFilter === 'with_orders',
        onClick: () => {
          setOrdersFilter('with_orders');
          setPage(1);
        },
      },
    ];
  }, [analytics, activeTab, statusFilter, ordersFilter]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(customers.map((c) => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Status toggle submission (restricted to registered customers)
  const handleConfirmStatusToggle = async () => {
    if (!statusModalCustomer) return;
    if (statusModalCustomer.customerType === 'GUEST') {
      alert('Guest customers do not have account credentials and cannot be activated or suspended.');
      setStatusModalCustomer(null);
      return;
    }
    setIsSubmittingStatus(true);
    try {
      const targetStatus = !statusModalCustomer.isActive;
      await customerService.updateCustomerStatus(
        statusModalCustomer.id,
        targetStatus,
        statusReason.trim() || undefined
      );

      await Promise.all([loadCustomers(), loadAnalytics()]);
      setStatusModalCustomer(null);
      setStatusReason('');
    } catch (err: any) {
      alert(err?.message || 'Failed to update customer status');
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Export action
  const handleExport = async (format: 'csv' | 'xlsx', scope: 'all' | 'selected') => {
    if (!isManagerOrAdmin) {
      alert('Exporting customer data requires Manager or Admin privileges.');
      return;
    }
    const idsToExport = scope === 'selected' ? selectedIds : undefined;
    const filters: CustomerQueryFilters = {
      search: search.trim() || undefined,
      customerType: activeTab,
      status: statusFilter,
      hasOrders: ordersFilter,
      district: districtFilter.trim() || undefined,
      minSpendCents: minSpend ? Math.round(parseFloat(minSpend) * 100) : undefined,
      maxSpendCents: maxSpend ? Math.round(parseFloat(maxSpend) * 100) : undefined,
      minOrderCount: minOrders ? parseInt(minOrders, 10) : undefined,
      maxOrderCount: maxOrders ? parseInt(maxOrders, 10) : undefined,
      firstPurchaseDate: firstPurchaseDate || undefined,
      lastPurchaseDate: lastPurchaseDate || undefined,
    };
    const blob = await customerService.exportCustomers(format, filters, idsToExport);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dsl-customers-${activeTab}-${new Date().toISOString().slice(0, 10)}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <AdminPageAccess permission="customers.view" pageTitle="Customer Directory">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Customer Directory
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Registered customer accounts, verified guest buyers, contact details, and lifetime order histories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                loadCustomers();
                loadAnalytics();
              }}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Refresh Directory"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {isManagerOrAdmin ? (
              <button
                type="button"
                onClick={() => setIsExportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Customers</span>
              </button>
            ) : (
              <div
                title="Staff users have read-only access. Customer export requires Manager or Admin privileges."
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-400 cursor-not-allowed shadow-2xs"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Export (Restricted)</span>
              </div>
            )}
          </div>
        </div>

        {/* KPI Metric Cards */}
        <CatalogKpiCards cards={kpiCards} isLoading={analyticsLoading} />

        {/* Customer Type Tabs */}
        <div className="flex items-center border-b border-slate-200">
          <button
            type="button"
            onClick={() => {
              setActiveTab('all');
              setPage(1);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'all'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>All Customers</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
              {analytics?.totalCustomers ?? '—'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('registered');
              setPage(1);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'registered'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <User className="w-4 h-4" />
            <span>Registered Customers</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {analytics?.registeredCustomers ?? '—'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('guest');
              setPage(1);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${activeTab === 'guest'
                ? 'border-[#08275E] text-[#08275E] bg-blue-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Guest Customers</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              {analytics?.guestBuyers ?? '—'}
            </span>
          </button>
        </div>

        {/* Filter & Search Toolbar */}
        <CatalogFilterToolbar
          searchQuery={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search customer name, email, phone, or order number..."
          activeChips={activeChips}
          onClearAll={handleClearAllFilters}
          totalResults={total}
          rightAction={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${showAdvancedFilters ||
                    districtFilter ||
                    minSpend ||
                    maxSpend ||
                    minOrders ||
                    maxOrders ||
                    firstPurchaseDate ||
                    lastPurchaseDate
                    ? 'bg-blue-50 border-blue-200 text-[#08275E]'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Advanced Filters</span>
                {showAdvancedFilters ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              <ColumnVisibilityDropdown
                columns={columns}
                onChange={setColumns}
                storageKey="dsl_admin_customer_columns_v1"
              />
            </div>
          }
        >
          {/* Status Select (relevant for Registered or All) */}
          {activeTab !== 'guest' && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as any);
                setPage(1);
              }}
              aria-label="Filter customers by status"
              className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Accounts</option>
              <option value="inactive">Suspended Accounts</option>
            </select>
          )}

          {/* Order Activity Select */}
          <select
            value={ordersFilter}
            onChange={(e) => {
              setOrdersFilter(e.target.value as any);
              setPage(1);
            }}
            aria-label="Filter customers by order activity"
            className="px-2.5 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          >
            <option value="all">All Order Activities</option>
            <option value="with_orders">With Orders Placed</option>
            <option value="no_orders">No Orders Placed</option>
          </select>
        </CatalogFilterToolbar>

        {/* Advanced Collapsible Filter Panel */}
        {showAdvancedFilters && (
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#08275E]" />
                <span>Advanced Filter Criteria</span>
              </span>
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
              >
                Reset Filters
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  District / Region
                </label>
                <input
                  type="text"
                  value={districtFilter}
                  onChange={(e) => {
                    setDistrictFilter(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g. Colombo, Kandy..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Total Spend (LKR Range)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={minSpend}
                    onChange={(e) => {
                      setMinSpend(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Min"
                    className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    value={maxSpend}
                    onChange={(e) => {
                      setMaxSpend(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Max"
                    className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Orders Placed (Count)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={minOrders}
                    onChange={(e) => {
                      setMinOrders(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Min"
                    className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="number"
                    value={maxOrders}
                    onChange={(e) => {
                      setMaxOrders(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Max"
                    className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Purchase Dates
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={firstPurchaseDate}
                    onChange={(e) => {
                      setFirstPurchaseDate(e.target.value);
                      setPage(1);
                    }}
                    title="First purchase on or after"
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-slate-400 font-bold">-</span>
                  <input
                    type="date"
                    value={lastPurchaseDate}
                    onChange={(e) => {
                      setLastPurchaseDate(e.target.value);
                      setPage(1);
                    }}
                    title="Last purchase on or before"
                    className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Error loading customer accounts</p>
              <p>{error}</p>
            </div>
            <button
              onClick={() => loadCustomers()}
              className="text-rose-700 underline font-bold hover:text-rose-900 cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Customers Table */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 font-bold uppercase text-[10px]">
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all customers on current page"
                      checked={
                        customers.length > 0 && selectedIds.length === customers.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-[#08275E] focus:ring-[#08275E]"
                    />
                  </th>

                  {isColVisible('name') && (
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('name');
                            setSortOrder('asc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        Customer Name
                      </button>
                    </th>
                  )}

                  {isColVisible('customerType') && (
                    <th className="py-3.5 px-4">Customer Type</th>
                  )}

                  {isColVisible('email') && (
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'email') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('email');
                            setSortOrder('asc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        Email Address
                      </button>
                    </th>
                  )}

                  {isColVisible('phone') && (
                    <th className="py-3.5 px-4">Telephone</th>
                  )}

                  {isColVisible('primaryDistrict') && (
                    <th className="py-3.5 px-4">Primary District</th>
                  )}

                  {isColVisible('status') && (
                    <th className="py-3.5 px-4">Account Status</th>
                  )}

                  {isColVisible('isEmailVerified') && (
                    <th className="py-3.5 px-4 text-center">Email Verified</th>
                  )}

                  {isColVisible('orderCount') && (
                    <th className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'orderCount') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('orderCount');
                            setSortOrder('desc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold mx-auto cursor-pointer"
                      >
                        Orders Placed
                      </button>
                    </th>
                  )}

                  {isColVisible('totalSpend') && (
                    <th className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'totalSpendCents') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('totalSpendCents');
                            setSortOrder('desc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold ml-auto cursor-pointer"
                      >
                        Total Spent
                      </button>
                    </th>
                  )}

                  {isColVisible('firstPurchaseDate') && (
                    <th className="py-3.5 px-4">First Purchase</th>
                  )}

                  {isColVisible('lastPurchaseDate') && (
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'lastPurchaseDate') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('lastPurchaseDate');
                            setSortOrder('desc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        Last Purchase
                      </button>
                    </th>
                  )}

                  {isColVisible('createdAt') && (
                    <th className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortBy === 'createdAt') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy('createdAt');
                            setSortOrder('asc');
                          }
                        }}
                        className="hover:text-slate-900 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        Registration Date
                      </button>
                    </th>
                  )}

                  {isColVisible('actions') && (
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="w-4 h-4 bg-slate-200 rounded"></div>
                      </td>
                      {isColVisible('name') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-32 bg-slate-200 rounded mb-1"></div>
                          <div className="h-2.5 w-20 bg-slate-100 rounded"></div>
                        </td>
                      )}
                      {isColVisible('customerType') && (
                        <td className="py-4 px-4">
                          <div className="h-5 w-20 bg-slate-200 rounded-full"></div>
                        </td>
                      )}
                      {isColVisible('email') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-40 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('phone') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('primaryDistrict') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-20 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('status') && (
                        <td className="py-4 px-4">
                          <div className="h-5 w-16 bg-slate-200 rounded-full"></div>
                        </td>
                      )}
                      {isColVisible('isEmailVerified') && (
                        <td className="py-4 px-4 text-center">
                          <div className="h-4 w-12 bg-slate-200 rounded mx-auto"></div>
                        </td>
                      )}
                      {isColVisible('orderCount') && (
                        <td className="py-4 px-4 text-center">
                          <div className="h-4 w-12 bg-slate-200 rounded mx-auto"></div>
                        </td>
                      )}
                      {isColVisible('totalSpend') && (
                        <td className="py-4 px-4 text-right">
                          <div className="h-4 w-20 bg-slate-200 rounded ml-auto"></div>
                        </td>
                      )}
                      {isColVisible('firstPurchaseDate') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-20 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('lastPurchaseDate') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-20 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('createdAt') && (
                        <td className="py-4 px-4">
                          <div className="h-4 w-24 bg-slate-200 rounded"></div>
                        </td>
                      )}
                      {isColVisible('actions') && (
                        <td className="py-4 px-4 text-right">
                          <div className="h-7 w-20 bg-slate-200 rounded-xl ml-auto"></div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={columns.filter((c) => c.visible).length + 1}
                      className="py-16 text-center text-slate-400"
                    >
                      <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">No customers found</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {search ||
                          statusFilter !== 'all' ||
                          ordersFilter !== 'all' ||
                          activeTab !== 'all' ||
                          districtFilter
                          ? 'Try clearing active search or filters to view records.'
                          : 'No customer accounts or guest buyers recorded yet.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => {
                    const isSelected = selectedIds.includes(c.id);
                    const isGuest = c.customerType === 'GUEST';
                    const regDate = !isGuest && c.createdAt
                      ? new Date(c.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                      : '—';
                    const firstPurchaseFormatted = c.firstPurchaseDate
                      ? new Date(c.firstPurchaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                      : '—';
                    const lastPurchaseFormatted = c.lastPurchaseDate
                      ? new Date(c.lastPurchaseDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                      : '—';

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/40' : ''
                          }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            aria-label={`Select customer ${c.name}`}
                            checked={isSelected}
                            onChange={() => handleToggleRow(c.id)}
                            className="rounded border-slate-300 text-[#08275E] focus:ring-[#08275E]"
                          />
                        </td>

                        {isColVisible('name') && (
                          <td className="py-3 px-4">
                            <Link
                              href={`/admin/customers/${c.id}`}
                              className="font-bold text-slate-900 hover:text-[#08275E] hover:underline block"
                            >
                              {c.name}
                            </Link>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {isGuest ? 'Guest ID' : 'ID'}: {c.id.slice(0, 16)}...
                            </span>
                          </td>
                        )}

                        {isColVisible('customerType') && (
                          <td className="py-3 px-4">
                            {isGuest ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                <ShoppingBag className="w-3 h-3" />
                                <span>Guest</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#08275E] border border-blue-200">
                                <User className="w-3 h-3" />
                                <span>Registered</span>
                              </span>
                            )}
                          </td>
                        )}

                        {isColVisible('email') && (
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 text-slate-700">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.email || 'No email provided'}</span>
                            </div>
                            {!isGuest && c.isEmailVerified && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium mt-0.5">
                                <ShieldCheck className="w-3 h-3" />
                                <span>Verified</span>
                              </span>
                            )}
                          </td>
                        )}

                        {isColVisible('phone') && (
                          <td className="py-3 px-4 text-slate-600 font-mono">
                            {c.phone ? (
                              <div className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{c.phone}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic">No phone</span>
                            )}
                          </td>
                        )}

                        {isColVisible('primaryDistrict') && (
                          <td className="py-3 px-4 text-slate-600">
                            {c.primaryDistrict ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{c.primaryDistrict}</span>
                              </div>
                            ) : (
                              <span className="text-slate-300 italic">Not set</span>
                            )}
                          </td>
                        )}

                        {isColVisible('status') && (
                          <td className="py-3 px-4">
                            {isGuest ? (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            ) : (isManagerOrAdmin || (typeof hasPermission === 'function' && hasPermission('customers.manage'))) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setStatusModalCustomer(c);
                                  setStatusReason('');
                                }}
                                title="Click to change account status"
                                className="inline-flex items-center gap-1.5 cursor-pointer group"
                              >
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${c.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                >
                                  {c.isActive ? (
                                    <UserCheck className="w-3 h-3" />
                                  ) : (
                                    <UserX className="w-3 h-3" />
                                  )}
                                  <span>{c.isActive ? 'Active' : 'Suspended'}</span>
                                </span>
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${c.isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                              >
                                {c.isActive ? (
                                  <UserCheck className="w-3 h-3" />
                                ) : (
                                  <UserX className="w-3 h-3" />
                                )}
                                <span>{c.isActive ? 'Active' : 'Suspended'}</span>
                              </span>
                            )}
                          </td>
                        )}

                        {isColVisible('isEmailVerified') && (
                          <td className="py-3 px-4 text-center">
                            {isGuest ? (
                              <span className="text-slate-400 font-mono text-[11px]">—</span>
                            ) : c.isEmailVerified ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                Yes
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">
                                No
                              </span>
                            )}
                          </td>
                        )}

                        {isColVisible('orderCount') && (
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block font-bold text-xs px-2.5 py-0.5 rounded-full ${c.orderCount > 0
                                  ? 'bg-blue-50 text-[#08275E] font-black'
                                  : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                              {c.orderCount} {c.orderCount === 1 ? 'order' : 'orders'}
                            </span>
                          </td>
                        )}

                        {isColVisible('totalSpend') && (
                          <td className="py-3 px-4 text-right font-black text-slate-900">
                            {formatLKR(c.totalSpendCents)}
                          </td>
                        )}

                        {isColVisible('firstPurchaseDate') && (
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {firstPurchaseFormatted}
                          </td>
                        )}

                        {isColVisible('lastPurchaseDate') && (
                          <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                            {lastPurchaseFormatted}
                          </td>
                        )}

                        {isColVisible('createdAt') && (
                          <td className="py-3 px-4 text-slate-500">{regDate}</td>
                        )}

                        {isColVisible('actions') && (
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                href={`/admin/customers/${c.id}`}
                                className="bg-[#08275E] hover:bg-[#103b8c] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-colors inline-flex items-center gap-1 shadow-xs"
                              >
                                <span>View Profile</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination */}
          <CatalogPagination
            page={page}
            totalPages={totalPages}
            limit={limit}
            total={total}
            onPageChange={setPage}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            isLoading={loading}
          />
        </div>

        {/* Export Modal */}
        <CatalogExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          onExport={handleExport}
          totalFilteredCount={total}
          selectedCount={selectedIds.length}
          title={`Export ${activeTab === 'all' ? 'All Customers' : activeTab === 'registered' ? 'Registered Customers' : 'Guest Customers'} List`}
        />

        {/* Account Status Toggle Modal (Registered only) */}
        {statusModalCustomer && statusModalCustomer.customerType === 'REGISTERED' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">
                  {statusModalCustomer.isActive ? 'Suspend Customer Account' : 'Reactivate Customer Account'}
                </h3>
                <button
                  type="button"
                  onClick={() => setStatusModalCustomer(null)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                Are you sure you want to{' '}
                <strong className={statusModalCustomer.isActive ? 'text-rose-600' : 'text-emerald-600'}>
                  {statusModalCustomer.isActive ? 'SUSPEND' : 'REACTIVATE'}
                </strong>{' '}
                the customer account for <strong>{statusModalCustomer.name}</strong> ({statusModalCustomer.email})?
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Reason for change (Optional, recorded in audit log)
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Account suspended due to customer request or fraud verification..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#08275E]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStatusModalCustomer(null)}
                  disabled={isSubmittingStatus}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmStatusToggle}
                  disabled={isSubmittingStatus}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors flex items-center gap-1.5 cursor-pointer ${statusModalCustomer.isActive
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                >
                  {isSubmittingStatus ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Confirm {statusModalCustomer.isActive ? 'Suspension' : 'Reactivation'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminPageAccess>
  );
}
