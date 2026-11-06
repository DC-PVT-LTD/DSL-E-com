import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const schoolPackQuerySchema = z.object({
  grade: z.string().optional(),
  tier: z.string().optional(),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export class SchoolPackQueryDto {
  @ApiPropertyOptional({ description: 'Filter by grade group' })
  grade?: string;

  @ApiPropertyOptional({ description: 'Filter by tier (essential, standard, premium)' })
  tier?: string;

  @ApiPropertyOptional({ description: 'Search term for name or description' })
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  page?: number;

  @ApiPropertyOptional({ description: 'Results per page', default: 20 })
  limit?: number;
}

