import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ForbiddenException, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { UserRole } from '../../generated/prisma';

describe('AuthService - Admin Authentication & Invitations (Phase 2)', () => {
  let authService: AuthService;
  let mockPrisma: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockResponse: any;

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
      },
      adminInvitation: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      refreshToken: {
        create: vi.fn(),
        deleteMany: vi.fn(),
        updateMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockJwtService = {
      signAsync: vi.fn().mockResolvedValue('mock_jwt_access_token'),
    };

    mockConfigService = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'test';
        if (key === 'JWT_SECRET') return 'test_secret_entropy_key_1234567890';
        return null;
      }),
    };

    mockResponse = {
      cookie: vi.fn(),
      clearCookie: vi.fn(),
    };

    authService = new AuthService(mockPrisma, mockJwtService, mockConfigService);
  });

  describe('adminLogin', () => {
    it('should authenticate valid administrative user and set secure cookies', async () => {
      const passwordHash = await bcrypt.hash('AdminSecurePass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@dslstationery.lk',
        name: 'DSL Admin',
        role: UserRole.ADMIN,
        isActive: true,
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      });

      const result = await authService.adminLogin(
        { email: 'admin@dslstationery.lk', password: 'AdminSecurePass123!' },
        mockResponse
      );

      expect(result.success).toBe(true);
      expect(result.data.email).toBe('admin@dslstationery.lk');
      expect(result.data.role).toBe(UserRole.ADMIN);
      // Cookie verification
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_access_token',
        'mock_jwt_access_token',
        expect.objectContaining({ httpOnly: true })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_refresh_token',
        expect.any(String),
        expect.objectContaining({ httpOnly: true })
      );
    });

    it('should reject CUSTOMER role with ForbiddenException', async () => {
      const passwordHash = await bcrypt.hash('CustomerPass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'cust-1',
        email: 'customer@dsl.lk',
        name: 'Regular Customer',
        role: UserRole.CUSTOMER,
        isActive: true,
        passwordHash,
      });

      await expect(
        authService.adminLogin(
          { email: 'customer@dsl.lk', password: 'CustomerPass123!' },
          mockResponse
        )
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject deactivated administrative account with UnauthorizedException', async () => {
      const passwordHash = await bcrypt.hash('Pass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-deactivated',
        email: 'deactivated@dsl.lk',
        name: 'Deactivated Admin',
        role: UserRole.STAFF,
        isActive: false,
        passwordHash,
      });

      await expect(
        authService.adminLogin(
          { email: 'deactivated@dsl.lk', password: 'Pass123!' },
          mockResponse
        )
      ).rejects.toThrow('Account has been deactivated');
    });

    it('should increment failed attempts and lock account after 5 consecutive failures', async () => {
      const passwordHash = await bcrypt.hash('RealPass123!', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'staff-1',
        email: 'staff@dsl.lk',
        name: 'Staff One',
        role: UserRole.STAFF,
        isActive: true,
        passwordHash,
        failedLoginAttempts: 4, // 5th failure incoming
        lockedUntil: null,
      });

      await expect(
        authService.adminLogin(
          { email: 'staff@dsl.lk', password: 'WrongPassword!' },
          mockResponse
        )
      ).rejects.toThrow(UnauthorizedException);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });
  });

  describe('verifyInvitation', () => {
    it('should return invitation details for a valid raw token', async () => {
      const rawToken = 'sample_secure_invitation_token_12345';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-1',
        email: 'newadmin@dsl.lk',
        name: 'New Admin',
        role: UserRole.STAFF,
        tokenHash,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
        invitedBy: { id: 'admin-1', name: 'Super Admin', email: 'admin@dsl.lk' },
      });

      const result = await authService.verifyInvitation(rawToken);
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('newadmin@dsl.lk');
      expect(result.data.role).toBe(UserRole.STAFF);
    });

    it('should reject already used invitation', async () => {
      const rawToken = 'used_token';
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-used',
        tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: new Date(),
      });

      await expect(authService.verifyInvitation(rawToken)).rejects.toThrow(
        'already been used'
      );
    });

    it('should reject expired invitation', async () => {
      const rawToken = 'expired_token';
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-exp',
        tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
        expiresAt: new Date(Date.now() - 3600 * 1000), // 1 hour ago
        usedAt: null,
      });

      await expect(authService.verifyInvitation(rawToken)).rejects.toThrow(
        'invitation has expired'
      );
    });
  });

  describe('acceptInvitation', () => {
    it('should set password, activate account, mark invitation used, and initialize session', async () => {
      const rawToken = 'valid_accept_token_abcdef';
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-accept',
        email: 'activated@dsl.lk',
        name: 'Activated Admin',
        phone: '+94771112233',
        role: UserRole.MANAGER,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new-1',
        email: 'activated@dsl.lk',
        name: 'Activated Admin',
        phone: '+94771112233',
        role: UserRole.MANAGER,
        isActive: true,
      });

      const result = await authService.acceptInvitation(
        { token: rawToken, password: 'StrongPassword123!' },
        mockResponse
      );

      expect(mockPrisma.adminInvitation.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'inv-accept', usedAt: null }),
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        })
      );
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'activated@dsl.lk',
            role: UserRole.ADMIN,
            isActive: true,
            isEmailVerified: true,
          }),
        })
      );
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ADMIN_INVITATION_ACCEPTED',
          }),
        })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_access_token',
        'mock_jwt_access_token',
        expect.any(Object)
      );
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-new-1',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        })
      );
      const tokenCreateCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(tokenCreateCall.data.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect((tokenCreateCall.data as any).rawToken).toBeUndefined();
    });

    it('should roll back invitation consumption and administrator creation if refresh-token persistence fails', async () => {
      const rawToken = 'valid_accept_token_abcdef';
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-accept',
        email: 'activated@dsl.lk',
        name: 'Activated Admin',
        phone: '+94771112233',
        role: UserRole.MANAGER,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
      });

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new-1',
        email: 'activated@dsl.lk',
        name: 'Activated Admin',
        phone: '+94771112233',
        role: UserRole.ADMIN,
        isActive: true,
      });

      // Simulate refresh token persistence failure inside transaction
      mockPrisma.refreshToken.create.mockRejectedValue(
        new Error('Database error: refresh token constraint violation')
      );

      await expect(
        authService.acceptInvitation(
          { token: rawToken, password: 'StrongPassword123!' },
          mockResponse
        )
      ).rejects.toThrow('Database error: refresh token constraint violation');

      // Verify cookies are NEVER set when the transaction fails
      expect(mockResponse.cookie).not.toHaveBeenCalled();
    });

    it('should throw ConflictException if concurrent request already consumed invitation', async () => {
      const rawToken = 'valid_accept_token_abcdef';
      mockPrisma.adminInvitation.findUnique.mockResolvedValue({
        id: 'inv-accept',
        email: 'activated@dsl.lk',
        name: 'Activated Admin',
        phone: '+94771112233',
        role: UserRole.MANAGER,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        usedAt: null,
      });
      mockPrisma.adminInvitation.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        authService.acceptInvitation(
          { token: rawToken, password: 'StrongPassword123!' },
          mockResponse
        )
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('logout', () => {
    it('should revoke refresh token in database and clear auth cookies', async () => {
      const rawRefreshToken = 'sample_refresh_token_to_revoke';
      const result = await authService.logout('user-1', rawRefreshToken, mockResponse);

      expect(result.success).toBe(true);
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isRevoked: true },
        })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_access_token',
        '',
        expect.objectContaining({ maxAge: 0 })
      );
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'dsl_refresh_token',
        '',
        expect.objectContaining({ maxAge: 0 })
      );
    });
  });
});
