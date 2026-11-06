import { z } from 'zod';
import { ApiProperty } from '@nestjs/swagger';

export const DEFAULT_GRADE_GROUPS = [
  'Grade 1-2',
  'Grade 3-5',
  'Grade 6-9',
  'O/L (Grade 10-11)',
  'A/L Science',
  'A/L Commerce',
  'A/L Arts',
];

export const DEFAULT_TIERS = ['essential', 'standard', 'premium'];

export const schoolPackConfigSchema = z.object({
  gradeGroups: z
    .array(z.string().min(1, 'Grade group cannot be empty'))
    .min(1, 'At least one grade group is required'),
  tiers: z
    .array(z.string().min(1, 'Tier cannot be empty'))
    .min(1, 'At least one tier is required'),
});

export class SchoolPackConfigDto {
  @ApiProperty({
    description: 'Configurable supported grade groups',
    example: DEFAULT_GRADE_GROUPS,
  })
  gradeGroups: string[];

  @ApiProperty({
    description: 'Configurable supported pack tiers',
    example: DEFAULT_TIERS,
  })
  tiers: string[];
}

