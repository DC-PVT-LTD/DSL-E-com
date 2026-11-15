
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ForbiddenException } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import * as path from 'path';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 4000);

  // Set global API route prefix
  app.setGlobalPrefix('api/v1');

  // Configure Swagger OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DSL Stationery API')
    .setDescription('DSL Stationery E-Commerce API documentation')
    .setVersion('1.0')
    .addTag('Authentication', 'Shared authentication: register, login, session refresh, logout, password reset')
    .addTag('Customer API', 'Customer profile, saved addresses, and order history operations')
    .addTag('Admin API', 'Administrative management for products, categories, brands, and inventory')
    .addTag('Inventory', 'Warehouse inventory stock adjustment, movement history, and low-stock alerts')
    .addTag('Products', 'Public product catalogue browsing and search')
    .addTag('Variants', 'Product variants, SKU pricing, and option management')
    .addTag('Categories', 'Public category hierarchy and category products')
    .addTag('Brands', 'Public brand catalogue and brand products')
    .addTag('Cart', 'Shopping cart management for guests and authenticated customers with server-side pricing, live stock checks, and cart merging')
    .addTag('Health', 'System health and database connectivity checks')
    .addCookieAuth('dsl_access_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'dsl_access_token',
      description: 'HTTP-only access token cookie set on login/register',
    })
    .addCookieAuth('dsl_refresh_token', {
      type: 'apiKey',
      in: 'cookie',
      name: 'dsl_refresh_token',
      description: 'HTTP-only refresh token cookie for session renewal',
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token. Enter: Bearer <token>',
      },
      'bearerAuth'
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerConfig,
    { autoTagControllers: false },
  );

  const swaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
      requestInterceptor: (req: any) => {
        if (!req.headers) {
          req.headers = {};
        }
        req.headers['X-Requested-With'] = 'XMLHttpRequest';
        return req;
      },
    },
  };

  // Serve static uploaded files
  const uploadsStaticDir = path.resolve(process.cwd(), 'public', 'uploads');
  app.use('/uploads', express.static(uploadsStaticDir));
  app.use('/api/v1/uploads', express.static(uploadsStaticDir));

  // Mount Swagger UI at both 'api/v1/docs' and 'docs'
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument, swaggerCustomOptions);
  SwaggerModule.setup('docs', app, swaggerDocument, swaggerCustomOptions);

  // Register cookie-parser
  app.use(cookieParser());

  // Register global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Configure strict CORS
  const corsOriginEnv = configService.get<string>(
    'CORS_ORIGIN',
    'http://localhost:3000,http://localhost:3002',
  );

  const allowedOrigins = [
    ...corsOriginEnv
      .split(',')
      .map((origin) => origin.trim().replace(/\/+$/, '')),
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ].filter(Boolean);

  app.enableCors({
    origin: (
      requestOrigin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!requestOrigin) {
        return callback(null, true);
      }

      const normalized = requestOrigin.replace(/\/+$/, '');

      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }

      // Automatically permit local LAN IP origins (e.g. 192.168.x.x, 172.x.x.x, 10.x.x.x) on frontend ports 3000/3002
      try {
        const parsed = new URL(normalized);
        const host = parsed.hostname;
        const reqPort = parsed.port;
        const isFrontendPort = reqPort === '3000' || reqPort === '3001' || reqPort === '3002';
        const isLanIp =
          host === 'localhost' ||
          host === '127.0.0.1' ||
          /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
          /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host) ||
          /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);

        if (isFrontendPort && isLanIp) {
          return callback(null, true);
        }
      } catch {
        // Fall through to reject
      }

      return callback(
        new ForbiddenException(`CORS blocked for origin: ${requestOrigin}`),
        false,
      );
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'x-guest-session-id',
      'x-session-id',
      'x-tracking-otp',
      'Origin',
    ],
    exposedHeaders: [
      'x-guest-session-id',
      'x-session-id',
      'Content-Disposition',
    ],
  });

  await app.listen(port);

  logger.log(
    `DSL Stationery backend running at http://localhost:${port}/api/v1`,
  );
  logger.log(`Swagger UI: http://localhost:${port}/api/v1/docs`);
  logger.log(`Allowed CORS origins: ${allowedOrigins.join(', ')}`);
}

bootstrap();
