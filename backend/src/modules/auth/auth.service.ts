import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
} from './dto/auth.dto';
import { UserRole } from '../../generated/prisma';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly bcryptRounds: number;
  private readonly refreshExpiresDays: number;
  private readonly isProduction: boolean;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) private readonly configService?: ConfigService
  ) {
    this.bcryptRounds = this.configService?.get<number>('BCRYPT_ROUNDS', 12) ?? 12;
    this.refreshExpiresDays = this.configService?.get<number>('REFRESH_TOKEN_EXPIRES_DAYS', 7) ?? 7;
    this.isProduction = this.configService?.get<string>('NODE_ENV') === 'production';
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProd = this.isProduction;

    res.cookie('dsl_access_token', accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('dsl_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: this.refreshExpiresDays * 24 * 60 * 60 * 1000,
    });
  }

  public clearAuthCookies(res: Response) {
    const isProd = this.isProduction;

    res.cookie('dsl_access_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    res.cookie('dsl_refresh_token', '', {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/api/v1/auth/refresh',
      maxAge: 0,
    });
  }

  async register(dto: RegisterDto, res: Response) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    const accessToken = await this.generateAccessToken(user.id, user.email, user.role);
    const rawRefreshToken = await this.createRefreshTokenSession(user.id);
    this.setAuthCookies(res, accessToken, rawRefreshToken);

    return {
      success: true,
      message: 'Account registered successfully',
      data: user,
    };
  }

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Equalize timing if user not found by executing dummy comparison
    if (!user || !user.passwordHash) {
      await bcrypt.compare(dto.password, '$2b$12$e80iA4gqT3cRk7/2E8tq7uB7iR/g5zG6e3P3q7G8p9y1z2w3e4r5t');
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated. Please contact customer support.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Account is temporarily locked due to multiple failed login attempts.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      const lockedUntil = failedAttempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed counter on successful login
    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const accessToken = await this.generateAccessToken(user.id, user.email, user.role);
    const rawRefreshToken = await this.createRefreshTokenSession(user.id);
    this.setAuthCookies(res, accessToken, rawRefreshToken);

    return {
      success: true,
      message: 'Logged in successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  async refreshTokens(rawRefreshToken: string | undefined, res: Response) {
    if (!rawRefreshToken) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const session = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Invalid refresh session');
    }

    // Token reuse detection
    if (session.isRevoked) {
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}. Revoking all sessions.`);
      await this.prisma.refreshToken.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true },
      });
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Session terminated due to token reuse');
    }

    if (session.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: session.id } });
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Refresh token expired');
    }

    if (!session.user.isActive) {
      this.clearAuthCookies(res);
      throw new UnauthorizedException('Account deactivated');
    }

    // Single-transaction rotation
    const newRawRefreshToken = crypto.randomBytes(64).toString('hex');
    const newTokenHash = this.hashToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresDays * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: session.id },
        data: { isRevoked: true },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: session.userId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      }),
    ]);

    const newAccessToken = await this.generateAccessToken(session.user.id, session.user.email, session.user.role);
    this.setAuthCookies(res, newAccessToken, newRawRefreshToken);

    return {
      success: true,
      message: 'Tokens rotated successfully',
    };
  }

  async logout(userId: string | undefined, rawRefreshToken: string | undefined, res: Response) {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash },
        data: { isRevoked: true },
      });
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }

    this.clearAuthCookies(res);
    return { success: true, message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return { success: true, data: user };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (user && user.isActive) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: expiresAt,
        },
      });

      if (!this.isProduction && process.env.NODE_ENV === 'development') {
        const masked = dto.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}***${c}`);
        this.logger.warn(
          `[DEV ONLY — NEVER IN PRODUCTION] Password reset link for ${masked}:\n` +
          `http://localhost:3000/reset-password?token=${rawToken}`
        );
      }
    }

    // Always return generic response to prevent account enumeration
    return {
      success: true,
      message: 'If this email is registered, a password reset link will be sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const newHash = await bcrypt.hash(dto.newPassword, this.bcryptRounds);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      // Revoke all existing sessions on password change
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      }),
    ]);

    return {
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    };
  }

  // --------------------------------------------------------------------------
  // Customer Account Management (Part D)
  // --------------------------------------------------------------------------

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.phone ? { phone: dto.phone } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
      },
    });

    return { success: true, message: 'Profile updated successfully', data: updated };
  }

  async getAddresses(userId: string) {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    return { success: true, data: addresses };
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const address = await this.prisma.address.create({
      data: {
        ...dto,
        userId,
      },
    });

    return { success: true, message: 'Address created successfully', data: address };
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.address.update({
      where: { id: addressId },
      data: dto,
    });

    return { success: true, message: 'Address updated successfully', data: updated };
  }

  async deleteAddress(userId: string, addressId: string) {
    const existing = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!existing) {
      throw new BadRequestException('Address not found or unauthorized');
    }

    await this.prisma.address.delete({
      where: { id: addressId },
    });

    return { success: true, message: 'Address deleted successfully' };
  }

  async getMyOrders(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      include: {
        items: true,
        addressSnapshot: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return { success: true, data: orders };
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private async generateAccessToken(userId: string, email: string, role: string): Promise<string> {
    return this.jwtService.signAsync({
      sub: userId,
      email,
      role,
    });
  }

  private async createRefreshTokenSession(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + this.refreshExpiresDays * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return rawToken;
  }
}
