import { z } from 'zod';

export const subscribeNewsletterSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address format')
    .max(255, 'Email is too long'),
  consent: z
    .boolean()
    .refine((val) => val === true, {
      message: 'Affirmative consent is required to subscribe to the newsletter',
    }),
  source: z.string().trim().max(100).optional().default('WEBSITE_FOOTER'),
  consentTextVersion: z.string().trim().max(20).optional().default('v1.0'),
});

export type SubscribeNewsletterDto = z.infer<typeof subscribeNewsletterSchema>;

export const verifyNewsletterSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});

export type VerifyNewsletterDto = z.infer<typeof verifyNewsletterSchema>;

export const resendVerificationSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address format'),
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;

export const unsubscribeSchema = z.object({
  token: z.string().trim().min(1, 'Unsubscribe token is required'),
});

export type UnsubscribeDto = z.infer<typeof unsubscribeSchema>;

export const querySubscribersSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['ALL', 'PENDING', 'VERIFIED', 'UNSUBSCRIBED']).optional().default('ALL'),
  search: z.string().trim().optional(),
  sortBy: z.enum(['createdAt', 'consentGivenAt', 'verifiedAt', 'email']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type QuerySubscribersDto = z.infer<typeof querySubscribersSchema>;

