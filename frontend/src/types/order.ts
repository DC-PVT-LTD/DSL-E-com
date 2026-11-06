import { CartItem } from './cart';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  // Backward compatibility with lowercase mock fixtures
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED'
  // Backward compatibility with mock fixtures
  | 'pending'
  | 'paid'
  | 'simulated_paid'
  | 'failed'
  | 'refunded';

export type PaymentMethod =
  | 'CASH_ON_DELIVERY'
  | 'BANK_TRANSFER'
  | 'CARD_PAYHERE'
  | 'KOKO_BNPL'
  // Backward compatibility aliases
  | 'cash_on_delivery'
  | 'bank_transfer_mock'
  | 'card_mock'
  | 'koko_pay_mock'
  | 'CARD_PAYHERE'
  | 'CASH_ON_DELIVERY'
  | 'BANK_TRANSFER';

export interface ShippingAddress {
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  district: string;
  postalCode?: string;
  province?: string;
  buildingNo?: string;
  street?: string;
  landmark?: string;
  formattedAddress?: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNotes?: string;
}

export interface OrderAddressSnapshot {
  id?: string;
  orderId?: string;
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  district: string;
  postalCode?: string | null;
  province?: string | null;
  buildingNo?: string | null;
  street?: string | null;
  landmark?: string | null;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNotes?: string | null;
  createdAt?: string;
}

export interface OrderItemSnapshot {
  id: string;
  orderId?: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  totalPriceCents: number;
  product?: {
    id?: string;
    name?: string;
    images?: string[];
    sku?: string;
  };
  variant?: {
    id?: string;
    name?: string;
    sku?: string;
  } | null;
  createdAt?: string;
}

export interface PaymentAttempt {
  id: string;
  status: string;
  paymentMethod: string;
  amountCents: number;
  currency: string;
  gatewayReference?: string | null;
  failureReason?: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: ShippingAddress;
  addressSnapshot?: OrderAddressSnapshot | null;
  items: (CartItem | OrderItemSnapshot | any)[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  notes?: string | null;
  customerNotes?: string | null;
  schoolPacksSnapshot?: any;
  trackingNumber?: string | null;
  estimatedDeliveryDate?: string | null;
  paymentAttempts?: PaymentAttempt[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderStats {
  total: number;
  pending: number;
  confirmed: number;
  processing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  totalRevenueCents?: number;
}

export interface OrderAuditEntry {
  id: string;
  orderId?: string;
  adminName: string;
  action: string;
  fieldChanged?: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  createdAt: string;
}

export interface OrderReturnItem {
  id: string;
  orderItemId: string;
  productName: string;
  quantity: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED';
  rejectionReason?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface OrderReturnRequest {
  id: string;
  orderId: string;
  returnNumber: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  reason: string;
  rejectionReason?: string;
  items: OrderReturnItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderAdminNote {
  id: string;
  orderId?: string;
  authorName: string;
  note: string;
  isInternal: boolean;
  createdAt: string;
}

export interface OrderQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  paymentStatus?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'totalCents' | 'orderNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface OrderListResult {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface BuyAgainItemResult {
  orderItemId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string;
  images: string[];
  requestedQuantity: number;
  availableQuantity: number;
  currentPriceCents: number;
  historicalPriceCents: number;
  priceChanged: boolean;
  status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
  reason:
    | 'AVAILABLE'
    | 'PRICE_CHANGED'
    | 'INSUFFICIENT_STOCK'
    | 'OUT_OF_STOCK'
    | 'DISCONTINUED'
    | 'PRODUCT_NOT_FOUND'
    | 'VARIANT_DISCONTINUED';
  bundleInfo?: {
    packId: string;
    packName: string;
    savingsPercentage: number;
  } | null;
  product?: any;
  variant?: any;
}

export interface BuyAgainResponse {
  success: boolean;
  orderId: string;
  orderNumber: string;
  items: BuyAgainItemResult[];
  summary: {
    totalRequestedItems: number;
    availableCount: number;
    partialCount: number;
    unavailableCount: number;
    totalAddedQuantity: number;
    estimatedTotalCents: number;
  };
}
