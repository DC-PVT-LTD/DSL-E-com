import { z } from 'zod';
import { BankDepositStatus, PaymentMethod, PaymentStatus, OrderStatus } from '../../../generated/prisma';

export const bankTransferQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(), // order number, customer name, email, reference number
  status: z.nativeEnum(BankDepositStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmountCents: z.coerce.number().int().min(0).optional(),
  maxAmountCents: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['createdAt', 'depositDate', 'amountCents']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type BankTransferQueryDto = z.infer<typeof bankTransferQuerySchema>;

export const approveBankTransferSchema = z.object({
  adminNotes: z.string().trim().max(1000).optional(),
});

export type ApproveBankTransferDto = z.infer<typeof approveBankTransferSchema>;

export const REJECTION_REASONS = [
  'Fake receipt',
  'Incorrect amount',
  'Invalid transaction reference',
  'Deposit not found in bank statement',
  'Wrong receiving account',
  'Unverifiable receipt',
  'Other',
] as const;

export const rejectBankTransferSchema = z.object({
  category: z.enum(REJECTION_REASONS),
  explanation: z.string().trim().min(3, 'Detailed explanation is required').max(1000),
});

export type RejectBankTransferDto = z.infer<typeof rejectBankTransferSchema>;

// Payments Dashboard DTOs (Stage 3.4)
export const paymentsDashboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(), // order number, customer name, email, reference number
  paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  orderStatus: z.nativeEnum(OrderStatus).optional(),
  bankVerificationStatus: z.nativeEnum(BankDepositStatus).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  minAmountCents: z.coerce.number().int().min(0).optional(),
  maxAmountCents: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'totalCents']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaymentsDashboardQueryDto = z.infer<typeof paymentsDashboardQuerySchema>;
