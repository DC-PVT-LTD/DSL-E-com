'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { orderService } from '@/services/orderService';
import { orderSocketService } from '@/services/orderSocketService';
import { Order, OrderStats, OrderQueryParams } from '@/types/order';
import { OrderStatsCards } from '@/components/admin/orders/OrderStatsCards';
import { OrderFilterToolbar } from '@/components/admin/orders/OrderFilterToolbar';
import { OrderTable } from '@/components/admin/orders/OrderTable';

function AdminOrdersDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial query params from URL to ensure state preservation on page refreshes and navigations
  const initialPage = Number(searchParams.get('page')) || 1;
  const initialLimit = Number(searchParams.get('limit')) || 20;
  const initialStatus = searchParams.get('status') || 'all';
  const initialPaymentStatus = searchParams.get('paymentStatus') || 'all';
  const initialSearch = searchParams.get('search') || '';
  const initialStartDate = searchParams.get('startDate') || '';
  const initialEndDate = searchParams.get('endDate') || '';
  const initialSortBy = (searchParams.get('sortBy') as any) || 'createdAt';
  const initialSortOrder = (searchParams.get('sortOrder') as any) || 'desc';

  const [filters, setFilters] = useState<OrderQueryParams>({
    page: initialPage,
    limit: initialLimit,
    status: initialStatus,
    paymentStatus: initialPaymentStatus,
    search: initialSearch,
    startDate: initialStartDate,
    endDate: initialEndDate,
    sortBy: initialSortBy,
    sortOrder: initialSortOrder,
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sync state to URL search parameters for linkability and browser history preservation
  const syncUrlParams = useCallback(
    (newFilters: OrderQueryParams) => {
      const params = new URLSearchParams();
      if (newFilters.page && newFilters.page > 1) params.set('page', String(newFilters.page));
      if (newFilters.limit && newFilters.limit !== 20) params.set('limit', String(newFilters.limit));
      if (newFilters.status && newFilters.status !== 'all') params.set('status', newFilters.status);
      if (newFilters.paymentStatus && newFilters.paymentStatus !== 'all')
        params.set('paymentStatus', newFilters.paymentStatus);
      if (newFilters.search) params.set('search', newFilters.search);
      if (newFilters.startDate) params.set('startDate', newFilters.startDate);
      if (newFilters.endDate) params.set('endDate', newFilters.endDate);
      if (newFilters.sortBy && newFilters.sortBy !== 'createdAt') params.set('sortBy', newFilters.sortBy);
      if (newFilters.sortOrder && newFilters.sortOrder !== 'desc')
        params.set('sortOrder', newFilters.sortOrder);

      const query = params.toString();
      const target = query ? `${pathname}?${query}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router]
  );

  // Fetch orders from real backend API
  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orderService.fetchOrders(filters);
      setOrders(result.orders);
      setTotalOrders(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to communicate with orders backend API');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // Fetch stats from backend API
  const loadStats = useCallback(async () => {
    setIsStatsLoading(true);
    try {
      const resStats = await orderService.fetchOrderStats();
      setStats(resStats);
    } catch (err) {
      console.warn('Could not load order metrics:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    syncUrlParams(filters);
  }, [loadOrders, syncUrlParams, filters]);

  useEffect(() => {
    loadStats();
    // 1. Subscribe to local service events
    const unsubService = orderService.subscribe(() => {
      loadOrders();
      loadStats();
    });

    // 2. Subscribe to real-time WebSocket order events from backend
    const unsubSocket = orderSocketService.subscribeAdmin(() => {
      loadOrders();
      loadStats();
    });

    // 3. Refetch authoritative state upon socket reconnection
    const unsubReconnect = orderSocketService.onReconnect(() => {
      loadOrders();
      loadStats();
    });

    return () => {
      unsubService();
      unsubSocket();
      unsubReconnect();
    };
  }, [loadStats, loadOrders]);

  const handleFilterChange = (updates: Partial<OrderQueryParams>) => {
    setFilters((prev) => ({
      ...prev,
      ...updates,
      page: updates.page !== undefined ? updates.page : 1, // Reset to page 1 on filter modification unless explicit
    }));
  };

  const handleClearFilters = () => {
    const cleared: OrderQueryParams = {
      page: 1,
      limit: filters.limit || 20,
      status: 'all',
      paymentStatus: 'all',
      search: '',
      startDate: '',
      endDate: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    setFilters(cleared);
  };

  const handleStatCardSelect = (status: string) => {
    handleFilterChange({
      status: status === 'all' ? 'all' : status,
      page: 1,
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#08275E]/10 text-[#08275E]">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Order Fulfillment Management
            </h1>
          </div>
          <p className="text-xs text-slate-500">
            Real-time administrative control of customer orders, lifecycle transitions, delivery tracking, and returns.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              loadOrders();
              loadStats();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            title="Refresh order data from server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {/* Orders Dashboard Metrics */}
      <OrderStatsCards
        stats={stats}
        isLoading={isStatsLoading}
        activeFilter={filters.status}
        onSelectFilter={handleStatCardSelect}
      />

      {/* Search & Combined Filters Toolbar */}
      <OrderFilterToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        totalResults={totalOrders}
        isLoading={isLoading}
      />

      {/* Orders Management Table */}
      <OrderTable
        orders={orders}
        isLoading={isLoading}
        error={error}
        onRetry={loadOrders}
        page={filters.page || 1}
        limit={filters.limit || 20}
        totalPages={totalPages}
        totalOrders={totalOrders}
        onPageChange={(newPage) => handleFilterChange({ page: newPage })}
        onLimitChange={(newLimit) => handleFilterChange({ limit: newLimit, page: 1 })}
      />
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 animate-pulse">
          <div className="h-10 w-64 bg-slate-200 rounded-xl" />
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
            ))}
          </div>
          <div className="h-28 bg-slate-200 rounded-3xl" />
          <div className="h-96 bg-slate-200 rounded-3xl" />
        </div>
      }
    >
      <AdminOrdersDashboardContent />
    </Suspense>
  );
}
