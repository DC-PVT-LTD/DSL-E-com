export interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  primaryDistrict: string | null;
  addressesCount: number;
  orderCount: number;
  totalSpendCents: number;
  lastOrderDate: string | null;
}

export interface CustomerAddress {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  district: string;
  postalCode: string | null;
  isDefault: boolean;
  createdAt: string;
}

export interface CustomerOrderSummaryItem {
  id: string;
  orderNumber: string;
  totalCents: number;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  itemsCount: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  addresses: CustomerAddress[];
  orders: CustomerOrderSummaryItem[];
  orderSummary: {
    totalOrders: number;
    totalSpendCents: number;
    averageOrderValueCents: number;
    lastOrderDate: string | null;
  };
  wishlistCount: number;
  savedListsCount: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  verifiedEmailCount: number;
  newCustomersLast30Days: number;
  customersWithOrders: number;
  customersWithoutOrders: number;
  totalCustomerRevenueCents: number;
  byDistrict: Array<{ district: string; count: number }>;
}

export interface CustomerQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  status?: 'all' | 'active' | 'inactive';
  hasOrders?: 'all' | 'with_orders' | 'no_orders';
  district?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'name' | 'email' | 'orderCount';
  sortOrder?: 'asc' | 'desc';
}

