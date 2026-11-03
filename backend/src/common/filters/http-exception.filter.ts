import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

export interface ErrorResponsePayload {
  statusCode: number;
  error: string;
  message: string;
  timestamp: string;
  path: string;
  details?: unknown;
}

const STATUS_CODE_TO_ERROR_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const errorWithStatus = exception as { status?: number; statusCode?: number; message?: string };
    
    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    if (isHttpException) {
      status = exception.getStatus();
    } else if (typeof errorWithStatus?.status === 'number') {
      status = errorWithStatus.status;
    } else if (typeof errorWithStatus?.statusCode === 'number') {
      status = errorWithStatus.statusCode;
    }

    let message = 'Internal server error';
    let errorCode = STATUS_CODE_TO_ERROR_CODE[status] || 'ERROR';
    let details: unknown = undefined;

    if (isHttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.message === 'string') {
          message = resObj.message;
        } else if (Array.isArray(resObj.message)) {
          message = resObj.message.join(', ');
        }
        if (typeof resObj.error === 'string') {
          errorCode = resObj.error.trim().toUpperCase().replace(/\s+/g, '_');
        }
        if (resObj.details !== undefined) {
          details = resObj.details;
        }
        // In case service returned custom structured object like ServiceUnavailableException in HealthController
        if (resObj.database !== undefined) {
          details = { database: resObj.database };
        }
      }
    } else if (exception instanceof Error) {
      if (status < 500) {
        message = exception.message;
      } else {
        // In development, we can log the internal error safely on the server side
        this.logger.error(
          `Unhandled exception on ${request?.method} ${request?.url}: ${exception.message}`,
          exception.stack
        );
        // But never expose the raw internal error or stack to the client
        message = 'An unexpected server error occurred';
      }
    }

    // Log client/server error with safe metadata
    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request?.method} ${request?.url} - ${message}`
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${status}] ${request?.method} ${request?.url} - ${message}`
      );
    }

    const payload: ErrorResponsePayload = {
      statusCode: status,
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      path: request?.url || '',
      ...(details !== undefined ? { details } : {}),
    };

    response.status(status).json(payload);
  }
}
