import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RegisterDto,
  LoginDto,
  AdminLoginDto,
  AcceptInvitationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  UpdateProfileDto,
  CreateAddressDto,
  UpdateAddressDto,
  VerifyEmailDto,
  ResendVerificationOtpDto,
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
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
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

  async register(dto: RegisterDto, res?: Response) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (existing.isEmailVerified) {
        throw new ConflictException('An account with this email address already exists');
      }

      // Check resend cooldown if user was created earlier but unverified
      if (existing.emailVerificationLastSentAt) {
        const elapsedSeconds = Math.floor(
          (Date.now() - existing.emailVerificationLastSentAt.getTime()) / 1000
        );
        if (elapsedSeconds < 60) {
          throw new BadRequestException(
            `A verification code was recently sent. Please wait ${60 - elapsedSeconds}s before requesting a new code.`
          );
        }
      }

      // Update password/info for unverified account and issue fresh OTP
      const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

      const otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = this.hashToken(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const updatedUser = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          phone: dto.phone,
          passwordHash,
          emailVerificationOtpHash: otpHash,
          emailVerificationExpiresAt: expiresAt,
          emailVerificationAttempts: 0,
          emailVerificationLastSentAt: new Date(),
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

      await this.notificationsService.sendEmailVerificationOtp({
        email: normalizedEmail,
        name: updatedUser.name,
        otp,
      });

      return {
        success: true,
        requiresVerification: true,
        email: normalizedEmail,
        message: 'A 6-digit verification code has been sent to your email address.',
        data: updatedUser,
      };
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: normalizedEmail,
        phone: dto.phone,
        passwordHash,
        role: UserRole.CUSTOMER,
        isActive: true,
        isEmailVerified: false,
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: new Date(),
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

    // Phase B.1: OTP is emailed, guest orders are NOT linked yet, cookies NOT set yet
    await this.notificationsService.sendEmailVerificationOtp({
      email: user.email,
      name: user.name,
      otp,
    });

    return {
      success: true,
      requiresVerification: true,
      email: user.email,
      message: 'Account registered. A 6-digit verification code has been sent to your email address.',
      data: user,
    };
  }

  async verifyEmail(dto: VerifyEmailDto, res: Response) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new BadRequestException('Invalid email or verification code');
    }

    if (user.isEmailVerified) {
      return {
        success: true,
        message: 'Email is already verified. Please sign in.',
      };
    }

    if (!user.emailVerificationOtpHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('No verification code requested or code has expired. Please request a new code.');
    }

    if (user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    if (user.emailVerificationAttempts >= 5) {
      throw new BadRequestException('Too many failed attempts. Please request a new verification code.');
    }

    const candidateHash = this.hashToken(dto.otp.trim());
    const storedHash = user.emailVerificationOtpHash;

    const isMatch =
      candidateHash.length === storedHash.length &&
      crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));

    if (!isMatch) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerificationAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid verification code');
    }

    // Atomic transaction: verify email, clear OTP fields, and link guest orders
    const { updatedUser, linkedCount } = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        data: {
          isEmailVerified: true,
          emailVerificationOtpHash: null,
          emailVerificationExpiresAt: null,
          emailVerificationAttempts: 0,
          emailVerificationLastSentAt: null,
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

      const linkResult = await tx.order.updateMany({
        where: {
          customerEmail: { equals: normalizedEmail, mode: 'insensitive' },
          userId: null,
        },
        data: {
          userId: u.id,
        },
      });

      return { updatedUser: u, linkedCount: linkResult.count };
    });

    this.logger.log(`Verified email for user ${updatedUser.id} (${normalizedEmail}) and linked ${linkedCount} guest order(s)`);

    // Issue session cookies upon successful email verification
    const accessToken = await this.generateAccessToken(updatedUser.id, updatedUser.email, updatedUser.role);
    const rawRefreshToken = await this.createRefreshTokenSession(updatedUser.id);
    this.setAuthCookies(res, accessToken, rawRefreshToken);

    return {
      success: true,
      message: 'Email verified successfully and account activated',
      linkedOrdersCount: linkedCount,
      data: updatedUser,
    };
  }

  async resendVerificationOtp(dto: ResendVerificationOtpDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return {
        success: true,
        message: 'If an unverified account exists for this email, a new verification code has been sent.',
      };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('This account is already verified. Please log in.');
    }

    if (user.emailVerificationLastSentAt) {
      const elapsedSeconds = Math.floor(
        (Date.now() - user.emailVerificationLastSentAt.getTime()) / 1000
      );
      const cooldownSeconds = 60;
      if (elapsedSeconds < cooldownSeconds) {
        throw new BadRequestException(
          `Please wait ${cooldownSeconds - elapsedSeconds} seconds before requesting a new code.`
        );
      }
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashToken(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationOtpHash: otpHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationAttempts: 0,
        emailVerificationLastSentAt: new Date(),
      },
    });

    await this.notificationsService.sendEmailVerificationOtp({
      email: user.email,
      name: user.name,
      otp,
    });

    return {
      success: true,
      message: 'A new verification code has been sent to your email address.',
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

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email address before signing in. Check your inbox for the verification code.');
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

    // Phase B: Safely link any guest orders matching this customer's email
    try {
      await this.prisma.order.updateMany({
        where: {
          customerEmail: { equals: dto.email, mode: 'insensitive' },
          userId: null,
        },
        data: {
          userId: user.id,
        },
      });
      this.logger.log(`Linked existing guest orders for email "${dto.email}" to user ${user.id}`);
    } catch (err: any) {
      this.logger.warn(`Could not link guest orders for "${dto.email}": ${err?.message}`);
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

  /**
   * Phase 2: Dedicated Administrator Login.
   * Restricts authentication strictly to administrative roles (ADMIN, MANAGER, STAFF).
   * Verifies password, enforces brute-force lockout, ensures active status, and sets secure auth cookies.
   */
  async adminLogin(dto: AdminLoginDto, res: Response) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Equalize timing if user not found
    if (!user || !user.passwordHash) {
      await bcrypt.compare(dto.password, '$2b$12$e80iA4gqT3cRk7/2E8tq7uB7iR/g5zG6e3P3q7G8p9y1z2w3e4r5t');
      throw new UnauthorizedException('Invalid administrative email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account has been deactivated. Please contact an administrator.');
    }

    // Role check: Only administrative roles permitted
    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
    if (!adminRoles.includes(user.role)) {
      throw new ForbiddenException('Access denied: administrative privileges required');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Administrator account is temporarily locked due to multiple failed login attempts.');
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

      throw new UnauthorizedException('Invalid administrative email or password');
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

    this.logger.log(`Admin logged in successfully: ${user.email} (${user.role})`);

    return {
      success: true,
      message: 'Administrator logged in successfully',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  /**
   * Phase 2: Verify an administrator invitation token.
   */
  async verifyInvitation(token: string) {
    if (!token) {
      throw new BadRequestException('Invitation token is required');
    }
    const tokenHash = this.hashToken(token.trim());
    const invitation = await this.prisma.adminInvitation.findUnique({
      where: { tokenHash },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or invalid token');
    }

    if (invitation.usedAt) {
      throw new BadRequestException('This invitation has already been used and activated');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('This invitation has expired. Please request a new invitation from an administrator.');
    }

    return {
      success: true,
      data: {
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        invitedBy: invitation.invitedBy?.name || 'Administrator',
      },
    };
  }

  /**
   * Phase 3: Accept administrator invitation and establish secure password.
   * Acquires the advisory lock FIRST, re-fetches invitation & dynamic role,
   * preserves atomic updateMany conditional protection, and issues cookies only after commit.
   */
  async acceptInvitation(dto: AcceptInvitationDto, res: Response) {
    const tokenHash = this.hashToken(dto.token.trim());
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    // Pre-generate raw refresh token and its SHA-256 hash
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const refreshExpiresAt = new Date(Date.now() + this.refreshExpiresDays * 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      // 1. FIRST STATEMENT: Acquire mutual exclusion lock unconditionally
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      // 2. Re-fetch invitation and its assigned role AFTER acquiring lock
      const invitation = await tx.adminInvitation.findUnique({
        where: { tokenHash },
        include: { roleRelation: true },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found or invalid token');
      }

      if (invitation.usedAt) {
        throw new ConflictException('This invitation has already been used');
      }

      if (invitation.expiresAt < new Date()) {
        throw new BadRequestException('This invitation has expired. Please request a new invitation from an administrator.');
      }

      // Verify assigned dynamic role is active if present
      if (invitation.roleRelation && !invitation.roleRelation.isActive) {
        throw new BadRequestException('The role assigned to this invitation has been deactivated.');
      }

      // 3. Atomic conditional consumption: guarantees exactly one concurrent request can consume the invitation
      const updateResult = await tx.adminInvitation.updateMany({
        where: {
          id: invitation.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('This invitation has already been accepted or has expired.');
      }

      // 4. Find or create user account with authoritative ADMIN role and assigned dynamic roleId
      const existingUser = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      let updatedOrCreatedUser;
      if (existingUser) {
        updatedOrCreatedUser = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            name: invitation.name,
            phone: invitation.phone || existingUser.phone,
            role: UserRole.ADMIN,
            roleId: invitation.roleId,
            passwordHash,
            isActive: true,
            isEmailVerified: true,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            roleId: true,
            isActive: true,
          },
        });
      } else {
        updatedOrCreatedUser = await tx.user.create({
          data: {
            email: invitation.email,
            name: invitation.name,
            phone: invitation.phone,
            role: UserRole.ADMIN,
            roleId: invitation.roleId,
            passwordHash,
            isActive: true,
            isEmailVerified: true,
          },
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            roleId: true,
            isActive: true,
          },
        });
      }

      // 5. Persist hashed refresh-token record inside the same transaction
      await tx.refreshToken.create({
        data: {
          userId: updatedOrCreatedUser.id,
          tokenHash: refreshTokenHash,
          expiresAt: refreshExpiresAt,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_INVITATION_ACCEPTED',
          entityType: 'user',
          entityId: updatedOrCreatedUser.id,
          description: `Administrator invitation accepted for ${invitation.email} with dynamic role ${invitation.roleRelation?.name || invitation.role}`,
          userId: updatedOrCreatedUser.id,
        },
      });

      return updatedOrCreatedUser;
    });

    // 6. Generate access token and issue cookies strictly AFTER transaction commit
    const accessToken = await this.generateAccessToken(user.id, user.email, user.role);
    this.setAuthCookies(res, accessToken, rawRefreshToken);

    this.logger.log(`Administrator account activated via invitation: ${user.email} (${user.role})`);

    return {
      success: true,
      message: 'Administrator account successfully activated',
      data: user,
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
        roleId: true,
        assignedRole: {
          select: {
            id: true,
            name: true,
            slug: true,
            isSystem: true,
            isActive: true,
            permissions: {
              select: {
                permission: {
                  select: {
                    key: true,
                    displayName: true,
                    category: true,
                  },
                },
              },
            },
          },
        },
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
