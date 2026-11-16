import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminCustomerDetailPage from '../page';
import { customerService } from '@/services/customerService';

let mockId = 'cust-123';
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: mockId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/admin/customers/${mockId}`,
  useSearchParams: () => new URLSearchParams(),
}));

let mockCurrentUser: any = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };

vi.mock('@/services/userStore', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentUser: mockCurrentUser,
    }),
}));

vi.mock('@/services/customerService', () => ({
  customerService: {
    fetchCustomerById: vi.fn(),
    updateCustomerStatus: vi.fn(),
  },
}));

describe('AdminCustomerDetailPage (Stage 4.1)', () => {
  const mockRegisteredCustomer = {
    id: 'cust-123',
    customerType: 'REGISTERED' as const,
    name: 'Anura Bandara',
    email: 'anura@test.lk',
    phone: '0771234567',
    isActive: true,
    isEmailVerified: true,
    createdAt: '2026-01-01T10:00:00.000Z',
    updatedAt: '2026-01-02T10:00:00.000Z',
    addresses: [
      {
        id: 'addr-1',
        fullName: 'Anura Bandara',
        phone: '0771234567',
        email: 'anura@test.lk',
        addressLine1: '45 Galle Road',
        addressLine2: null,
        city: 'Colombo 03',
        district: 'Colombo',
        postalCode: '00300',
        isDefault: true,
        createdAt: '2026-01-01T10:00:00.000Z',
      },
    ],
    orders: [
      {
        id: 'ord-101',
        orderNumber: 'DSL-2026-101',
        totalCents: 500000,
        paymentMethod: 'PAYHERE',
        paymentStatus: 'PAID',
        orderStatus: 'CONFIRMED',
        createdAt: '2026-01-05T12:00:00.000Z',
        itemsCount: 4,
      },
    ],
    orderSummary: {
      totalOrders: 1,
      totalSpendCents: 500000,
      averageOrderValueCents: 500000,
      firstOrderDate: '2026-01-05T12:00:00.000Z',
      lastOrderDate: '2026-01-05T12:00:00.000Z',
    },
    wishlistCount: 3,
    savedListsCount: 1,
  };

  const mockGuestCustomer = {
    id: 'guest:email:guest@test.lk',
    customerType: 'GUEST' as const,
    name: 'Kasun Guest',
    email: 'guest@test.lk',
    phone: '0719876543',
    isActive: true,
    isEmailVerified: false,
    createdAt: '2026-01-10T15:00:00.000Z',
    updatedAt: '2026-01-10T15:00:00.000Z',
    addresses: [
      {
        id: 'guest-addr-1',
        fullName: 'Kasun Guest',
        phone: '0719876543',
        email: 'guest@test.lk',
        addressLine1: '12 Kandy Road',
        addressLine2: null,
        city: 'Peradeniya',
        district: 'Kandy',
        postalCode: '20400',
        isDefault: false,
        createdAt: '2026-01-10T15:00:00.000Z',
      },
    ],
    orders: [
      {
        id: 'ord-202',
        orderNumber: 'DSL-2026-202',
        totalCents: 250000,
        paymentMethod: 'CASH_ON_DELIVERY',
        paymentStatus: 'PENDING',
        orderStatus: 'CONFIRMED',
        createdAt: '2026-01-10T15:00:00.000Z',
        itemsCount: 2,
      },
    ],
    orderSummary: {
      totalOrders: 1,
      totalSpendCents: 250000,
      averageOrderValueCents: 250000,
      firstOrderDate: '2026-01-10T15:00:00.000Z',
      lastOrderDate: '2026-01-10T15:00:00.000Z',
    },
    wishlistCount: 0,
    savedListsCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockId = 'cust-123';
    mockCurrentUser = { id: 'admin-1', role: 'ADMIN', name: 'Super Admin' };
  });

  it('renders registered customer profile with account controls and metrics', async () => {
    vi.mocked(customerService.fetchCustomerById).mockResolvedValueOnce(mockRegisteredCustomer);

    render(<AdminCustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Anura Bandara').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Active Account')).toBeDefined();
    expect(screen.getByText('Verified Email')).toBeDefined();
    expect(screen.getByText('Suspend Account')).toBeDefined();
    expect(screen.getByText('DSL-2026-101')).toBeDefined();
    expect(screen.getByText('45 Galle Road')).toBeDefined();
  });

  it('renders guest buyer profile without account controls or verification badges', async () => {
    mockId = 'guest:email:guest@test.lk';
    vi.mocked(customerService.fetchCustomerById).mockResolvedValueOnce(mockGuestCustomer);

    render(<AdminCustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Kasun Guest').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('Guest Buyer')).toBeDefined();
    expect(screen.queryByText('Suspend Account')).toBeNull();
    expect(screen.queryByText('Active Account')).toBeNull();
    expect(screen.queryByText('Verified Email')).toBeNull();
    expect(screen.getByText('DSL-2026-202')).toBeDefined();
    expect(screen.getByText('12 Kandy Road')).toBeDefined();
  });

  it('opens account suspension modal when Admin clicks Suspend Account', async () => {
    mockCurrentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };
    vi.mocked(customerService.fetchCustomerById).mockResolvedValueOnce(mockRegisteredCustomer);

    render(<AdminCustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Suspend Account')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Suspend Account'));

    expect(screen.getByText('Suspend Customer Account')).toBeDefined();
    expect(screen.getByText(/Are you sure you want to/i)).toBeDefined();
  });

  it('allows Manager to see Suspend Account action', async () => {
    mockCurrentUser = { id: 'mgr-1', role: 'MANAGER', name: 'Manager User' };
    vi.mocked(customerService.fetchCustomerById).mockResolvedValueOnce(mockRegisteredCustomer);

    render(<AdminCustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Suspend Account')).toBeDefined();
    });
  });

  it('locks Account Status for Staff users on customer details page', async () => {
    mockCurrentUser = { id: 'staff-1', role: 'STAFF', name: 'Staff User' };
    vi.mocked(customerService.fetchCustomerById).mockResolvedValueOnce(mockRegisteredCustomer);

    render(<AdminCustomerDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Status (Locked)')).toBeDefined();
    });

    expect(screen.queryByText('Suspend Account')).toBeNull();
  });
});
