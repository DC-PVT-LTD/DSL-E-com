import { z } from 'zod';
import { OrderStatus, PaymentStatus } from '../../../generated/prisma';

export const adminOrdersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
  paymentStatus: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalCents', 'orderNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type AdminOrdersQueryDto = z.infer<typeof adminOrdersQuerySchema>;

export const adminUpdateStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  trackingNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  reason: z.string().optional(),
});

export type AdminUpdateStatusDto = z.infer<typeof adminUpdateStatusSchema>;

export const adminUpdateCustomerSchema = z.object({
  customerName: z.string().trim().min(1, 'Customer name is required'),
  customerEmail: z.string().trim().email('Invalid email address'),
  customerPhone: z.string().trim().min(3, 'Phone number is required'),
  reason: z.string().optional(),
});

export type AdminUpdateCustomerDto = z.infer<typeof adminUpdateCustomerSchema>;

export const adminUpdateDeliverySchema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required').optional(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().trim().min(1, 'City is required').optional(),
  district: z.string().trim().min(1, 'District is required').optional(),
  postalCode: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  deliveryNotes: z.string().optional().nullable(),
  reason: z.string().optional(),
});

export type AdminUpdateDeliveryDto = z.infer<typeof adminUpdateDeliverySchema>;

export const adminUpdateItemsSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      variantId: z.string().optional().nullable(),
      quantity: z.number().int().min(0, 'Quantity cannot be negative'),
    })
  ).min(1, 'At least one item specification required'),
  reason: z.string().optional(),
});

export type AdminUpdateItemsDto = z.infer<typeof adminUpdateItemsSchema>;

export const adminCancelOrderSchema = z.object({
  reason: z.string().trim().min(1, 'Cancellation reason is required'),
  restoreInventory: z.boolean().default(true),
  processRefund: z.boolean().default(false),
});

export type AdminCancelOrderDto = z.infer<typeof adminCancelOrderSchema>;

export const adminCreateReturnSchema = z.object({
  reason: z.string().trim().min(1, 'Return reason is required'),
  items: z.array(
    z.object({
      orderItemId: z.string().min(1, 'Order Item ID is required'),
      quantity: z.number().int().min(1, 'Quantity must be at least 1'),
      reason: z.string().trim().min(1, 'Item return reason is required'),
    })
  ).min(1, 'At least one item must be returned'),
});

export type AdminCreateReturnDto = z.infer<typeof adminCreateReturnSchema>;

export const adminProcessReturnSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CONFIRM_RECEIVED']),
  rejectionReason: z.string().optional(),
  restockItems: z.boolean().default(true),
});

export type AdminProcessReturnDto = z.infer<typeof adminProcessReturnSchema>;

export const adminProcessRefundSchema = z.object({
  amountCents: z.number().int().positive('Refund amount must be greater than zero'),
  method: z.string().trim().min(1, 'Refund method is required'),
  reference: z.string().optional(),
  reason: z.string().trim().min(1, 'Refund reason is required'),
});

export type AdminProcessRefundDto = z.infer<typeof adminProcessRefundSchema>;

export const adminAddNoteSchema = z.object({
  note: z.string().trim().min(1, 'Note content is required'),
  isInternal: z.boolean().default(true),
});

export type AdminAddNoteDto = z.infer<typeof adminAddNoteSchema>;

