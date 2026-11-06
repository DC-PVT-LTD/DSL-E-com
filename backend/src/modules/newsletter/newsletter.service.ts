import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NewsletterSubscriberStatus,
  NewsletterConsentEventType,
} from '../../generated/prisma';
import {
  SubscribeNewsletterDto,
  ResendVerificationDto,
  QuerySubscribersDto,
} from './dto/newsletter.dto';

export function sanitizeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '""';
  }
  let str = String(value);

  // Prevent Spreadsheet Formula Injection (CSV injection)
  // If the string starts with =, +, -, @, tab (\t), or carriage return (\r), prepend a single quote
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape existing double quotes by doubling them
  str = str.replace(/"/g, '""');

  return `"${str}"`;
}

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
    @Inject(ConfigService)
    private readonly configService: ConfigService
  ) {}

  /**
   * Normalizes an email address to lowercase and trimmed.
   */
  normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Masks an email address for privacy (e.g. s***n@example.com).
   */
  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***';
    if (local.length <= 2) {
      return `${local[0] || '*'}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }

  /**
   * Hashes a raw verification token using SHA-256.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token.trim()).digest('hex');
  }

  /**
   * Customer newsletter subscription (Double Opt-in flow).
   */
  async subscribe(dto: SubscribeNewsletterDto): Promise<{ success: boolean; message: string }> {
    const email = this.normalizeEmail(dto.email);

    if (!dto.consent) {
      throw new BadRequestException('Affirmative consent is required to subscribe to the newsletter.');
    }

    const consentSource = dto.source || 'WEBSITE_FOOTER';
    const consentTextVersion = dto.consentTextVersion || 'v1.0';
    const expiryHours = Number(this.configService.get<number>('NEWSLETTER_VERIFICATION_EXPIRY_HOURS', 24));
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');

    // Check for existing subscriber
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    // 1. If already VERIFIED, do not leak subscriber existence or duplicate token
    if (existing && existing.status === NewsletterSubscriberStatus.VERIFIED) {
      this.logger.log(`[NEWSLETTER] Subscription request for already verified subscriber ${this.maskEmail(email)}`);
      return {
        success: true,
        message: 'If your email is valid, a verification link has been sent to confirm your subscription.',
      };
    }

    // Generate cryptographically secure verification token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
    const verificationUrl = `${frontendUrl}/newsletter/verify?token=${rawToken}`;

    if (existing) {
      const isResubscription = existing.status === NewsletterSubscriberStatus.UNSUBSCRIBED;

      await this.prisma.$transaction(async (tx) => {
        // Invalidate old unexpired tokens
        await tx.newsletterVerificationToken.updateMany({
          where: {
            subscriberId: existing.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            usedAt: new Date(),
          },
        });

        // Update subscriber record
        await tx.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            status: NewsletterSubscriberStatus.PENDING,
            consentGivenAt: new Date(),
            consentSource,
            consentTextVersion,
            unsubscribedAt: null,
          },
        });

        // Create new verification token
        await tx.newsletterVerificationToken.create({
          data: {
            subscriberId: existing.id,
            tokenHash,
            expiresAt,
          },
        });

        // Record consent event
        await tx.newsletterConsentEvent.create({
          data: {
            subscriberId: existing.id,
            eventType: isResubscription
              ? NewsletterConsentEventType.RESUBSCRIPTION_REQUESTED
              : NewsletterConsentEventType.CONSENT_GIVEN,
            consentSource,
            consentTextVersion,
            metadata: {
              source: consentSource,
              isResubscription,
            },
          },
        });
      });

      this.logger.log(`[NEWSLETTER] ${isResubscription ? 'Resubscription' : 'Subscription'} pending verification for ${this.maskEmail(email)}`);
    } else {
      // New subscriber record
      const unsubscribeToken = crypto.randomBytes(24).toString('hex');

      await this.prisma.$transaction(async (tx) => {
        const subscriber = await tx.newsletterSubscriber.create({
          data: {
            email,
            status: NewsletterSubscriberStatus.PENDING,
            consentGivenAt: new Date(),
            consentSource,
            consentTextVersion,
            unsubscribeToken,
          },
        });

        await tx.newsletterVerificationToken.create({
          data: {
            subscriberId: subscriber.id,
            tokenHash,
            expiresAt,
          },
        });

        await tx.newsletterConsentEvent.create({
          data: {
            subscriberId: subscriber.id,
            eventType: NewsletterConsentEventType.CONSENT_GIVEN,
            consentSource,
            consentTextVersion,
            metadata: {
              source: consentSource,
            },
          },
        });
      });

      this.logger.log(`[NEWSLETTER] New subscriber created in PENDING state for ${this.maskEmail(email)}`);
    }

    // Send verification email via NotificationsService
    try {
      await this.notificationsService.sendNewsletterVerificationEmail({
        email,
        verificationUrl,
        expiresHours: expiryHours,
      });
    } catch (err) {
      this.logger.error(`[NEWSLETTER] Failed to dispatch verification email to ${this.maskEmail(email)}: ${(err as Error).message}`);
    }

    return {
      success: true,
      message: 'If your email is valid, a verification link has been sent to confirm your subscription.',
    };
  }

  /**
   * Verifies a double opt-in verification token.
   */
  async verify(token: string): Promise<{ success: boolean; message: string }> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new BadRequestException('Verification token is required.');
    }

    const tokenHash = this.hashToken(token);

    // Look up token by hash
    const verificationToken = await this.prisma.newsletterVerificationToken.findUnique({
      where: { tokenHash },
      include: { subscriber: true },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid verification token.');
    }

    if (verificationToken.usedAt !== null) {
      throw new BadRequestException('This verification link has already been used. Please request a new verification email if needed.');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('This verification link has expired. Please request a new verification link.');
    }

    const { subscriber } = verificationToken;

    // Atomic update
    await this.prisma.$transaction(async (tx) => {
      // Mark token used
      await tx.newsletterVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });

      // Update subscriber to VERIFIED
      await tx.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          status: NewsletterSubscriberStatus.VERIFIED,
          verifiedAt: new Date(),
        },
      });

      // Record consent event
      await tx.newsletterConsentEvent.create({
        data: {
          subscriberId: subscriber.id,
          eventType: NewsletterConsentEventType.EMAIL_VERIFIED,
          consentSource: subscriber.consentSource,
          consentTextVersion: subscriber.consentTextVersion,
          metadata: {
            verifiedAt: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(`[NEWSLETTER] Subscriber verified successfully: ${this.maskEmail(subscriber.email)}`);

    return {
      success: true,
      message: 'Your email address has been successfully verified! You are now subscribed to the DSL Stationery newsletter.',
    };
  }

  /**
   * Resends a verification email for pending subscribers.
   */
  async resendVerification(dto: ResendVerificationDto): Promise<{ success: boolean; message: string }> {
    const email = this.normalizeEmail(dto.email);
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
      include: {
        verificationTokens: {
          where: { usedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Check if subscriber exists and is in PENDING state
    if (subscriber && subscriber.status === NewsletterSubscriberStatus.PENDING) {
      const latestToken = subscriber.verificationTokens[0];
      const now = Date.now();

      // Rate limit: minimum 60 seconds between verification dispatches
      if (latestToken && now - latestToken.createdAt.getTime() < 60000) {
        throw new HttpException(
          'Please wait at least 60 seconds before requesting another verification email.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      const expiryHours = Number(this.configService.get<number>('NEWSLETTER_VERIFICATION_EXPIRY_HOURS', 24));
      const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000').replace(/\/$/, '');

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = this.hashToken(rawToken);
      const expiresAt = new Date(now + expiryHours * 60 * 60 * 1000);
      const verificationUrl = `${frontendUrl}/newsletter/verify?token=${rawToken}`;

      await this.prisma.$transaction(async (tx) => {
        // Invalidate old unexpired tokens
        await tx.newsletterVerificationToken.updateMany({
          where: {
            subscriberId: subscriber.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { usedAt: new Date() },
        });

        // Create new token
        await tx.newsletterVerificationToken.create({
          data: {
            subscriberId: subscriber.id,
            tokenHash,
            expiresAt,
          },
        });
      });

      try {
        await this.notificationsService.sendNewsletterVerificationEmail({
          email,
          verificationUrl,
          expiresHours: expiryHours,
        });
      } catch (err) {
        this.logger.error(`[NEWSLETTER] Failed to resend verification email: ${(err as Error).message}`);
      }
    }

    // Always generic response to prevent email probing
    return {
      success: true,
      message: 'If your email is awaiting verification, a new confirmation link has been sent.',
    };
  }

  /**
   * Retrieves public unsubscribe status by unsubscribe token.
   */
  async getUnsubscribeInfo(token: string): Promise<{
    maskedEmail: string;
    status: NewsletterSubscriberStatus;
    isUnsubscribed: boolean;
  }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Unsubscribe token is required.');
    }

    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token.trim() },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe link.');
    }

    return {
      maskedEmail: this.maskEmail(subscriber.email),
      status: subscriber.status,
      isUnsubscribed: subscriber.status === NewsletterSubscriberStatus.UNSUBSCRIBED,
    };
  }

  /**
   * Processes unsubscribe request (idempotent).
   */
  async unsubscribe(token: string): Promise<{ success: boolean; message: string }> {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Unsubscribe token is required.');
    }

    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { unsubscribeToken: token.trim() },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid unsubscribe token.');
    }

    // Idempotent: if already unsubscribed, return success
    if (subscriber.status === NewsletterSubscriberStatus.UNSUBSCRIBED) {
      return {
        success: true,
        message: 'You have already been unsubscribed from the DSL Stationery newsletter.',
      };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          status: NewsletterSubscriberStatus.UNSUBSCRIBED,
          unsubscribedAt: new Date(),
        },
      });

      await tx.newsletterConsentEvent.create({
        data: {
          subscriberId: subscriber.id,
          eventType: NewsletterConsentEventType.UNSUBSCRIBED,
          consentSource: 'UNSUBSCRIBE_LINK',
          consentTextVersion: subscriber.consentTextVersion,
          metadata: {
            unsubscribedAt: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(`[NEWSLETTER] Subscriber unsubscribed: ${this.maskEmail(subscriber.email)}`);

    return {
      success: true,
      message: 'You have been successfully unsubscribed. You will no longer receive promotional emails.',
    };
  }

  /**
   * Admin: Get paginated subscribers with filters and status breakdown.
   */
  async getAdminSubscribers(query: QuerySubscribersDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as NewsletterSubscriberStatus;
    }

    if (query.search && query.search.trim().length > 0) {
      where.email = {
        contains: query.search.trim().toLowerCase(),
        mode: 'insensitive',
      };
    }

    const orderBy: any = {};
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    orderBy[sortField] = sortOrder;

    const [items, totalItems, statusCounts] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          email: true,
          status: true,
          consentGivenAt: true,
          consentSource: true,
          consentTextVersion: true,
          verifiedAt: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const counts = {
      total: 0,
      verified: 0,
      pending: 0,
      unsubscribed: 0,
    };

    for (const group of statusCounts) {
      const count = group._count._all;
      counts.total += count;
      if (group.status === NewsletterSubscriberStatus.VERIFIED) counts.verified = count;
      if (group.status === NewsletterSubscriberStatus.PENDING) counts.pending = count;
      if (group.status === NewsletterSubscriberStatus.UNSUBSCRIBED) counts.unsubscribed = count;
    }

    const totalPages = Math.ceil(totalItems / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      counts,
    };
  }

  /**
   * Admin: Get single subscriber with recent tokens and consent events.
   */
  async getAdminSubscriberById(id: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { id },
      include: {
        consentEvents: {
          orderBy: { createdAt: 'desc' },
        },
        verificationTokens: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
            // tokenHash is strictly excluded from response
          },
        },
      },
    });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID "${id}" was not found.`);
    }

    const { unsubscribeToken, ...safeSubscriber } = subscriber;
    return safeSubscriber;
  }

  /**
   * Admin: Get consent history for a subscriber.
   */
  async getAdminConsentHistory(id: string) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID "${id}" was not found.`);
    }

    const events = await this.prisma.newsletterConsentEvent.findMany({
      where: { subscriberId: id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      subscriberId: subscriber.id,
      email: subscriber.email,
      events,
    };
  }

  /**
   * Admin: Export eligible subscribers as CSV.
   * Only includes subscribers where:
   * - status is VERIFIED
   * - unsubscribedAt is null
   * - explicit consent timestamp is recorded
   */
  async exportEligibleSubscribersCsv(): Promise<string> {
    const eligibleSubscribers = await this.prisma.newsletterSubscriber.findMany({
      where: {
        status: NewsletterSubscriberStatus.VERIFIED,
        unsubscribedAt: null,
        consentGivenAt: { not: undefined },
      },
      orderBy: { consentGivenAt: 'desc' },
      select: {
        email: true,
        status: true,
        consentGivenAt: true,
        verifiedAt: true,
        consentSource: true,
        consentTextVersion: true,
      },
    });

    const headers = [
      'email',
      'subscription_status',
      'consent_given_at',
      'verified_at',
      'consent_source',
      'consent_text_version',
    ];

    const rows = [headers.join(',')];

    for (const sub of eligibleSubscribers) {
      const row = [
        sanitizeCsvField(sub.email),
        sanitizeCsvField(sub.status),
        sanitizeCsvField(sub.consentGivenAt ? sub.consentGivenAt.toISOString() : ''),
        sanitizeCsvField(sub.verifiedAt ? sub.verifiedAt.toISOString() : ''),
        sanitizeCsvField(sub.consentSource),
        sanitizeCsvField(sub.consentTextVersion),
      ];
      rows.push(row.join(','));
    }

    return rows.join('\r\n');
  }
}

