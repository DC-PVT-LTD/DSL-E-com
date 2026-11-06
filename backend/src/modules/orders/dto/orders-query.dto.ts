import { z } from 'zod';
import { OrderStatus } from '../../../generated/prisma';

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(OrderStatus).optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type OrdersQueryDto = z.infer<typeof ordersQuerySchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  trackingNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const requestTrackingOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export type RequestTrackingOtpDto = z.infer<typeof requestTrackingOtpSchema>;

export const verifyTrackingOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Verification code must be a 6-digit number'),
});

export type VerifyTrackingOtpDto = z.infer<typeof verifyTrackingOtpSchema>;

