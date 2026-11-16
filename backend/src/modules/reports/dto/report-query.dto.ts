import { z } from 'zod';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const reportPeriodEnum = ['today', 'last7days', 'last30days', 'custom'] as const;
export type ReportPeriod = (typeof reportPeriodEnum)[number];

export const exportFormatEnum = ['csv', 'xlsx'] as const;
export type ExportFormat = (typeof exportFormatEnum)[number];

/**
 * Checks if a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Validates both YYYY-MM-DD format and real-world Gregorian calendar validity
 * including accurate days per month and leap-year February 29th rules.
 */
export function isValidCalendarDate(dateStr: string | null | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;

  const [yearStr, monthStr, dayStr] = trimmed.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = [
    31, // January
    isLeapYear(year) ? 29 : 28, // February
    31, // March
    30, // April
    31, // May
    30, // June
    31, // July
    31, // August
    30, // September
    31, // October
    30, // November
    31, // December
  ];

  return day <= daysInMonth[month - 1];
}

const customDateSchema = z
  .string()
  .trim()
  .refine(isValidCalendarDate, {
    message: 'Must be a valid calendar date in YYYY-MM-DD format',
  });

export const reportQuerySchema = z
  .object({
    period: z.enum(reportPeriodEnum).default('last30days').optional(),
    dateFrom: customDateSchema.optional(),
    dateTo: customDateSchema.optional(),
    format: z.enum(exportFormatEnum).default('xlsx').optional(),
  })
  .superRefine((data, ctx) => {
    if (data.period === 'custom') {
      if (!data.dateFrom) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dateFrom is required when period is custom',
          path: ['dateFrom'],
        });
      }
      if (!data.dateTo) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'dateTo is required when period is custom',
          path: ['dateTo'],
        });
      }
      if (data.dateFrom && data.dateTo) {
        if (data.dateFrom > data.dateTo) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'dateFrom must be before or equal to dateTo',
            path: ['dateFrom'],
          });
        } else {
          const diffMs = new Date(data.dateTo).getTime() - new Date(data.dateFrom).getTime();
          const diffDays = Math.round(diffMs / (24 * 3600 * 1000)) + 1;
          if (diffDays > 366) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Custom reporting period cannot exceed 366 days (1 year)',
              path: ['dateTo'],
            });
          }
        }
      }
    }
  });

export type ReportQueryDto = z.infer<typeof reportQuerySchema>;

export class ReportQuerySwaggerDto {
  @ApiPropertyOptional({
    description: 'Predefined reporting period or custom date range',
    enum: reportPeriodEnum,
    default: 'last30days',
  })
  period?: ReportPeriod;

  @ApiPropertyOptional({
    description: 'Start date in Asia/Colombo calendar (YYYY-MM-DD), required for custom period',
    example: '2026-10-01',
  })
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'End date in Asia/Colombo calendar (YYYY-MM-DD), required for custom period',
    example: '2026-10-31',
  })
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Export file format',
    enum: exportFormatEnum,
    default: 'xlsx',
  })
  format?: ExportFormat;
}
