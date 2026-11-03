import { Promotion, StoreBanner } from '@/types/admin';

export const INITIAL_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-welcome10',
    code: 'WELCOME10',
    title: 'First Order Welcome Offer',
    description: 'Get 10% off your entire stationery purchase for new registered customers.',
    discountType: 'percentage',
    discountValue: 10,
    minOrderAmountCents: 200000, // LKR 2,000.00
    maxDiscountCents: 100000, // Max LKR 1,000.00
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    usageCount: 148,
  },
  {
    id: 'promo-backtoschool',
    code: 'BACK2SCHOOL',
    title: 'Back to School Flat LKR 500 Off',
    description: 'Save LKR 500 when you purchase any School Pack or spend over LKR 4,000.',
    discountType: 'fixed',
    discountValue: 500, // LKR 500.00
    minOrderAmountCents: 400000,
    startDate: '2026-01-01T00:00:00Z',
    endDate: '2026-06-30T23:59:59Z',
    isActive: true,
    usageCount: 215,
  },
  {
    id: 'promo-office15',
    code: 'OFFICE15',
    title: 'Office Stationery Bulk Discount',
    description: '15% discount on office supplies and copier paper on orders above LKR 10,000.',
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmountCents: 1000000,
    maxDiscountCents: 300000,
    startDate: '2026-01-15T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: true,
    usageCount: 39,
  },
];

export const INITIAL_BANNERS: StoreBanner[] = [
  {
    id: 'banner-term-prep',
    title: 'New School Term Ready!',
    subtitle: 'Pre-assembled school packs, CR books, and premium writing supplies delivered right to your doorstep.',
    ctaText: 'Explore School Packs',
    ctaLink: '/school-packs',
    badgeText: 'Back to School 2026',
    backgroundColor: '#08275E',
    textColor: '#FFFFFF',
    isActive: true,
    displayOrder: 1,
  },
  {
    id: 'banner-upload-list',
    title: 'Got a Handwritten Booklist from School?',
    subtitle: 'Simply snap a photo or upload your PDF. Our smart stationery matcher selects your required books in seconds!',
    ctaText: 'Upload Your List Now',
    ctaLink: '/upload-list',
    badgeText: 'Smart Shopping Demo',
    backgroundColor: '#FFD21C',
    textColor: '#08275E',
    isActive: true,
    displayOrder: 2,
  },
];
