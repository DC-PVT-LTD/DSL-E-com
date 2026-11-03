import {
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    if (this.schema) {
      return this.validateWithSchema(this.schema, value);
    }
    return value;
  }

  public validateWithSchema(schema: ZodSchema, value: unknown) {
    const result = schema.safeParse(value);
    if (!result.success) {
      const error: ZodError = result.error;
      const formattedErrors = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details: formattedErrors,
      });
    }
    return result.data;
  }
}

export function createZodPipe(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}
