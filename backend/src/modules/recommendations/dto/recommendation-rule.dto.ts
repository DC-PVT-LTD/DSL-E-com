import { z } from 'zod';

export const createRecommendationRuleSchema = z.object({
  purpose: z.enum(['school', 'university', 'office', 'art_craft', 'gift']),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  gradeLevels: z.array(z.string()).optional(),
  subjects: z.array(z.string()).optional(),
  studyAreas: z.array(z.string()).optional(),
  officeScale: z.string().optional(),
  activityTypes: z.array(z.string()).optional(),
  skillLevels: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  productId: z.string().min(1, 'Product ID is required'),
  categoryId: z.string().optional(),
  defaultQuantity: z.number().int().min(1).default(1),
  minQuantity: z.number().int().min(1).default(1),
  maxQuantity: z.number().int().min(1).default(50),
  priority: z.number().int().min(1).default(1),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
  isActive: z.boolean().default(true),
  substituteProductIds: z.array(z.string()).optional(),
});

export const updateRecommendationRuleSchema = createRecommendationRuleSchema.partial();

export type CreateRecommendationRuleDto = z.infer<typeof createRecommendationRuleSchema>;
export type UpdateRecommendationRuleDto = z.infer<typeof updateRecommendationRuleSchema>;

