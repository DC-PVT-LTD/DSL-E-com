import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe, createZodPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  describe('body validation', () => {
    const TestUserSchema = z.object({
      email: z.string().email('Invalid email address format'),
      name: z.string().min(2, 'Name must be at least 2 characters'),
      age: z.number().int().positive().optional(),
    });

    const pipe = createZodPipe(TestUserSchema);

    it('passes through valid payload and returns parsed data', () => {
      const validData = {
        email: 'customer@dslstationery.lk',
        name: 'Kamal Perera',
        age: 28,
      };

      const result = pipe.transform(validData, { type: 'body' });
      expect(result).toEqual(validData);
    });

    it('throws BadRequestException (HTTP 400) when required fields are missing', () => {
      const invalidData = {
        email: 'invalid-email',
      };

      expect(() => pipe.transform(invalidData, { type: 'body' })).toThrow(
        BadRequestException
      );

      try {
        pipe.transform(invalidData, { type: 'body' });
      } catch (err) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = (err as BadRequestException).getResponse() as {
          statusCode: number;
          error: string;
          message: string;
          details: Array<{ field: string; message: string; code: string }>;
        };

        expect(res.statusCode).toBe(400);
        expect(res.message).toBe('Validation failed');
        expect(res.details).toBeDefined();

        const fields = res.details.map((d) => d.field);
        expect(fields).toContain('email');
        expect(fields).toContain('name');
      }
    });

    it('bypasses validation if no schema is bound to the pipe instance', () => {
      const unboundPipe = new ZodValidationPipe();
      const rawData = { anything: 'goes' };
      const result = unboundPipe.transform(rawData, { type: 'body' });
      expect(result).toBe(rawData);
    });
  });

  describe('query parameters validation', () => {
    const QuerySchema = z.object({
      page: z.string().transform((v) => parseInt(v, 10)).pipe(z.number().min(1)),
      search: z.string().optional(),
    });

    const queryPipe = createZodPipe(QuerySchema);

    it('successfully parses and transforms query parameters', () => {
      const rawQuery = { page: '2', search: 'pencil' };
      const result = queryPipe.transform(rawQuery, { type: 'query' });
      expect(result).toEqual({ page: 2, search: 'pencil' });
    });

    it('rejects invalid query parameters with HTTP 400', () => {
      const rawQuery = { page: '0' };
      expect(() => queryPipe.transform(rawQuery, { type: 'query' })).toThrow(
        BadRequestException
      );
    });
  });

  describe('route parameters validation', () => {
    const SlugParamSchema = z.object({
      slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
    });

    const paramPipe = createZodPipe(SlugParamSchema);

    it('accepts valid route slug parameters', () => {
      const validParam = { slug: 'doms-colour-pencils' };
      const result = paramPipe.transform(validParam, { type: 'param' });
      expect(result).toEqual(validParam);
    });

    it('rejects invalid route parameter format with HTTP 400', () => {
      const invalidParam = { slug: 'INVALID SLUG with spaces!' };
      expect(() => paramPipe.transform(invalidParam, { type: 'param' })).toThrow(
        BadRequestException
      );
    });
  });
});
