import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BannersService } from './banners.service';
import { BannerStatus } from '../../generated/prisma';

describe('BannersService (Phase 15.5)', () => {
  let service: BannersService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      homepageBanner: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn(),
      },
      $transaction: vi.fn((ops) => Promise.all(ops)),
    };

    service = new BannersService(prismaMock);
  });

  describe('calculateEffectiveStatus', () => {
    const fixedNow = new Date('2026-11-06T12:00:00Z');

    it('returns DRAFT for status DRAFT regardless of dates', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.DRAFT,
          startAt: new Date('2026-11-01T00:00:00Z'),
          endAt: new Date('2026-11-10T00:00:00Z'),
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('DRAFT');
      expect(res.isCurrentlyActive).toBe(false);
    });

    it('returns ARCHIVED for status ARCHIVED regardless of dates', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.ARCHIVED,
          startAt: null,
          endAt: null,
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('ARCHIVED');
      expect(res.isCurrentlyActive).toBe(false);
    });

    it('returns ACTIVE for PUBLISHED without start/end dates', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.PUBLISHED,
          startAt: null,
          endAt: null,
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('ACTIVE');
      expect(res.isCurrentlyActive).toBe(true);
    });

    it('returns SCHEDULED for PUBLISHED when startAt is in the future', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.PUBLISHED,
          startAt: new Date('2026-11-07T00:00:00Z'),
          endAt: new Date('2026-11-10T00:00:00Z'),
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('SCHEDULED');
      expect(res.isCurrentlyActive).toBe(false);
    });

    it('returns EXPIRED for PUBLISHED when endAt is in the past', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.PUBLISHED,
          startAt: new Date('2026-11-01T00:00:00Z'),
          endAt: new Date('2026-11-05T00:00:00Z'),
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('EXPIRED');
      expect(res.isCurrentlyActive).toBe(false);
    });

    it('returns ACTIVE for SCHEDULED when current time is within startAt and endAt', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.SCHEDULED,
          startAt: new Date('2026-11-05T00:00:00Z'),
          endAt: new Date('2026-11-10T00:00:00Z'),
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('ACTIVE');
      expect(res.isCurrentlyActive).toBe(true);
    });

    it('returns SCHEDULED for SCHEDULED when startAt is in the future', () => {
      const res = service.calculateEffectiveStatus(
        {
          status: BannerStatus.SCHEDULED,
          startAt: new Date('2026-11-10T00:00:00Z'),
          endAt: null,
        },
        fixedNow
      );
      expect(res.effectiveStatus).toBe('SCHEDULED');
      expect(res.isCurrentlyActive).toBe(false);
    });
  });

  describe('getHomepageBanners', () => {
    it('returns active homepage banners with effectiveStatus', async () => {
      const mockBanners = [
        {
          id: 'b-1',
          title: 'Back to School 2026',
          subtitle: 'Up to 30% off stationery',
          desktopImage: '/uploads/banners/bts.jpg',
          imageAltText: 'Back to School Sale',
          sortOrder: 0,
          status: BannerStatus.PUBLISHED,
          startAt: null,
          endAt: null,
          createdAt: new Date(),
        },
      ];
      prismaMock.homepageBanner.findMany.mockResolvedValue(mockBanners);

      const result = await service.getHomepageBanners();
      expect(result).toHaveLength(1);
      expect(result[0].effectiveStatus).toBe('ACTIVE');
      expect(result[0].isCurrentlyActive).toBe(true);
      expect(prismaMock.homepageBanner.findMany).toHaveBeenCalled();
    });

    it('returns empty array when no active banners exist', async () => {
      prismaMock.homepageBanner.findMany.mockResolvedValue([]);
      const result = await service.getHomepageBanners();
      expect(result).toEqual([]);
    });
  });

  describe('getAdminBanners', () => {
    it('returns all banners and filters by status when query provided', async () => {
      prismaMock.homepageBanner.findMany.mockResolvedValue([
        {
          id: 'b-draft',
          title: 'Draft Banner',
          status: BannerStatus.DRAFT,
          desktopImage: '/img.jpg',
          imageAltText: 'Draft',
          sortOrder: 1,
        },
      ]);

      const result = await service.getAdminBanners({ status: BannerStatus.DRAFT });
      expect(result).toHaveLength(1);
      expect(result[0].effectiveStatus).toBe('DRAFT');
      expect(prismaMock.homepageBanner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: BannerStatus.DRAFT },
        })
      );
    });

    it('filters banners by search keyword', async () => {
      prismaMock.homepageBanner.findMany.mockResolvedValue([]);
      await service.getAdminBanners({ search: 'Stationery' });
      expect(prismaMock.homepageBanner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { title: { contains: 'Stationery', mode: 'insensitive' } },
            ]),
          }),
        })
      );
    });
  });

  describe('getBannerById', () => {
    it('returns banner with effective status if found', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue({
        id: 'b-1',
        title: 'Main Banner',
        status: BannerStatus.PUBLISHED,
        startAt: null,
        endAt: null,
      });

      const result = await service.getBannerById('b-1');
      expect(result.id).toBe('b-1');
      expect(result.effectiveStatus).toBe('ACTIVE');
    });

    it('throws NotFoundException if banner does not exist', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue(null);
      await expect(service.getBannerById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBanner', () => {
    it('creates a banner and defaults sortOrder if not provided', async () => {
      prismaMock.homepageBanner.aggregate.mockResolvedValue({
        _max: { sortOrder: 4 },
      });
      prismaMock.homepageBanner.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'b-new', ...data })
      );

      const result = await service.createBanner(
        {
          title: 'New Promo',
          desktopImage: '/promo.jpg',
          imageAltText: 'Promo Alt',
        },
        'admin-user-id'
      );

      expect(result.id).toBe('b-new');
      expect(result.sortOrder).toBe(5);
      expect(prismaMock.homepageBanner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'New Promo',
            sortOrder: 5,
            createdById: 'admin-user-id',
          }),
        })
      );
    });
  });

  describe('updateBanner', () => {
    it('updates existing banner fields', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue({ id: 'b-1', title: 'Old' });
      prismaMock.homepageBanner.update.mockResolvedValue({
        id: 'b-1',
        title: 'Updated Title',
        status: BannerStatus.PUBLISHED,
        startAt: null,
        endAt: null,
      });

      const result = await service.updateBanner('b-1', { title: 'Updated Title' }, 'admin-2');
      expect(result.title).toBe('Updated Title');
      expect(prismaMock.homepageBanner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b-1' },
          data: expect.objectContaining({
            title: 'Updated Title',
            updatedBy: { connect: { id: 'admin-2' } },
          }),
        })
      );
    });

    it('throws NotFoundException when updating non-existent banner', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue(null);
      await expect(service.updateBanner('missing', { title: 'Test' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deleteBanner', () => {
    it('deletes banner when found', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue({ id: 'b-1', title: 'To Delete' });
      prismaMock.homepageBanner.delete.mockResolvedValue({ id: 'b-1' });

      const res = await service.deleteBanner('b-1');
      expect(res.success).toBe(true);
      expect(prismaMock.homepageBanner.delete).toHaveBeenCalledWith({ where: { id: 'b-1' } });
    });

    it('throws NotFoundException if banner to delete not found', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue(null);
      await expect(service.deleteBanner('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicateBanner', () => {
    it('duplicates existing banner as DRAFT with next sortOrder', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue({
        id: 'b-orig',
        title: 'Original Promo',
        subtitle: 'Sub',
        desktopImage: '/orig.jpg',
        mobileImage: '/orig-m.jpg',
        imageAltText: 'Alt',
        sortOrder: 2,
      });
      prismaMock.homepageBanner.aggregate.mockResolvedValue({
        _max: { sortOrder: 5 },
      });
      prismaMock.homepageBanner.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'b-copy', ...data })
      );

      const result = await service.duplicateBanner('b-orig', 'admin-id');
      expect(result.title).toBe('Original Promo (Copy)');
      expect(result.status).toBe(BannerStatus.DRAFT);
      expect(result.sortOrder).toBe(6);
    });

    it('throws NotFoundException when original does not exist', async () => {
      prismaMock.homepageBanner.findUnique.mockResolvedValue(null);
      await expect(service.duplicateBanner('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderBanners', () => {
    it('reorders banners inside a transaction', async () => {
      const items = [
        { id: 'b-1', sortOrder: 1 },
        { id: 'b-2', sortOrder: 0 },
      ];
      prismaMock.homepageBanner.update.mockResolvedValue({});

      const res = await service.reorderBanners({ items });
      expect(res.success).toBe(true);
      expect(prismaMock.$transaction).toHaveBeenCalled();
    });

    it('throws BadRequestException if items are empty', async () => {
      await expect(service.reorderBanners({ items: [] })).rejects.toThrow(BadRequestException);
    });
  });
});

