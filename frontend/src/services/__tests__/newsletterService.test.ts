import { describe, it, expect, vi, beforeEach } from 'vitest';
import { newsletterService } from '../newsletterService';
import { apiClient } from '@/lib/api/apiClient';

describe('newsletterService (Phase 15.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Public Newsletter Operations', () => {
    it('subscribe() sends POST request with normalized payload', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: null,
        message: 'If your email is valid, a verification link has been sent.',
      });

      const res = await newsletterService.subscribe('customer@dsl.lk', true, 'WEBSITE_FOOTER');

      expect(postSpy).toHaveBeenCalledWith('newsletter/subscribe', {
        email: 'customer@dsl.lk',
        consent: true,
        source: 'WEBSITE_FOOTER',
      });
      expect(res.success).toBe(true);
      expect(res.message).toContain('verification link');
    });

    it('verify() sends GET request with token query param', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: { verified: true },
        message: 'Your email address has been successfully verified!',
      });

      const res = await newsletterService.verify('raw-token-123');

      expect(getSpy).toHaveBeenCalledWith('newsletter/verify', {
        params: { token: 'raw-token-123' },
      });
      expect(res.success).toBe(true);
    });

    it('resendVerification() sends POST request with email', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: null,
        message: 'If eligible, a new confirmation link has been sent.',
      });

      const res = await newsletterService.resendVerification('pending@dsl.lk');

      expect(postSpy).toHaveBeenCalledWith('newsletter/resend-verification', {
        email: 'pending@dsl.lk',
      });
      expect(res.success).toBe(true);
    });

    it('getUnsubscribeInfo() retrieves masked email and status by token', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {
          maskedEmail: 'c***r@dsl.lk',
          status: 'VERIFIED',
          isUnsubscribed: false,
        },
      });

      const res = await newsletterService.getUnsubscribeInfo('unsub-tok-xyz');

      expect(getSpy).toHaveBeenCalledWith('newsletter/unsubscribe', {
        params: { token: 'unsub-tok-xyz' },
      });
      expect(res.maskedEmail).toBe('c***r@dsl.lk');
      expect(res.isUnsubscribed).toBe(false);
    });

    it('unsubscribe() sends POST request with token', async () => {
      const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
        success: true,
        data: { unsubscribed: true },
        message: 'You have been successfully unsubscribed.',
      });

      const res = await newsletterService.unsubscribe('unsub-tok-xyz');

      expect(postSpy).toHaveBeenCalledWith('newsletter/unsubscribe', {
        token: 'unsub-tok-xyz',
      });
      expect(res.success).toBe(true);
    });
  });

  describe('Admin Operations', () => {
    it('getAdminSubscribers() queries with filters and pagination', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {
          items: [
            {
              id: 'sub-1',
              email: 'verified@dsl.lk',
              status: 'VERIFIED',
              consentGivenAt: '2026-11-06T10:00:00Z',
              consentSource: 'WEBSITE_FOOTER',
              consentTextVersion: 'v1.0',
              verifiedAt: '2026-11-06T10:05:00Z',
              createdAt: '2026-11-06T10:00:00Z',
              updatedAt: '2026-11-06T10:05:00Z',
            },
          ],
          pagination: {
            page: 1,
            limit: 20,
            totalItems: 1,
            totalPages: 1,
            hasNextPage: false,
            hasPreviousPage: false,
          },
          counts: {
            total: 1,
            verified: 1,
            pending: 0,
            unsubscribed: 0,
          },
        },
      });

      const res = await newsletterService.getAdminSubscribers({
        page: 1,
        limit: 20,
        status: 'VERIFIED',
        search: 'dsl.lk',
      });

      expect(getSpy).toHaveBeenCalledWith('admin/newsletter/subscribers', {
        params: {
          page: 1,
          limit: 20,
          status: 'VERIFIED',
          search: 'dsl.lk',
        },
      });
      expect(res.items.length).toBe(1);
      expect(res.counts.verified).toBe(1);
    });

    it('getAdminConsentHistory() retrieves chronological consent events', async () => {
      const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
        success: true,
        data: {
          subscriberId: 'sub-1',
          email: 'verified@dsl.lk',
          events: [
            {
              id: 'evt-1',
              subscriberId: 'sub-1',
              eventType: 'CONSENT_GIVEN',
              consentTextVersion: 'v1.0',
              consentSource: 'WEBSITE_FOOTER',
              createdAt: '2026-11-06T10:00:00Z',
            },
          ],
        },
      });

      const res = await newsletterService.getAdminConsentHistory('sub-1');

      expect(getSpy).toHaveBeenCalledWith('admin/newsletter/subscribers/sub-1/consent-history');
      expect(res.events.length).toBe(1);
      expect(res.events[0].eventType).toBe('CONSENT_GIVEN');
    });

    it('downloadExportCsv() creates blob and triggers file download in browser', async () => {
      vi.spyOn(apiClient, 'get').mockResolvedValue(
        'email,subscription_status\nuser@dsl.lk,VERIFIED\n'
      );

      // Mock DOM methods
      const clickSpy = vi.fn();
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
      vi.spyOn(document, 'createElement').mockReturnValue({
        setAttribute: vi.fn(),
        click: clickSpy,
      } as any);

      global.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-blob');
      global.URL.revokeObjectURL = vi.fn();

      await newsletterService.downloadExportCsv();

      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
    });
  });
});

