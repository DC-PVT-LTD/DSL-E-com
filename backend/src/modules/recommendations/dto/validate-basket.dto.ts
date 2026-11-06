import { z } from 'zod';

export const basketItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  submittedPriceCents: z.number().int().nonnegative().optional(),
});

export const validateBasketSchema = z.object({
  items: z.array(basketItemSchema).min(1, 'At least one item is required in the basket'),
  budgetLkr: z.number().positive().optional(),
});

export type BasketItemDto = z.infer<typeof basketItemSchema>;
export type ValidateBasketDto = z.infer<typeof validateBasketSchema>;

