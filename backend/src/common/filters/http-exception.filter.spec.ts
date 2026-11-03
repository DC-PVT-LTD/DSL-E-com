import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: {
    status: any;
    json: any;
  };
  let mockRequest: {
    method: string;
    url: string;
  };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'GET',
      url: '/api/v1/test-endpoint',
    };

    mockHost = {
      switchToHttp: vi.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('formats NotFoundException (HTTP 404) correctly', () => {
    const exception = new NotFoundException('Item not found');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        error: 'NOT_FOUND',
        message: 'Item not found',
        path: '/api/v1/test-endpoint',
      })
    );
  });

  it('preserves validation details on BadRequestException (HTTP 400)', () => {
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Validation failed',
      details: [{ field: 'name', message: 'Name is required' }],
    });

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'Validation failed',
        path: '/api/v1/test-endpoint',
        details: [{ field: 'name', message: 'Name is required' }],
      })
    );
  });

  it('preserves ConflictException (HTTP 409)', () => {
    const exception = new ConflictException('Product SKU already exists');

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'CONFLICT',
        message: 'Product SKU already exists',
      })
    );
  });

  it('handles unexpected non-HttpException cleanly as HTTP 500 without leaking stack traces or SQL', () => {
    const rawError = new Error('FATAL: connection to server at "10.0.0.1" failed');

    filter.catch(rawError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR
    );
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected server error occurred',
        path: '/api/v1/test-endpoint',
      })
    );

    const jsonCallArg = mockResponse.json.mock.calls[0][0];
    expect(JSON.stringify(jsonCallArg)).not.toContain('10.0.0.1');
    expect(jsonCallArg.stack).toBeUndefined();
  });
});
