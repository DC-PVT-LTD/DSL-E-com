export type CustomerType = 'REGISTERED' | 'GUEST';

export interface CustomerListItem {
  id: string;
  customerType: CustomerType;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  firstPurchaseDate: string | null;
  lastPurchaseDate: string | null;
  primaryDistrict: string | null;
  addressesCount: number;
  orderCount: number;
  paidOrderCount?: number;
  totalSpendCents: number;
  averageOrderValueCents?: number;
  lastOrderDate?: string | null;
  associatedOrderNumbers?: string[];
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
  customerType: CustomerType;
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
    firstOrderDate: string | null;
    lastOrderDate: string | null;
  };
  wishlistCount: number;
  savedListsCount: number;
}

export interface CustomerAnalytics {
  totalCustomers: number;
  registeredCustomers: number;
  guestBuyers: number;
  activeCustomers: number;
  inactiveCustomers: number;
  verifiedEmailCount: number;
  newCustomersLast30Days: number;
  customersWithOrders: number;
  customersWithoutOrders: number;
  totalCustomerRevenueCents: number;
  averageOrderValueCents?: number;
  byDistrict: Array<{ district: string; count: number }>;
}

export interface CustomerQueryFilters {
  page?: number;
  limit?: number;
  search?: string;
  q?: string;
  customerType?: 'all' | 'registered' | 'guest';
  status?: 'all' | 'active' | 'inactive';
  hasOrders?: 'all' | 'with_orders' | 'no_orders';
  district?: string;
  startDate?: string;
  endDate?: string;
  firstPurchaseDate?: string;
  lastPurchaseDate?: string;
  minOrderCount?: number;
  maxOrderCount?: number;
  minSpendCents?: number;
  maxSpendCents?: number;
  sortBy?:
    | 'createdAt'
    | 'name'
    | 'email'
    | 'orderCount'
    | 'totalSpendCents'
    | 'firstPurchaseDate'
    | 'lastPurchaseDate';
  sortOrder?: 'asc' | 'desc';
}
