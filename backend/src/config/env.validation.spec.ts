import { describe, it, expect } from 'vitest';
import { validateEnvironment, envSchema } from './env.validation';

describe('validateEnvironment', () => {
  const validJwtSecret = 'a'.repeat(128);

  it('successfully validates a valid environment configuration', () => {
    const rawEnv = {
      PORT: '5000',
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/dsl_stationery?schema=public',
      CORS_ORIGIN: 'http://localhost:3000',
      JWT_SECRET: validJwtSecret,
    };

    const validated = validateEnvironment(rawEnv);

    expect(validated.PORT).toBe(5000);
    expect(validated.NODE_ENV).toBe('production');
    expect(validated.DATABASE_URL).toBe(rawEnv.DATABASE_URL);
    expect(validated.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(validated.JWT_SECRET).toBe(validJwtSecret);
  });

  it('applies default values for optional variables when omitted', () => {
    const rawEnv = {
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/dsl_stationery',
      JWT_SECRET: validJwtSecret,
    };

    const validated = validateEnvironment(rawEnv);

    expect(validated.PORT).toBe(4000);
    expect(validated.NODE_ENV).toBe('development');
    expect(validated.CORS_ORIGIN).toBe('http://localhost:3000,http://localhost:3002');
    expect(validated.JWT_EXPIRES_IN).toBe('15m');
    expect(validated.REFRESH_TOKEN_EXPIRES_DAYS).toBe(7);
    expect(validated.BCRYPT_ROUNDS).toBe(12);
  });

  it('fails startup if DATABASE_URL is missing', () => {
    const rawEnv = {
      PORT: '4000',
    };

    expect(() => validateEnvironment(rawEnv)).toThrowError(
      /Environment validation failed/
    );
  });

  it('fails startup if DATABASE_URL does not start with postgresql:// or postgres://', () => {
    const rawEnv = {
      DATABASE_URL: 'mysql://root:pass@localhost:3306/db',
    };

    expect(() => validateEnvironment(rawEnv)).toThrowError(
      /DATABASE_URL must start with postgresql:\/\/ or postgres:\/\//
    );
  });

  it('fails startup if PORT is not a valid number or out of port range', () => {
    const rawEnv = {
      PORT: '999999',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    };

    expect(() => validateEnvironment(rawEnv)).toThrowError(
      /Environment validation failed/
    );
  });

  it('never leaks secret values in error messages', () => {
    const invalidEnv = {
      PORT: 'invalid_port',
      DATABASE_URL: 'invalid_url_with_secret_password_123',
    };

    try {
      validateEnvironment(invalidEnv);
      expect.fail('Should have thrown an error');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain('invalid_url_with_secret_password_123');
      expect(message).toContain('DATABASE_URL');
    }
  });
});
