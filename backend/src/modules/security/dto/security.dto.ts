import { z } from 'zod';

export const createChallengeSchema = z.object({
  action: z.string().min(1, 'Action description is required'),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateChallengeDto = z.infer<typeof createChallengeSchema>;

export const confirmChallengeSchema = z.object({
  challengeId: z.string().min(1, 'Challenge ID is required'),
  code: z.string().length(6, 'Verification code must be exactly 6 digits'),
});

export type ConfirmChallengeDto = z.infer<typeof confirmChallengeSchema>;

