import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminCustomersPage from '../page';
import { customerService } from '@/services/customerService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/customers',
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
    fetchCustomers: vi.fn(),
    fetchCustomerAnalytics: vi.fn(),
    updateCustomerStatus: vi.fn(),
    exportCustomers: vi.fn(),
  },
}));

describe('AdminCustomersPage (Stage 4.1)', () => {
  const mockAnalytics = {
    totalCustomers: 12,
    registeredCustomers: 8,
    guestBuyers: 4,
    activeCustomers: 11,
    inactiveCustomers: 1,
    verifiedEmailCount: 7,
    newCustomersLast30Days: 3,
    customersWithOrders: 9,
    customersWithoutOrders: 3,
    totalCustomerRevenueCents: 45000000,
    byDistrict: [{ district: 'Colombo', count: 6 }],
  };

  const mockCustomersList = {
    items: [
      {
        id: 'cust-1',
        customerType: 'REGISTERED' as const,
        name: 'Kamal Silva',
        email: 'kamal@test.lk',
        phone: '0771234567',
        isActive: true,
        isEmailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        firstPurchaseDate: '2026-01-05T00:00:00.000Z',
        lastPurchaseDate: '2026-01-15T00:00:00.000Z',
        primaryDistrict: 'Colombo',
        addressesCount: 1,
        orderCount: 3,
        totalSpendCents: 750000,
      },
      {
        id: 'guest:email:nimal@guest.lk',
        customerType: 'GUEST' as const,
        name: 'Nimal Guest',
        email: 'nimal@guest.lk',
        phone: '0779998877',
        isActive: true,
        isEmailVerified: false,
        createdAt: '2026-01-10T00:00:00.000Z',
        firstPurchaseDate: '2026-01-10T00:00:00.000Z',
        lastPurchaseDate: '2026-01-10T00:00:00.000Z',
        primaryDistrict: 'Gampaha',
        addressesCount: 1,
        orderCount: 1,
        totalSpendCents: 250000,
      },
    ],
    total: 2,
    page: 1,
    limit: 25,
    pageSize: 25,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };
    vi.mocked(customerService.fetchCustomerAnalytics).mockResolvedValue(mockAnalytics);
    vi.mocked(customerService.fetchCustomers).mockResolvedValue(mockCustomersList);
  });

  it('renders Customer Directory heading and analytics KPI cards', async () => {
    render(<AdminCustomersPage />);

    expect(screen.getByText('Customer Directory')).toBeDefined();

    await waitFor(() => {
      expect(customerService.fetchCustomerAnalytics).toHaveBeenCalledTimes(1);
      expect(customerService.fetchCustomers).toHaveBeenCalledTimes(1);
    });

    expect(screen.getAllByText('Total Customers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Registered Customers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Guest Customers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Customers with Orders').length).toBeGreaterThan(0);
  });

  it('displays the three tabs with counts: All Customers, Registered, Guest', async () => {
    render(<AdminCustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Kamal Silva')).toBeDefined();
      expect(screen.getByText('Nimal Guest')).toBeDefined();
    });

    const allTabs = screen.getAllByRole('button');
    const guestTab = allTabs.find((btn) => btn.textContent?.includes('Guest Customers'));
    expect(guestTab).toBeDefined();

    // Click on the Guest Customers tab
    fireEvent.click(guestTab!);

    await waitFor(() => {
      expect(customerService.fetchCustomers).toHaveBeenCalledWith(
        expect.objectContaining({
          customerType: 'guest',
        })
      );
    });
  });

  it('renders badges distinguishing Registered vs Guest customer types', async () => {
    render(<AdminCustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Kamal Silva')).toBeDefined();
    });

    expect(screen.getByText('Registered')).toBeDefined();
    expect(screen.getByText('Guest')).toBeDefined();
  });

  it('allows Admin to click export and open export modal', async () => {
    render(<AdminCustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Kamal Silva')).toBeDefined();
    });

    const exportBtn = screen.getByText('Export Customers');
    fireEvent.click(exportBtn);

    expect(screen.getByText(/Export All Customers List/i)).toBeDefined();
  });

  it('allows Manager to click export and open export modal', async () => {
    mockCurrentUser = { id: 'mgr-1', role: 'MANAGER', name: 'Manager User' };
    render(<AdminCustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Kamal Silva')).toBeDefined();
    });

    const exportBtn = screen.getByText('Export Customers');
    fireEvent.click(exportBtn);

    expect(screen.getByText(/Export All Customers List/i)).toBeDefined();
  });

  it('restricts Export button for Staff users', async () => {
    mockCurrentUser = { id: 'staff-1', role: 'STAFF', name: 'Staff User' };
    render(<AdminCustomersPage />);

    await waitFor(() => {
      expect(screen.getByText('Kamal Silva')).toBeDefined();
    });

    expect(screen.getByText('Export (Restricted)')).toBeDefined();
    expect(screen.queryByText('Export Customers')).toBeNull();
  });
});
