import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterController } from './newsletter.controller';
import { AdminNewsletterController } from './admin-newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { NewsletterSubscriberStatus } from '../../generated/prisma';

describe('NewsletterControllers (Phase 15.6)', () => {
  let publicController: NewsletterController;
  let adminController: AdminNewsletterController;
  let service: any;

  beforeEach(async () => {
    service = {
      subscribe: vi.fn().mockResolvedValue({
        success: true,
        message: 'If your email is valid, a verification link has been sent.',
      }),
      verify: vi.fn().mockResolvedValue({
        success: true,
        message: 'Your email address has been successfully verified!',
      }),
      resendVerification: vi.fn().mockResolvedValue({
        success: true,
        message: 'If eligible, a new confirmation link has been sent.',
      }),
      getUnsubscribeInfo: vi.fn().mockResolvedValue({
        maskedEmail: 't***t@dsl.lk',
        status: NewsletterSubscriberStatus.VERIFIED,
        isUnsubscribed: false,
      }),
      unsubscribe: vi.fn().mockResolvedValue({
        success: true,
        message: 'You have been successfully unsubscribed.',
      }),
      getAdminSubscribers: vi.fn().mockResolvedValue({
        items: [],
        pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 1 },
        counts: { total: 0, verified: 0, pending: 0, unsubscribed: 0 },
      }),
      getAdminSubscriberById: vi.fn().mockResolvedValue({
        id: 'sub-1',
        email: 'test@dsl.lk',
        status: NewsletterSubscriberStatus.VERIFIED,
      }),
      getAdminConsentHistory: vi.fn().mockResolvedValue({
        subscriberId: 'sub-1',
        email: 'test@dsl.lk',
        events: [],
      }),
      exportEligibleSubscribersCsv: vi.fn().mockResolvedValue('email,subscription_status\n'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewsletterController, AdminNewsletterController],
      providers: [{ provide: NewsletterService, useValue: service }],
    }).compile();

    publicController = module.get<NewsletterController>(NewsletterController);
    adminController = module.get<AdminNewsletterController>(AdminNewsletterController);
  });

  describe('Public Newsletter Endpoints', () => {
    it('POST /subscribe forwards valid DTO and wraps in standard API envelope', async () => {
      const res = await publicController.subscribe({
        email: 'customer@dsl.lk',
        consent: true,
        source: 'WEBSITE_FOOTER',
        consentTextVersion: 'v1.0',
      });

      expect(res.success).toBe(true);
      expect(res.message).toBe('If your email is valid, a verification link has been sent.');
      expect(service.subscribe).toHaveBeenCalledWith({
        email: 'customer@dsl.lk',
        consent: true,
        source: 'WEBSITE_FOOTER',
        consentTextVersion: 'v1.0',
      });
    });

    it('GET /verify calls service with token query and returns verified status', async () => {
      const res = await publicController.verify({ token: 'raw-token-123' });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ verified: true });
      expect(service.verify).toHaveBeenCalledWith('raw-token-123');
    });

    it('POST /resend-verification calls service with email', async () => {
      const res = await publicController.resendVerification({ email: 'pending@dsl.lk' });
      expect(res.success).toBe(true);
      expect(service.resendVerification).toHaveBeenCalledWith({ email: 'pending@dsl.lk' });
    });

    it('GET /unsubscribe returns masked info', async () => {
      const res = await publicController.getUnsubscribeInfo({ token: 'unsub-tok' });
      expect(res.success).toBe(true);
      expect(res.data.maskedEmail).toBe('t***t@dsl.lk');
    });

    it('POST /unsubscribe unsubscribes subscriber', async () => {
      const res = await publicController.unsubscribe({ token: 'unsub-tok' });
      expect(res.success).toBe(true);
      expect(res.data).toEqual({ unsubscribed: true });
    });
  });

  describe('Admin Newsletter Endpoints', () => {
    it('GET /admin/newsletter/subscribers passes query params and returns response', async () => {
      const res = await adminController.getSubscribers({
        page: 1,
        limit: 20,
        status: 'ALL',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(res.success).toBe(true);
      expect(service.getAdminSubscribers).toHaveBeenCalled();
    });

    it('GET /admin/newsletter/subscribers/:id returns single subscriber', async () => {
      const res = await adminController.getSubscriberById('sub-1');
      expect(res.success).toBe(true);
      expect(res.data.id).toBe('sub-1');
      expect(service.getAdminSubscriberById).toHaveBeenCalledWith('sub-1');
    });

    it('GET /admin/newsletter/subscribers/:id/consent-history returns consent log', async () => {
      const res = await adminController.getConsentHistory('sub-1');
      expect(res.success).toBe(true);
      expect(service.getAdminConsentHistory).toHaveBeenCalledWith('sub-1');
    });

    it('GET /admin/newsletter/export sets CSV headers and sends CSV payload', async () => {
      const mockRes = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        send: vi.fn(),
      } as any;

      await adminController.exportCsv(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('.csv'));
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalledWith('email,subscription_status\n');
    });
  });
});

