import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { VerificationChallengeStatus } from '../../generated/prisma';
import { CreateChallengeDto, ConfirmChallengeDto } from './dto/security.dto';

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***@***.***';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);
  private readonly secret = process.env.JWT_SECRET || 'dsl-stationery-super-admin-verification-secret';

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
  ) {}

  private hashCode(code: string): string {
    return crypto.createHmac('sha256', this.secret).update(code.trim()).digest('hex');
  }

  private generateVerificationToken(challengeId: string, userId: string, action: string): string {
    const payload = `${challengeId}:${userId}:${action}:${Date.now()}`;
    const sig = crypto.createHmac('sha256', this.secret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${sig}`).toString('base64');
  }

  /**
   * Creates a new 6-digit double verification challenge, hashes the OTP,
   * stores it with a 5-minute expiration, and emails it to the user.
   */
  async createChallenge(userId: string, dto: CreateChallengeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { assignedRole: true },
    });

    if (!user || !user.isActive) {
      throw new ForbiddenException('Active administrative account required.');
    }

    // Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const challenge = await this.prisma.verificationChallenge.create({
      data: {
        userId: user.id,
        action: dto.action,
        codeHash,
        resourceType: dto.resourceType || null,
        resourceId: dto.resourceId || null,
        metadata: dto.metadata || {},
        attempts: 0,
        maxAttempts: 3,
        status: VerificationChallengeStatus.PENDING,
        expiresAt,
      },
    });

    // Dispatch verification code via email
    await this.notificationsService.sendSecurityVerificationOtp({
      email: user.email,
      name: user.name,
      action: dto.action,
      code,
      expiresMinutes: 5,
    });

    this.logger.log(
      `[SECURITY CHALLENGE CREATED] ChallengeId: ${challenge.id} | Action: "${dto.action}" | User: ${maskEmail(user.email)}`,
    );

    return {
      challengeId: challenge.id,
      action: challenge.action,
      expiresAt: challenge.expiresAt,
      emailMasked: maskEmail(user.email),
      maxAttempts: challenge.maxAttempts,
      message: `Verification code sent to ${maskEmail(user.email)}. It expires in 5 minutes.`,
    };
  }

  /**
   * Confirms a 6-digit OTP code against the challenge.
   * Enforces 5-minute expiration, max 3 attempts, and single-use consumption.
   */
  async confirmChallenge(userId: string, dto: ConfirmChallengeDto) {
    const challenge = await this.prisma.verificationChallenge.findUnique({
      where: { id: dto.challengeId },
    });

    if (!challenge) {
      throw new NotFoundException('Verification challenge not found.');
    }

    if (challenge.userId !== userId) {
      throw new ForbiddenException('Challenge belongs to another administrator.');
    }

    if (challenge.status === VerificationChallengeStatus.CONSUMED) {
      throw new BadRequestException('Verification code has already been used.');
    }

    if (challenge.status === VerificationChallengeStatus.FAILED) {
      throw new BadRequestException('Verification challenge has failed due to excessive attempts. Please request a new code.');
    }

    if (new Date() > challenge.expiresAt || challenge.status === VerificationChallengeStatus.EXPIRED) {
      if (challenge.status !== VerificationChallengeStatus.EXPIRED) {
        await this.prisma.verificationChallenge.update({
          where: { id: challenge.id },
          data: { status: VerificationChallengeStatus.EXPIRED },
        });
      }
      throw new BadRequestException('Verification code has expired. Please request a new code.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      await this.prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: { status: VerificationChallengeStatus.FAILED },
      });
      throw new BadRequestException('Maximum verification attempts exceeded. Challenge invalidated.');
    }

    const providedHash = this.hashCode(dto.code);
    if (providedHash !== challenge.codeHash) {
      const nextAttempts = challenge.attempts + 1;
      const isFailed = nextAttempts >= challenge.maxAttempts;

      await this.prisma.verificationChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: nextAttempts,
          status: isFailed ? VerificationChallengeStatus.FAILED : challenge.status,
        },
      });

      const remaining = Math.max(0, challenge.maxAttempts - nextAttempts);
      throw new BadRequestException(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Invalid verification code. Maximum attempts exceeded. Challenge invalidated.',
      );
    }

    // Code matches — mark as verified and issue single-use token
    const token = this.generateVerificationToken(challenge.id, userId, challenge.action);
    await this.prisma.verificationChallenge.update({
      where: { id: challenge.id },
      data: {
        status: VerificationChallengeStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(`[SECURITY CHALLENGE VERIFIED] ChallengeId: ${challenge.id} | Action: "${challenge.action}"`);

    return {
      verified: true,
      challengeId: challenge.id,
      action: challenge.action,
      verificationToken: token,
      message: 'Step-up security double verification successful.',
    };
  }

  /**
   * Consumes a verified challenge to prevent replay attacks.
   */
  async consumeChallenge(challengeId: string) {
    const challenge = await this.prisma.verificationChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) return false;
    if (challenge.status !== VerificationChallengeStatus.VERIFIED) return false;

    await this.prisma.verificationChallenge.update({
      where: { id: challengeId },
      data: {
        status: VerificationChallengeStatus.CONSUMED,
        consumedAt: new Date(),
      },
    });

    this.logger.log(`[SECURITY CHALLENGE CONSUMED] ChallengeId: ${challengeId}`);
    return true;
  }

  /**
   * Validates and consumes a verification challenge or token.
   */
  async validateAndConsume(challengeId: string, userId: string, action?: string): Promise<boolean> {
    const challenge = await this.prisma.verificationChallenge.findUnique({
      where: { id: challengeId },
    });

    if (!challenge) return false;
    if (challenge.userId !== userId) return false;
    if (challenge.status !== VerificationChallengeStatus.VERIFIED) return false;
    if (action && challenge.action !== action) return false;

    await this.prisma.verificationChallenge.update({
      where: { id: challengeId },
      data: {
        status: VerificationChallengeStatus.CONSUMED,
        consumedAt: new Date(),
      },
    });

    return true;
  }

  /**
   * Lists verification challenges with pagination and filtering for Super Admin.
   */
  async listChallenges(query: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status && query.status !== 'ALL') {
      where.status = query.status;
    }
    if (query.search?.trim()) {
      where.OR = [
        { action: { contains: query.search.trim(), mode: 'insensitive' } },
        { user: { name: { contains: query.search.trim(), mode: 'insensitive' } } },
        { user: { email: { contains: query.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.verificationChallenge.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              assignedRole: { select: { slug: true, name: true } },
            },
          },
        },
      }),
      this.prisma.verificationChallenge.count({ where }),
    ]);

    return {
      data: items.map((it) => ({
        id: it.id,
        action: it.action,
        status: it.status,
        resourceType: it.resourceType,
        resourceId: it.resourceId,
        metadata: it.metadata,
        attempts: it.attempts,
        maxAttempts: it.maxAttempts,
        expiresAt: it.expiresAt,
        verifiedAt: it.verifiedAt,
        consumedAt: it.consumedAt,
        createdAt: it.createdAt,
        user: {
          id: it.user.id,
          name: it.user.name,
          email: maskEmail(it.user.email),
          role: it.user.role,
          roleName: it.user.assignedRole?.name || null,
        },
      })),
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }
}

