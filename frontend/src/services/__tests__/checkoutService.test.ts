import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkoutService } from '../checkoutService';
import { apiClient } from '@/lib/api/apiClient';

describe('checkoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an all-or-nothing 10-minute stock reservation', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        reservationId: 'res-abc-123',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        expiresInSeconds: 600,
        items: [
          {
            id: 'it-1',
            productId: 'p-1',
            variantId: null,
            productName: 'Atlas Pen',
            variantName: null,
            quantity: 2,
            unitPriceCents: 15000,
            totalPriceCents: 30000,
            stockQuantity: 20,
          },
        ],
      },
    });

    const res = await checkoutService.createReservation({
      items: [{ productId: 'p-1', quantity: 2 }],
      idempotencyKey: 'test-key-1',
    });

    expect(res.reservationId).toBe('res-abc-123');
    expect(res.status).toBe('ACTIVE');
    expect(res.expiresInSeconds).toBe(600);
    expect(res.items.length).toBe(1);
  });

  it('validates pre-pay authoritatively before initiating payment', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        isValid: true,
        reservationId: 'res-abc-123',
        paymentAttemptId: 'att-1',
        idempotencyKey: 'pay-key-1',
        totals: {
          subtotalCents: 30000,
          discountCents: 0,
          deliveryCents: 35000,
          totalCents: 65000,
          freeDeliveryThresholdCents: 500000,
          isFreeDelivery: false,
        },
      },
    });

    const val = await checkoutService.validatePrePay({
      reservationId: 'res-abc-123',
      deliveryAddress: {
        fullName: 'Kavindu Senanayake',
        phone: '+94771234567',
        email: 'kavindu@dsl.lk',
        addressLine1: 'Galle Road',
        city: 'Colombo',
        district: 'Colombo',
      },
      paymentMethod: 'CARD_PAYHERE',
    });

    expect(val.isValid).toBe(true);
    expect(val.totals.totalCents).toBe(65000);
  });

  it('renews reservation safely', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        reservationId: 'res-renewed',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        expiresInSeconds: 600,
        items: [],
      },
    });

    const renewed = await checkoutService.renewReservation('res-old');
    expect(renewed.reservationId).toBe('res-renewed');
    expect(renewed.status).toBe('ACTIVE');
  });

  it('fetches checkout settings and payment method availability', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce({
      success: true,
      data: {
        onlineCardEnabled: false,
        codEnabled: true,
        bankTransferEnabled: true,
        flatDeliveryFeeCents: 35000,
        freeDeliveryThresholdCents: 500000,
      },
    });

    const settings = await checkoutService.fetchCheckoutSettings();
    expect(settings.onlineCardEnabled).toBe(false);
    expect(settings.codEnabled).toBe(true);
    expect(settings.flatDeliveryFeeCents).toBe(35000);
  });

  it('uploads bank receipt slip via FormData and returns receiptToken', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        receiptToken: 'sample-token-abc',
        storageKey: '1731600000000_uuid.pdf',
        originalFilename: 'slip.pdf',
        fileSizeBytes: 20480,
        mimeType: 'application/pdf',
      },
    });

    const file = new File(['%PDF-1.4 dummy'], 'slip.pdf', { type: 'application/pdf' });
    const res = await checkoutService.uploadBankReceipt(file);

    expect(res.receiptToken).toBe('sample-token-abc');
    expect(res.originalFilename).toBe('slip.pdf');
    expect(apiClient.post).toHaveBeenCalledWith('/checkout/bank-receipt-upload', expect.any(FormData));
  });

  it('processes payment with bankTransferData correctly', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValueOnce({
      success: true,
      data: {
        order: {
          id: 'ord-bank-1',
          orderNumber: 'DSL-2026-BANK1',
          orderStatus: 'PENDING',
          paymentStatus: 'PENDING',
          paymentMethod: 'BANK_TRANSFER',
        },
        isDuplicate: false,
      },
    });

    const res = await checkoutService.processPayment({
      reservationId: 'res-123',
      deliveryAddress: {
        fullName: 'Customer Name',
        phone: '+94771234567',
        email: 'customer@dsl.lk',
        addressLine1: 'Road 1',
        city: 'Colombo',
        district: 'Colombo',
      },
      paymentMethod: 'BANK_TRANSFER',
      idempotencyKey: 'idemp-bt-test',
      bankTransferData: {
        receiptToken: 'sample-token-abc',
        referenceNumber: 'REF123456',
        depositDate: '2026-11-14',
      },
    });

    expect(res.order.paymentMethod).toBe('BANK_TRANSFER');
    expect(res.order.orderStatus).toBe('PENDING');
    expect(res.order.paymentStatus).toBe('PENDING');
    expect(apiClient.post).toHaveBeenCalledWith(
      '/checkout/pay',
      expect.objectContaining({
        paymentMethod: 'BANK_TRANSFER',
        bankTransferData: {
          receiptToken: 'sample-token-abc',
          referenceNumber: 'REF123456',
          depositDate: '2026-11-14',
        },
      })
    );
  });
});

