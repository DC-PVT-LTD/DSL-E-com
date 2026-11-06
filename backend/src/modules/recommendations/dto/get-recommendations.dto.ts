import { z } from 'zod';

export const getRecommendationsSchema = z.object({
  purpose: z.enum(['school', 'university', 'office', 'art_craft', 'gift']),
  grade: z.string().optional(),
  subjects: z.array(z.string()).optional(),
  studyArea: z.string().optional(),
  officeScale: z.string().optional(),
  categories: z.array(z.string()).optional(),
  activityType: z.string().optional(),
  skillLevel: z.string().optional(),
  occasion: z.string().optional(),
  budgetLkr: z.number().positive().optional(),
});

export type GetRecommendationsDto = z.infer<typeof getRecommendationsSchema>;

