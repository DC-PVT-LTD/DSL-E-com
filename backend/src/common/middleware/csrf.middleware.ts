import { Injectable, NestMiddleware, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private allowedOrigins: string[];

  constructor(@Optional() @Inject(ConfigService) configService?: ConfigService) {
    const rawOrigins = configService?.get<string>('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3002') || process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3002';
    const port = configService?.get<number>('PORT', 4000) || 4000;
    this.allowedOrigins = [
      ...rawOrigins.split(',').map((o) => o.trim().replace(/\/+$/, '')),
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
    ].filter(Boolean);
  }

  use(req: Request, res: Response, next: NextFunction) {
    const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!mutatingMethods.includes(req.method.toUpperCase())) {
      return next();
    }

    const hasAuthCookie = Boolean(req.cookies?.['dsl_access_token'] || req.cookies?.['dsl_refresh_token']);
    if (!hasAuthCookie) {
      return next();
    }

    const origin = req.headers['origin'];
    if (!origin) {
      throw new ForbiddenException('CSRF protection: missing Origin header on authenticated request');
    }

    const originNormalized = origin.replace(/\/+$/, '');
    const isAllowed = this.allowedOrigins.some((allowed) => allowed.replace(/\/+$/, '') === originNormalized);
    if (!isAllowed) {
      throw new ForbiddenException(`CSRF protection: untrusted origin ${origin}`);
    }

    const requestedWith = req.headers['x-requested-with'];
    const requestedWithValue = Array.isArray(requestedWith) ? requestedWith[0] : requestedWith;
    if (!requestedWithValue || requestedWithValue.toLowerCase() !== 'xmlhttprequest') {
      throw new ForbiddenException('CSRF protection: missing or invalid X-Requested-With header');
    }

    next();
  }
}
