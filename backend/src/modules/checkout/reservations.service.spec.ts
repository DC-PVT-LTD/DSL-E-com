import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReservationsService } from './reservations.service';
import { ReservationStatus } from '../../generated/prisma';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReservationsService (Phase C - Stock Reservation & Recovery)', () => {
  let service: ReservationsService;
  let mockPrisma: any;
  let mockInventoryGateway: any;

  beforeEach(() => {
    mockPrisma = {
      stockReservation: {
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn(),
      },
      stockReservationItem: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      product: {
        findUnique: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
      },
      paymentAttempt: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (callback: any) => callback(mockPrisma)),
    };

    mockInventoryGateway = {
      broadcastStockUpdate: vi.fn(),
    };

    service = new ReservationsService(mockPrisma as any, mockInventoryGateway as any);
  });

  describe('Reservation Creation & Stock Validation', () => {
    it('creates all-or-nothing 10-minute reservation when stock is available', async () => {
      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              id: 'prod-1',
              name: 'Exercise Book',
              priceCents: 25000,
              stockQuantity: 50,
              isActive: true,
            },
          ]),
          stockReservationItem: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          stockReservation: {
            create: vi.fn().mockResolvedValue({
              id: 'res-101',
              status: ReservationStatus.ACTIVE,
              expiresAt: new Date(Date.now() + 600000),
              items: [
                {
                  id: 'item-1',
                  productId: 'prod-1',
                  variantId: null,
                  quantity: 3,
                  unitPriceCents: 25000,
                },
              ],
            }),
          },
        };
        return callback(mockTx);
      });

      const res = await service.createReservation(
        { items: [{ productId: 'prod-1', quantity: 3 }] },
        'user-1',
        'csess-123'
      );

      expect(res.reservationId).toBe('res-101');
      expect(res.status).toBe(ReservationStatus.ACTIVE);
      expect(res.isExpired).toBe(false);
      expect(res.items.length).toBe(1);
      expect(res.items[0].quantity).toBe(3);
      expect(res.items[0].unitPriceCents).toBe(25000);
      expect(res.expiresInSeconds).toBeGreaterThan(0);
    });

    it('rejects reservation if requested quantity exceeds available stock', async () => {
      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce(null);

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          $queryRaw: vi.fn().mockResolvedValue([
            {
              id: 'prod-1',
              name: 'Exercise Book',
              priceCents: 25000,
              stockQuantity: 5,
              isActive: true,
            },
          ]),
          stockReservationItem: {
            findMany: vi.fn().mockResolvedValue([{ quantity: 3 }]), // 3 already reserved
          },
        };
        return callback(mockTx);
      });

      // physical = 5, reserved = 3 => available = 2. Requested 3 => should throw BadRequestException
      await expect(
        service.createReservation({
          items: [{ productId: 'prod-1', quantity: 3 }],
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Timer Persistence & Session Reuse (No Reset on Refresh)', () => {
    it('persists reservation and remaining time across page refresh without resetting 10-minute timer', async () => {
      // Simulate that 3 minutes have passed out of 10 minutes (7 minutes / 420 seconds remaining)
      const originalExpiresAt = new Date(Date.now() + 420000);

      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce({
        id: 'res-existing-1',
        sessionId: 'csess-persistent-1',
        userId: 'user-1',
        status: ReservationStatus.ACTIVE,
        expiresAt: originalExpiresAt,
        items: [
          {
            id: 'it-1',
            productId: 'prod-1',
            variantId: null,
            quantity: 2,
            unitPriceCents: 15000,
            product: { id: 'prod-1', name: 'Atlas Blue Pen', stockQuantity: 20, isActive: true },
            variant: null,
          },
        ],
      });

      // Customer refreshes page with same checkout session and items
      const res = await service.createReservation(
        { items: [{ productId: 'prod-1', quantity: 2 }] },
        'user-1',
        'csess-persistent-1'
      );

      // Verify the SAME reservation ID is returned
      expect(res.reservationId).toBe('res-existing-1');
      expect(res.status).toBe(ReservationStatus.ACTIVE);
      expect(res.expiresAt).toBe(originalExpiresAt.toISOString());
      // Remaining time is ~420 seconds, NOT reset to 600 seconds!
      expect(res.expiresInSeconds).toBeLessThanOrEqual(420);
      expect(res.expiresInSeconds).toBeGreaterThan(400);

      // Ensure no transaction was executed to create a duplicate reservation
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('releases previous reservation if customer changes cart items and creates a new one', async () => {
      const activeOldExpiresAt = new Date(Date.now() + 500000);

      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce({
        id: 'res-old-selection',
        sessionId: 'csess-1',
        status: ReservationStatus.ACTIVE,
        expiresAt: activeOldExpiresAt,
        items: [
          {
            id: 'it-old',
            productId: 'prod-old',
            variantId: null,
            quantity: 1,
            product: { id: 'prod-old', name: 'Old Item', stockQuantity: 10, isActive: true },
            variant: null,
          },
        ],
      });

      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const mockTx = {
          $queryRaw: vi.fn().mockResolvedValue([
            { id: 'prod-new', name: 'New Item', priceCents: 30000, stockQuantity: 25, isActive: true },
          ]),
          stockReservationItem: { findMany: vi.fn().mockResolvedValue([]) },
          stockReservation: {
            create: vi.fn().mockResolvedValue({
              id: 'res-new-selection',
              status: ReservationStatus.ACTIVE,
              expiresAt: new Date(Date.now() + 600000),
              items: [{ id: 'it-new', productId: 'prod-new', variantId: null, quantity: 2, unitPriceCents: 30000 }],
            }),
          },
        };
        return callback(mockTx);
      });

      // Customer changed item from prod-old to prod-new
      const res = await service.createReservation(
        { items: [{ productId: 'prod-new', quantity: 2 }] },
        null,
        'csess-1'
      );

      // Old reservation must have been released
      expect(mockPrisma.stockReservation.update).toHaveBeenCalledWith({
        where: { id: 'res-old-selection' },
        data: { status: ReservationStatus.RELEASED },
      });

      expect(res.reservationId).toBe('res-new-selection');
    });
  });

  describe('Expired Reservation Recovery (Scenario A & Scenario B)', () => {
    it('Scenario A: detects expired reservation, verifies stock is still available, and allows customer to continue without a new 10-minute timer', async () => {
      const expiredDate = new Date(Date.now() - 60000); // Expired 1 minute ago

      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce({
        id: 'res-expired-scenario-a',
        sessionId: 'csess-scenario-a',
        status: ReservationStatus.EXPIRED,
        expiresAt: expiredDate,
        items: [
          {
            id: 'it-1',
            productId: 'prod-notebook',
            variantId: null,
            quantity: 2,
            unitPriceCents: 18000,
            product: { id: 'prod-notebook', name: 'CR Notebook', stockQuantity: 10, isActive: true },
            variant: null,
          },
        ],
      });

      // Stock check: physical = 10, other active reservations = 0 => available = 10 (>= 2)
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-expired-scenario-a',
        status: ReservationStatus.EXPIRED,
        expiresAt: expiredDate,
        items: [
          {
            id: 'it-1',
            productId: 'prod-notebook',
            variantId: null,
            quantity: 2,
            unitPriceCents: 18000,
            product: { id: 'prod-notebook', name: 'CR Notebook', stockQuantity: 10, isActive: true },
            variant: null,
          },
        ],
      });
      mockPrisma.stockReservationItem.findMany.mockResolvedValue([]); // No other competing reservations

      const res = await service.createReservation(
        { items: [{ productId: 'prod-notebook', quantity: 2 }] },
        null,
        'csess-scenario-a'
      );

      expect(res.isExpired).toBe(true);
      expect(res.stockAvailable).toBe(true);
      expect(res.expiresInSeconds).toBe(0);
      expect(res.message).toContain('Your previous reservation has expired. We checked the latest stock availability');
      expect(res.items.length).toBe(1);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled(); // No new 10-minute hold created
    });

    it('Scenario B: detects expired reservation and reports insufficient stock with available quantities', async () => {
      const expiredDate = new Date(Date.now() - 120000);

      mockPrisma.stockReservation.findFirst.mockResolvedValueOnce({
        id: 'res-expired-scenario-b',
        sessionId: 'csess-scenario-b',
        status: ReservationStatus.EXPIRED,
        expiresAt: expiredDate,
        items: [
          {
            id: 'it-1',
            productId: 'prod-notebook',
            variantId: null,
            quantity: 5,
            unitPriceCents: 18000,
            product: { id: 'prod-notebook', name: 'CR Notebook', stockQuantity: 2, isActive: true },
            variant: null,
          },
        ],
      });

      // Stock check: physical = 2, requested = 5 => insufficient!
      mockPrisma.stockReservation.findUnique.mockResolvedValueOnce({
        id: 'res-expired-scenario-b',
        status: ReservationStatus.EXPIRED,
        expiresAt: expiredDate,
        items: [
          {
            id: 'it-1',
            productId: 'prod-notebook',
            variantId: null,
            quantity: 5,
            unitPriceCents: 18000,
            product: { id: 'prod-notebook', name: 'CR Notebook', stockQuantity: 2, isActive: true },
            variant: null,
          },
        ],
      });
      mockPrisma.stockReservationItem.findMany.mockResolvedValue([]);

      const res = await service.createReservation(
        { items: [{ productId: 'prod-notebook', quantity: 5 }] },
        null,
        'csess-scenario-b'
      );

      expect(res.isExpired).toBe(true);
      expect(res.stockAvailable).toBe(false);
      expect(res.message).toContain('Sorry! Some of your selected items are no longer available');
      expect(res.unavailableItems).toBeDefined();
      expect(res.unavailableItems?.[0]).toEqual({
        productId: 'prod-notebook',
        variantId: null,
        productName: 'CR Notebook',
        requestedQuantity: 5,
        availableQuantity: 2,
      });
    });
  });

  describe('Periodic Background Expiration Worker', () => {
    it('atomically expires genuinely expired ACTIVE and PAYMENT_PENDING reservations without touching consumed', async () => {
      mockPrisma.stockReservation.findMany.mockResolvedValueOnce([
        {
          id: 'res-old',
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() - 5000),
          items: [{ productId: 'prod-1', variantId: null, quantity: 2 }],
        },
      ]);
      mockPrisma.stockReservation.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', stockQuantity: 20 });
      mockPrisma.stockReservationItem.findMany.mockResolvedValue([]);

      const released = await service.releaseExpiredReservations();
      expect(released).toBe(1);
      expect(mockPrisma.stockReservation.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'res-old',
          status: { in: [ReservationStatus.ACTIVE, ReservationStatus.PAYMENT_PENDING] },
          expiresAt: { lte: expect.any(Date) },
        },
        data: { status: ReservationStatus.EXPIRED },
      });
    });

    it('safely handles concurrent worker executions without race condition', async () => {
      mockPrisma.stockReservation.findMany.mockResolvedValueOnce([
        {
          id: 'res-claimed-by-other-worker',
          status: ReservationStatus.ACTIVE,
          expiresAt: new Date(Date.now() - 5000),
          items: [{ productId: 'prod-1', variantId: null, quantity: 2 }],
        },
      ]);
      // Another worker updated it first, so updateMany returns count: 0
      mockPrisma.stockReservation.updateMany.mockResolvedValueOnce({ count: 0 });

      const released = await service.releaseExpiredReservations();
      expect(released).toBe(0);
      expect(mockInventoryGateway.broadcastStockUpdate).not.toHaveBeenCalled();
    });
  });
});

