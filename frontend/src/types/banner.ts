export type BannerStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

export interface HomepageBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  imageAltText: string;
  buttonText?: string | null;
  buttonLink?: string | null;
  sortOrder: number;
  status: BannerStatus;
  startAt?: string | null;
  endAt?: string | null;
  createdById?: string | null;
  updatedById?: string | null;
  createdBy?: { id: string; name: string; email: string } | null;
  updatedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  /** Effective calculated status for display in admin or runtime */
  effectiveStatus?: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DRAFT' | 'ARCHIVED';
  isCurrentlyActive?: boolean;
}

export interface CreateBannerInput {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  desktopImage: string;
  mobileImage?: string | null;
  imageAltText: string;
  buttonText?: string | null;
  buttonLink?: string | null;
  sortOrder?: number;
  status?: BannerStatus;
  startAt?: string | null;
  endAt?: string | null;
}

export interface UpdateBannerInput extends Partial<CreateBannerInput> {}

export interface ReorderBannerItem {
  id: string;
  sortOrder: number;
}

