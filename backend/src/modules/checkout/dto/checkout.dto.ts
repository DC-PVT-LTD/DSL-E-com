import { z } from 'zod';

export const deliveryAddressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  phone: z
    .string()
    .trim()
    .transform((val) => val.replace(/\s+/g, ''))
    .refine((val) => /^(\+94|0)?[0-9]{9,10}$/.test(val), {
      message: 'Valid Sri Lankan phone number is required (e.g. +94771234567 or 0771234567)',
    }),
  email: z.string().trim().email('Valid email address is required'),
  addressLine1: z.string().trim().min(3, 'Address line 1 must be at least 3 characters').max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2, 'City is required').max(100),
  district: z.string().trim().min(2, 'District is required').max(100),
  postalCode: z.string().trim().max(10).optional().nullable(),
  province: z.string().trim().max(100).optional().nullable(),
  buildingNo: z.string().trim().max(50).optional().nullable(),
  street: z.string().trim().max(100).optional().nullable(),
  landmark: z.string().trim().max(100).optional().nullable(),
  formattedAddress: z.string().trim().max(300).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  deliveryNotes: z.string().trim().max(500).optional().nullable(),
});

export type DeliveryAddressDto = z.infer<typeof deliveryAddressSchema>;

export const createReservationItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().min(1, 'Quantity must be at least 1').max(999),
  packId: z.string().optional().nullable(),
});

export const createReservationSchema = z.object({
  items: z.array(createReservationItemSchema).min(1, 'At least one item is required'),
  sessionId: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

export type CreateReservationDto = z.infer<typeof createReservationSchema>;

export const packSelectionItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  packId: z.string().min(1, 'Pack ID is required'),
});

export type PackSelectionItemDto = z.infer<typeof packSelectionItemSchema>;

export const validatePaySchema = z.object({
  reservationId: z.string().min(1, 'Reservation ID is required'),
  sessionId: z.string().optional().nullable(),
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER', 'CARD_PAYHERE']),
  voucherCode: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
  packSelections: z.array(packSelectionItemSchema).optional().nullable(),
});

export type ValidatePayDto = z.infer<typeof validatePaySchema>;

export const processPaymentSchema = z.object({
  reservationId: z.string().min(1, 'Reservation ID is required'),
  sessionId: z.string().optional().nullable(),
  deliveryAddress: deliveryAddressSchema,
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'BANK_TRANSFER', 'CARD_PAYHERE']),
  voucherCode: z.string().optional().nullable(),
  idempotencyKey: z.string().min(1, 'Idempotency key is required'),
  paymentData: z.record(z.any()).optional().nullable(),
  packSelections: z.array(packSelectionItemSchema).optional().nullable(),
});

export type ProcessPaymentDto = z.infer<typeof processPaymentSchema>;

export const payHereWebhookSchema = z.object({
  merchant_id: z.coerce.string(),
  order_id: z.coerce.string(),
  payment_id: z.coerce.string(),
  payhere_amount: z.coerce.string(),
  payhere_currency: z.coerce.string(),
  status_code: z.coerce.string(),
  md5sig: z.string(),
  custom_1: z.string().optional().nullable(), // reservationId
  custom_2: z.string().optional().nullable(), // idempotencyKey
  status_message: z.string().optional().nullable(),
  method: z.string().optional().nullable(),
  card_holder_name: z.string().optional().nullable(),
  card_no: z.string().optional().nullable(),
  card_expiry: z.string().optional().nullable(),
});

export type PayHereWebhookDto = z.infer<typeof payHereWebhookSchema>;
