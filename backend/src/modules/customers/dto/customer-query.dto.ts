import { z } from 'zod';

export const customerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(25),
  search: z.string().optional(),
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  hasOrders: z.enum(['all', 'with_orders', 'no_orders']).default('all'),
  district: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'email', 'orderCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CustomerQueryDto = z.infer<typeof customerQuerySchema>;

export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().max(500).optional(),
});

export type UpdateCustomerStatusDto = z.infer<typeof updateCustomerStatusSchema>;

