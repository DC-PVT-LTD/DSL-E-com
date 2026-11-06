import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotificationsService,
  DefiniteDeliveryException,
  UncertainDeliveryTimeoutException,
} from './notifications.service';
import { ConfigService } from '@nestjs/config';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let configServiceMock: any;

  beforeEach(() => {
    configServiceMock = {
      get: vi.fn().mockImplementation((key: string, defaultVal: any) => defaultVal),
    };
    service = new NotificationsService(configServiceMock);
  });

  describe('sendBackInStockAlert', () => {
    it('successfully dispatches a back-in-stock alert and returns messageId', async () => {
      const result = await service.sendBackInStockAlert({
        customerName: 'Saman Kumara',
        customerEmail: 'saman@example.com',
        productName: 'Atlas CR Book 80 Pgs',
        productSlug: 'atlas-cr-book-80-pgs',
        priceCents: 18500,
        idempotencyKey: 'bis-alert-123-attempt-1',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toContain('msg-bis-atlas-cr-book-80-pgs');
    });

    it('instantiates and distinguishes custom delivery exceptions correctly', () => {
      const definiteErr = new DefiniteDeliveryException('Recipient mailbox inactive', { code: 550 });
      expect(definiteErr.isDefiniteFailure).toBe(true);
      expect(definiteErr.message).toBe('Recipient mailbox inactive');
      expect(definiteErr.name).toBe('DefiniteDeliveryException');
      expect(definiteErr.details).toEqual({ code: 550 });

      const uncertainErr = new UncertainDeliveryTimeoutException('Connection timed out after socket flush', { timeoutMs: 10000 });
      expect(uncertainErr.isUncertainTimeout).toBe(true);
      expect(uncertainErr.message).toBe('Connection timed out after socket flush');
      expect(uncertainErr.name).toBe('UncertainDeliveryTimeoutException');
      expect(uncertainErr.details).toEqual({ timeoutMs: 10000 });
    });
  });
});

