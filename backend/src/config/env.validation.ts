import { z } from 'zod';

export const envSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default('4000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  DATABASE_URL: z
    .string({
      required_error: 'DATABASE_URL is required',
    })
    .min(10, 'DATABASE_URL must be a valid PostgreSQL connection string')
    .refine(
      (val) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      {
        message: 'DATABASE_URL must start with postgresql:// or postgres://',
      }
    ),
  CORS_ORIGIN: z
    .string()
    .optional()
    .default('http://localhost:3000,http://localhost:3002'),

  // ─── Authentication ────────────────────────────────────────────────────────
  // JWT_SECRET must be ≥ 128 hex characters (64 bytes of entropy).
  // Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  JWT_SECRET: z
    .string({ required_error: 'JWT_SECRET is required' })
    .min(128, 'JWT_SECRET must be at least 128 hex characters (64 bytes of entropy). ' +
              'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'),
  JWT_EXPIRES_IN: z
    .string()
    .optional()
    .default('15m')
    .refine(
      (val) => /^\d+[smhd]$/.test(val),
      { message: 'JWT_EXPIRES_IN must be a duration like 15m, 1h, or 7d' }
    ),
  REFRESH_TOKEN_EXPIRES_DAYS: z
    .string()
    .optional()
    .default('7')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(365)),
  BCRYPT_ROUNDS: z
    .string()
    .optional()
    .default('12')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(10).max(14)),

  // ─── OCR / Vision Provider Configuration ─────────────────────────────────────
  OCR_PROVIDER: z
    .enum(['simulated', 'google_vision', 'gemini_vision', 'auto'])
    .optional()
    .default('auto'),
  OCR_API_KEY: z.string().optional(),
  GOOGLE_VISION_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  OCR_MAX_RETRIES: z
    .string()
    .optional()
    .default('3')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(5)),
  OCR_TIMEOUT_MS: z
    .string()
    .optional()
    .default('15000')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1000).max(60000)),

  // ─── Payment Gateway & Application URLs ─────────────────────────────────────
  PAYHERE_MERCHANT_ID: z.string().optional().default('1211149'),
  PAYHERE_MERCHANT_SECRET: z.string().optional().default('dsl_payhere_sandbox_secret'),
  PAYHERE_SANDBOX: z.string().optional().default('true'),
  FRONTEND_URL: z.string().optional().default('http://localhost:3000'),
  BACKEND_URL: z.string().optional().default('http://localhost:4000/api/v1'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates configuration using Zod.
 * Never leaks raw secret values in error messages.
 */
export function validateEnvironment(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errorMessages = result.error.errors
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `[ConfigError] Environment validation failed:\n${errorMessages}\nCheck your .env file or deployment environment variables.`
    );
  }

  return result.data;
}
