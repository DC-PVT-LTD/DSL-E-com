import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BannerStatus, HomepageBanner, Prisma } from '../../generated/prisma';
import {
  CreateBannerDto,
  UpdateBannerDto,
  ReorderBannersDto,
  QueryBannersDto,
} from './dto/banner.dto';

export type EffectiveBannerStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DRAFT' | 'ARCHIVED';

export interface BannerWithEffectiveStatus extends HomepageBanner {
  effectiveStatus: EffectiveBannerStatus;
  isCurrentlyActive: boolean;
  createdBy?: { id: string; name: string; email: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
}

@Injectable()
export class BannersService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService
  ) {}

  /**
   * Pure calculation of banner's effective status on read.
   * Avoids fragile cron jobs and reflects the real runtime state.
   */
  public calculateEffectiveStatus(
    banner: Pick<HomepageBanner, 'status' | 'startAt' | 'endAt'>,
    now: Date = new Date()
  ): { effectiveStatus: EffectiveBannerStatus; isCurrentlyActive: boolean } {
    if (banner.status === BannerStatus.ARCHIVED) {
      return { effectiveStatus: 'ARCHIVED', isCurrentlyActive: false };
    }
    if (banner.status === BannerStatus.DRAFT) {
      return { effectiveStatus: 'DRAFT', isCurrentlyActive: false };
    }

    const nowTime = now.getTime();
    const startTime = banner.startAt ? new Date(banner.startAt).getTime() : null;
    const endTime = banner.endAt ? new Date(banner.endAt).getTime() : null;

    if (endTime !== null && nowTime >= endTime) {
      return { effectiveStatus: 'EXPIRED', isCurrentlyActive: false };
    }

    if (startTime !== null && nowTime < startTime) {
      return { effectiveStatus: 'SCHEDULED', isCurrentlyActive: false };
    }

    // At this point, banner is either PUBLISHED (with valid window) or SCHEDULED (window has started)
    return { effectiveStatus: 'ACTIVE', isCurrentlyActive: true };
  }

  /**
   * Public: Fetch all active homepage banners ordered by sortOrder ASC, createdAt DESC.
   */
  public async getHomepageBanners(now: Date = new Date()): Promise<BannerWithEffectiveStatus[]> {
    const banners = await this.prisma.homepageBanner.findMany({
      where: {
        status: {
          in: [BannerStatus.PUBLISHED, BannerStatus.SCHEDULED],
        },
        AND: [
          {
            OR: [
              { startAt: null },
              { startAt: { lte: now } },
            ],
          },
          {
            OR: [
              { endAt: null },
              { endAt: { gt: now } },
            ],
          },
        ],
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return banners.map((b) => ({
      ...b,
      ...this.calculateEffectiveStatus(b, now),
    }));
  }

  /**
   * Admin: Fetch all banners matching query with effective status and user info.
   */
  public async getAdminBanners(
    query?: QueryBannersDto,
    now: Date = new Date()
  ): Promise<BannerWithEffectiveStatus[]> {
    const where: Prisma.HomepageBannerWhereInput = {};

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { subtitle: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { buttonText: { contains: term, mode: 'insensitive' } },
      ];
    }

    const banners = await this.prisma.homepageBanner.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return banners.map((b) => ({
      ...b,
      ...this.calculateEffectiveStatus(b, now),
    }));
  }

  /**
   * Admin: Fetch a single banner by ID.
   */
  public async getBannerById(id: string, now: Date = new Date()): Promise<BannerWithEffectiveStatus> {
    const banner = await this.prisma.homepageBanner.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!banner) {
      throw new NotFoundException(`Banner with ID "${id}" was not found`);
    }

    return {
      ...banner,
      ...this.calculateEffectiveStatus(banner, now),
    };
  }

  /**
   * Admin: Create a new banner.
   */
  public async createBanner(
    dto: CreateBannerDto,
    userId?: string
  ): Promise<BannerWithEffectiveStatus> {
    // If sortOrder was not explicitly given, place at the end of the order
    let sortOrder = dto.sortOrder ?? 0;
    if (dto.sortOrder === undefined) {
      const maxOrder = await this.prisma.homepageBanner.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    }

    const banner = await this.prisma.homepageBanner.create({
      data: {
        title: dto.title,
        subtitle: dto.subtitle ?? null,
        description: dto.description ?? null,
        desktopImage: dto.desktopImage,
        mobileImage: dto.mobileImage ?? null,
        imageAltText: dto.imageAltText,
        buttonText: dto.buttonText ?? null,
        buttonLink: dto.buttonLink ?? null,
        sortOrder,
        status: dto.status ?? BannerStatus.DRAFT,
        startAt: dto.startAt ? new Date(dto.startAt) : null,
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...banner,
      ...this.calculateEffectiveStatus(banner),
    };
  }

  /**
   * Admin: Update an existing banner.
   */
  public async updateBanner(
    id: string,
    dto: UpdateBannerDto,
    userId?: string
  ): Promise<BannerWithEffectiveStatus> {
    const existing = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Banner with ID "${id}" was not found`);
    }

    const data: Prisma.HomepageBannerUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.subtitle !== undefined ? { subtitle: dto.subtitle } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.desktopImage !== undefined ? { desktopImage: dto.desktopImage } : {}),
      ...(dto.mobileImage !== undefined ? { mobileImage: dto.mobileImage } : {}),
      ...(dto.imageAltText !== undefined ? { imageAltText: dto.imageAltText } : {}),
      ...(dto.buttonText !== undefined ? { buttonText: dto.buttonText } : {}),
      ...(dto.buttonLink !== undefined ? { buttonLink: dto.buttonLink } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.startAt !== undefined ? { startAt: dto.startAt ? new Date(dto.startAt) : null } : {}),
      ...(dto.endAt !== undefined ? { endAt: dto.endAt ? new Date(dto.endAt) : null } : {}),
      ...(userId ? { updatedBy: { connect: { id: userId } } } : {}),
    };

    const updated = await this.prisma.homepageBanner.update({
      where: { id },
      data,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...updated,
      ...this.calculateEffectiveStatus(updated),
    };
  }

  /**
   * Admin: Delete a banner by ID.
   */
  public async deleteBanner(id: string): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Banner with ID "${id}" was not found`);
    }

    await this.prisma.homepageBanner.delete({ where: { id } });
    return { success: true, message: `Banner "${existing.title}" deleted successfully` };
  }

  /**
   * Admin: Duplicate a banner.
   */
  public async duplicateBanner(id: string, userId?: string): Promise<BannerWithEffectiveStatus> {
    const original = await this.prisma.homepageBanner.findUnique({ where: { id } });
    if (!original) {
      throw new NotFoundException(`Banner with ID "${id}" was not found`);
    }

    const maxOrder = await this.prisma.homepageBanner.aggregate({
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxOrder._max.sortOrder ?? original.sortOrder) + 1;

    const duplicate = await this.prisma.homepageBanner.create({
      data: {
        title: `${original.title} (Copy)`,
        subtitle: original.subtitle,
        description: original.description,
        desktopImage: original.desktopImage,
        mobileImage: original.mobileImage,
        imageAltText: original.imageAltText,
        buttonText: original.buttonText,
        buttonLink: original.buttonLink,
        sortOrder: nextSortOrder,
        status: BannerStatus.DRAFT,
        startAt: null,
        endAt: null,
        createdById: userId ?? null,
        updatedById: userId ?? null,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    return {
      ...duplicate,
      ...this.calculateEffectiveStatus(duplicate),
    };
  }

  /**
   * Admin: Reorder banners in bulk.
   */
  public async reorderBanners(dto: ReorderBannersDto): Promise<{ success: boolean; message: string }> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('No items provided for reordering');
    }

    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.homepageBanner.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );

    return { success: true, message: 'Banners reordered successfully' };
  }
}
