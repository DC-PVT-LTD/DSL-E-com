import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BannerStatus } from '../../../generated/prisma';

export const safeUrlSchema = z.string().trim().refine((url) => {
  if (!url) return true;
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (url.startsWith('/')) {
    return true;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, {
  message: 'URL must be a valid relative path (e.g. /products/...) or HTTP/HTTPS URL and cannot contain javascript: or data: schemes',
});

export const createBannerSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    subtitle: z.string().trim().max(200, 'Subtitle cannot exceed 200 characters').nullish(),
    description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').nullish(),
    desktopImage: z.string().trim().min(1, 'Desktop image is required').pipe(safeUrlSchema),
    mobileImage: z.string().trim().pipe(safeUrlSchema).nullish(),
    imageAltText: z.string().trim().min(1, 'Image alt text is required').max(300, 'Alt text cannot exceed 300 characters'),
    buttonText: z.string().trim().max(100, 'Button text cannot exceed 100 characters').nullish(),
    buttonLink: z.string().trim().pipe(safeUrlSchema).nullish(),
    sortOrder: z.number().int().optional().default(0),
    status: z.nativeEnum(BannerStatus).optional().default(BannerStatus.DRAFT),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullish(),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullish(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.startAt).getTime() < new Date(data.endAt).getTime();
      }
      return true;
    },
    {
      message: 'startAt must be earlier than endAt',
      path: ['endAt'],
    }
  );

export type CreateBannerDto = z.infer<typeof createBannerSchema>;

export const updateBannerSchema = z
  .object({
    title: z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title cannot exceed 200 characters').optional(),
    subtitle: z.string().trim().max(200, 'Subtitle cannot exceed 200 characters').nullish(),
    description: z.string().trim().max(1000, 'Description cannot exceed 1000 characters').nullish(),
    desktopImage: z.string().trim().min(1, 'Desktop image cannot be empty').pipe(safeUrlSchema).optional(),
    mobileImage: z.string().trim().pipe(safeUrlSchema).nullish(),
    imageAltText: z.string().trim().min(1, 'Alt text cannot be empty').max(300, 'Alt text cannot exceed 300 characters').optional(),
    buttonText: z.string().trim().max(100, 'Button text cannot exceed 100 characters').nullish(),
    buttonLink: z.string().trim().pipe(safeUrlSchema).nullish(),
    sortOrder: z.number().int().optional(),
    status: z.nativeEnum(BannerStatus).optional(),
    startAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullish(),
    endAt: z.string().datetime({ offset: true }).or(z.string().datetime()).nullish(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return new Date(data.startAt).getTime() < new Date(data.endAt).getTime();
      }
      return true;
    },
    {
      message: 'startAt must be earlier than endAt',
      path: ['endAt'],
    }
  );

export type UpdateBannerDto = z.infer<typeof updateBannerSchema>;

export const reorderBannersSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1, 'Banner ID is required'),
      sortOrder: z.number().int(),
    })
  ).min(1, 'At least one banner item is required'),
});

export type ReorderBannersDto = z.infer<typeof reorderBannersSchema>;

export const queryBannersSchema = z.object({
  status: z.nativeEnum(BannerStatus).optional(),
  search: z.string().trim().optional(),
});

export type QueryBannersDto = z.infer<typeof queryBannersSchema>;

