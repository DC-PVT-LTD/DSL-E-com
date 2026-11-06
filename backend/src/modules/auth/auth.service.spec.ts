import 'dotenv/config';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole } from '../../generated/prisma';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockNotificationsService: any;
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn().mockImplementation(async (cbOrActions) => {
        if (typeof cbOrActions === 'function') {
          return cbOrActions(mockPrisma);
        }
        return Promise.all(cbOrActions);
      }),
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

    mockNotificationsService = {
      sendEmailVerificationOtp: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-otp-1' }),
    };

    mockResponse = {
      cookie: vi.fn(),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockNotificationsService as unknown as NotificationsService,
      mockConfigService as unknown as ConfigService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('creates a new unverified customer, sends OTP, and does not set cookies or link orders yet', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        name: 'Jane Doe',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
      });

      const result = await authService.register(
        {
          name: 'Jane Doe',
          email: 'customer@example.com',
          password: 'Password123!',
        },
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(result.requiresVerification).toBe(true);
      expect(result.email).toBe('customer@example.com');
      // Guest orders are NOT linked upon registration
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
      // Auth session cookies are NOT set upon registration
      expect(mockResponse.cookie).not.toHaveBeenCalled();
      // Verification email is dispatched
      expect(mockNotificationsService.sendEmailVerificationOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'customer@example.com',
          name: 'Jane Doe',
          otp: expect.stringMatching(/^\d{6}$/),
        })
      );
    });

    it('throws ConflictException on duplicate email if account is already verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing',
        email: 'duplicate@example.com',
        isEmailVerified: true,
      });

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

  describe('verifyEmail', () => {
    it('validates 6-digit OTP, marks email verified, links eligible guest orders, and sets cookies', async () => {
      const otp = '123456';
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'guest.shopper@example.com',
        name: 'Guest Shopper',
        role: UserRole.CUSTOMER,
        isEmailVerified: false,
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        emailVerificationAttempts: 0,
      });

      mockPrisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'guest.shopper@example.com',
        name: 'Guest Shopper',
        role: UserRole.CUSTOMER,
        createdAt: new Date(),
      });
      mockPrisma.order.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await authService.verifyEmail(
        { email: 'guest.shopper@example.com', otp: '123456' },
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(result.linkedOrdersCount).toBe(2);
      expect(mockPrisma.order.updateMany).toHaveBeenCalledWith({
        where: {
          customerEmail: { equals: 'guest.shopper@example.com', mode: 'insensitive' },
          userId: null,
        },
        data: {
          userId: 'user-1',
        },
      });
      // Auth session cookies are issued upon email verification
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_access_token',
        'mock_access_jwt',
        expect.objectContaining({ httpOnly: true, path: '/' })
      );
    });

    it('rejects invalid OTP and increments attempt counter', async () => {
      const otpHash = crypto.createHash('sha256').update('123456').digest('hex');

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'shopper@example.com',
        isEmailVerified: false,
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        emailVerificationAttempts: 1,
      });

      await expect(
        authService.verifyEmail({ email: 'shopper@example.com', otp: '999999' }, mockResponse)
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { emailVerificationAttempts: { increment: 1 } },
      });
      expect(mockPrisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('rejects expired OTP', async () => {
      const otpHash = crypto.createHash('sha256').update('123456').digest('hex');

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'shopper@example.com',
        isEmailVerified: false,
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: new Date(Date.now() - 1000), // Expired
        emailVerificationAttempts: 0,
      });

      await expect(
        authService.verifyEmail({ email: 'shopper@example.com', otp: '123456' }, mockResponse)
      ).rejects.toThrow(BadRequestException);
    });

    it('locks out verification after 5 failed attempts', async () => {
      const otpHash = crypto.createHash('sha256').update('123456').digest('hex');

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'shopper@example.com',
        isEmailVerified: false,
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
        emailVerificationAttempts: 5,
      });

      await expect(
        authService.verifyEmail({ email: 'shopper@example.com', otp: '123456' }, mockResponse)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerificationOtp', () => {
    it('sends new OTP when past 60s cooldown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'shopper@example.com',
        name: 'Shopper',
        isEmailVerified: false,
        emailVerificationLastSentAt: new Date(Date.now() - 70 * 1000), // 70s ago
      });

      const result = await authService.resendVerificationOtp({ email: 'shopper@example.com' });
      expect(result.success).toBe(true);
      expect(mockNotificationsService.sendEmailVerificationOtp).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ emailVerificationAttempts: 0 }),
        })
      );
    });

    it('enforces 60-second cooldown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'shopper@example.com',
        name: 'Shopper',
        isEmailVerified: false,
        emailVerificationLastSentAt: new Date(Date.now() - 20 * 1000), // Only 20s ago
      });

      await expect(
        authService.resendVerificationOtp({ email: 'shopper@example.com' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('authenticates valid credentials for verified user and resets failed attempts', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        name: 'Jane Doe',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        isActive: true,
        isEmailVerified: true,
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

    it('blocks login for unverified user accounts', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash: hash,
        isActive: true,
        isEmailVerified: false,
      });

      await expect(
        authService.login(
          { email: 'customer@example.com', password: 'Password123!' },
          mockResponse
        )
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects invalid password and increments failed attempts counter', async () => {
      const hash = await bcrypt.hash('CorrectPassword123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'customer@example.com',
        passwordHash: hash,
        isActive: true,
        isEmailVerified: true,
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
        isEmailVerified: true,
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

