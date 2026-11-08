import { z } from 'zod';

export const promotionTypeEnum = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_DELIVERY',
  'PRODUCT_SPECIFIC',
  'CATEGORY_SPECIFIC',
  'ORDER_LEVEL',
]);

export const promotionStatusEnum = z.enum([
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'EXPIRED',
  'DISABLED',
]);

export const discountTypeEnum = z.enum([
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_DELIVERY',
]);

export const promoCodeSchema = z.object({
  code: z
    .string()
    .min(2, 'Code must be at least 2 characters')
    .max(50, 'Code must be at most 50 characters')
    .regex(/^[A-Za-z0-9_-]+$/, 'Promo code must contain only letters, numbers, hyphens, and underscores'),
  maximumTotalUsage: z.number().int().positive().optional().nullable(),
  maximumUsagePerCustomer: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const createPromotionSchema = z
  .object({
    name: z.string().min(2, 'Promotion name must be at least 2 characters').max(150),
    description: z.string().max(1000).optional().nullable(),
    promotionType: promotionTypeEnum,
    discountType: discountTypeEnum.optional(),
    discountValue: z.number().min(0, 'Discount value must be non-negative'),
    maximumDiscountAmount: z.number().int().positive().optional().nullable(),
    minimumOrderAmount: z.number().int().nonnegative().optional().nullable(),
    status: promotionStatusEnum.optional().default('ACTIVE'),
    startDate: z.string().datetime({ message: 'Start date must be a valid ISO datetime' }),
    endDate: z.string().datetime({ message: 'End date must be a valid ISO datetime' }),
    priority: z.number().int().min(0).optional().default(0),
    isStackableWithSchoolPacks: z.boolean().optional().default(false),
    isActive: z.boolean().optional().default(true),
    promoCodes: z.array(promoCodeSchema).optional(),
    code: z.string().optional().nullable(), // single code convenience
    eligibleProductIds: z.array(z.string()).optional(),
    eligibleCategoryIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => new Date(data.startDate) < new Date(data.endDate),
    { message: 'Start date must be strictly before end date', path: ['endDate'] }
  )
  .refine(
    (data) => {
      if (
        (data.promotionType === 'PERCENTAGE' || data.discountType === 'PERCENTAGE') &&
        data.promotionType !== 'FREE_DELIVERY'
      ) {
        return data.discountValue > 0 && data.discountValue <= 100;
      }
      return true;
    },
    { message: 'Percentage discount must be between 1 and 100', path: ['discountValue'] }
  );

export type CreatePromotionDto = z.infer<typeof createPromotionSchema>;

export const updatePromotionSchema = z
  .object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().max(1000).optional().nullable(),
    promotionType: promotionTypeEnum.optional(),
    discountType: discountTypeEnum.optional(),
    discountValue: z.number().min(0).optional(),
    maximumDiscountAmount: z.number().int().positive().optional().nullable(),
    minimumOrderAmount: z.number().int().nonnegative().optional().nullable(),
    status: promotionStatusEnum.optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    priority: z.number().int().min(0).optional(),
    isStackableWithSchoolPacks: z.boolean().optional(),
    isActive: z.boolean().optional(),
    eligibleProductIds: z.array(z.string()).optional(),
    eligibleCategoryIds: z.array(z.string()).optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    { message: 'Start date must be strictly before end date', path: ['endDate'] }
  );

export type UpdatePromotionDto = z.infer<typeof updatePromotionSchema>;

export const createPromoCodeSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Za-z0-9_-]+$/, 'Promo code must contain only letters, numbers, hyphens, and underscores')
    .optional(),
  maximumTotalUsage: z.number().int().positive().optional().nullable(),
  maximumUsagePerCustomer: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export type CreatePromoCodeDto = z.infer<typeof createPromoCodeSchema>;

export const validatePromoCodeSchema = z.object({
  code: z.string().min(1, 'Promo code is required').trim(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      variantId: z.string().nullable().optional(),
      quantity: z.number().int().positive(),
    })
  ).min(1, 'Cart items are required for promotion calculation'),
  packSelections: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().nullable().optional(),
        packId: z.string().min(1),
      })
    )
    .nullable()
    .optional(),
  reservationId: z.string().nullable().optional(),
});

export type ValidatePromoCodeDto = z.infer<typeof validatePromoCodeSchema>;

export const queryPromotionsSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  status: promotionStatusEnum.optional(),
  promotionType: promotionTypeEnum.optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'priority', 'name']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type QueryPromotionsDto = z.infer<typeof queryPromotionsSchema>;

