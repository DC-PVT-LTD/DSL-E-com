import 'dotenv/config';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../../generated/prisma';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockResponse: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      refreshToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      address: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      order: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation((actions) => Promise.all(actions)),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('mock_access_jwt'),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string, defaultVal: any) => {
        if (key === 'BCRYPT_ROUNDS') return 10;
        if (key === 'REFRESH_TOKEN_EXPIRES_DAYS') return 7;
        if (key === 'NODE_ENV') return 'test';
        if (key === 'JWT_SECRET') return 'a'.repeat(128);
        return defaultVal;
      }),
    };

    mockResponse = {
      cookie: vi.fn(),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('creates a new customer and sets auth cookies', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        name: 'Jane Doe',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await authService.register(
        {
          name: 'Jane Doe',
          email: 'customer@example.com',
          password: 'Password123!',
        },
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('customer@example.com');
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_access_token',
        'mock_access_jwt',
        expect.objectContaining({ httpOnly: true, path: '/' })
      );
    });

    it('throws ConflictException on duplicate email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        authService.register(
          {
            name: 'Jane Doe',
            email: 'duplicate@example.com',
            password: 'Password123!',
          },
          mockResponse
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('authenticates valid credentials and resets failed attempts', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        name: 'Jane Doe',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        isActive: true,
        failedLoginAttempts: 2,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await authService.login(
        { email: 'customer@example.com', password: 'Password123!' },
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: 0, lockedUntil: null },
        })
      );
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('rejects invalid password and increments failed attempts counter', async () => {
      const hash = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash: hash,
        isActive: true,
        failedLoginAttempts: 1,
      });

      await expect(
        authService.login(
          { email: 'customer@example.com', password: 'WrongPassword' },
          mockResponse
        )
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { failedLoginAttempts: 2, lockedUntil: null },
        })
      );
    });

    it('rejects inactive accounts', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash: hash,
        isActive: false,
      });

      await expect(
        authService.login(
          { email: 'customer@example.com', password: 'Password123!' },
          mockResponse
        )
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('token refresh & reuse detection', () => {
    it('revokes all sessions when a revoked token is replayed (reuse detection)', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-stolen',
        userId: 'user-1',
        isRevoked: true,
        user: { id: 'user-1', isActive: true },
      });

      await expect(
        authService.refreshTokens('stolen_raw_token', mockResponse)
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });

    it('rotates tokens in a transaction for a valid refresh token', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-valid',
        userId: 'user-1',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 1000000),
        user: { id: 'user-1', email: 'user@dsl.lk', role: UserRole.CUSTOMER, isActive: true },
      });

      const result = await authService.refreshTokens('valid_raw_token', mockResponse);

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('password reset', () => {
    it('returns generic response for forgot-password to prevent enumeration', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: 'nonexistent@dsl.lk' });

      expect(result.success).toBe(true);
      expect(result.message).toContain('If this email is registered');
    });

    it('resets password and revokes all active refresh tokens on valid reset token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@dsl.lk',
      });

      const result = await authService.resetPassword({
        token: 'valid_reset_token',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { isRevoked: true },
      });
    });
  });

  describe('customer account management (ownership checks)', () => {
    it('scopes address creation to the authenticated user', async () => {
      mockPrisma.address.create.mockResolvedValue({ id: 'addr-1' });

      await authService.createAddress('user-1', {
        fullName: 'Jane Doe',
        phone: '0771234567',
        email: 'jane@example.com',
        addressLine1: 'No 1, Main St',
        city: 'Colombo',
        district: 'Colombo',
        isDefault: false,
      });

      expect(mockPrisma.address.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user-1' }),
      });
    });

    it('prevents address updates if address does not belong to user', async () => {
      mockPrisma.address.findFirst.mockResolvedValue(null);

      await expect(
        authService.updateAddress('user-1', 'addr-of-other-user', { city: 'Kandy' })
      ).rejects.toThrow(BadRequestException);
    });

    it('scopes order history strictly to user ID', async () => {
      mockPrisma.order.findMany.mockResolvedValue([]);

      await authService.getMyOrders('user-1');

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } })
      );
    });
  });
});

