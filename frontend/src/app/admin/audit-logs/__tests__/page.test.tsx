import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditLogsPage from '../page';
import { auditService } from '@/services/auditService';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/audit-logs',
  useSearchParams: () => new URLSearchParams(),
}));

let mockCurrentUser: any = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };

vi.mock('@/services/userStore', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentUser: mockCurrentUser,
    }),
}));

vi.mock('@/services/auditService', () => ({
  auditService: {
    fetchAuditLogs: vi.fn(),
    fetchAuditSummary: vi.fn(),
    fetchAuditLogById: vi.fn(),
  },
}));

describe('AuditLogsPage (Stage 4.2)', () => {
  const mockSummary = {
    totalEvents: 1402,
    generalAuditEvents: 1397,
    orderAuditEvents: 5,
    todayEvents: 12,
  };

  const mockAuditLogs = {
    items: [
      {
        id: 'audit-general-1',
        source: 'AUDIT_LOG' as const,
        timestamp: '2026-03-30T10:00:00.000Z',
        actor: { id: 'admin-1', name: 'Super Admin', email: 'admin@dsl.lk', role: 'ADMIN' },
        action: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityId: 'prod-123',
        description: 'Created product "Premium Notebook"',
        metadata: { title: 'Premium Notebook', price: 850 },
      },
      {
        id: 'audit-order-2',
        source: 'ORDER_AUDIT_LOG' as const,
        timestamp: '2026-03-30T10:30:00.000Z',
        actor: { id: 'admin-1', name: 'Order Admin', email: null, role: 'ADMIN' },
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: 'ord-1001',
        description: 'Status changed from PENDING to PROCESSING',
        orderNumber: 'ORD-2026-1001',
        fieldChanged: 'status',
        previousValue: 'PENDING',
        newValue: 'PROCESSING',
        reason: 'Payment confirmed via Bank Transfer',
      },
    ],
    total: 2,
    page: 1,
    limit: 20,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser = { id: 'admin-1', role: 'ADMIN', name: 'Admin User' };
    vi.mocked(auditService.fetchAuditSummary).mockResolvedValue(mockSummary);
    vi.mocked(auditService.fetchAuditLogs).mockResolvedValue(mockAuditLogs as any);
  });

  it('renders Access Restricted when current user is not ADMIN', async () => {
    mockCurrentUser = { id: 'staff-1', role: 'STAFF', name: 'Staff Member' };
    render(<AuditLogsPage />);

    expect(screen.getByText('Access Restricted')).toBeDefined();
    expect(screen.getByText(/Access is strictly restricted to System Administrators/i)).toBeDefined();
    expect(auditService.fetchAuditLogs).not.toHaveBeenCalled();
    expect(auditService.fetchAuditSummary).not.toHaveBeenCalled();
  });

  it('renders heading, KPI metrics, and audit table for ADMIN', async () => {
    render(<AuditLogsPage />);

    expect(screen.getByText('Audit Logs')).toBeDefined();

    await waitFor(() => {
      expect(auditService.fetchAuditSummary).toHaveBeenCalledTimes(1);
      expect(auditService.fetchAuditLogs).toHaveBeenCalledTimes(1);
    });

    // KPI cards
    expect(screen.getByText('Total Audit Events')).toBeDefined();
    expect(screen.getByText('System & Catalog Logs')).toBeDefined();
    expect(screen.getByText('Order Lifecycle Logs')).toBeDefined();
    expect(screen.getByText('Recorded Today')).toBeDefined();

    // Table rows
    expect(screen.getByText('Created product "Premium Notebook"')).toBeDefined();
    expect(screen.getByText('Status changed from PENDING to PROCESSING')).toBeDefined();
  });

  it('allows switching source tabs (All, System & Catalog, Order Lifecycle)', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Created product "Premium Notebook"')).toBeDefined();
    });

    const buttons = screen.getAllByRole('button');
    const orderTab = buttons.find((btn) => btn.textContent?.includes('Order Lifecycle'));
    expect(orderTab).toBeDefined();

    fireEvent.click(orderTab!);

    await waitFor(() => {
      expect(auditService.fetchAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'ORDER_AUDIT_LOG',
        })
      );
    });
  });

  it('opens detail modal when row is clicked', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Created product "Premium Notebook"')).toBeDefined();
    });

    const row = screen.getByText('Created product "Premium Notebook"');
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText('Audit Record Details')).toBeDefined();
      expect(screen.getByText(/ID:\s*audit-general-1/)).toBeDefined();
      expect(screen.getByText(/Structured Metadata/i)).toBeDefined();
    });

    // Close modal
    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('Audit Record Details')).toBeNull();
    });
  });

  it('applies filters on search input change and calls fetchAuditLogs', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(auditService.fetchAuditLogs).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText(/Search action, description, reason/i);
    fireEvent.change(searchInput, { target: { value: 'Notebook' } });

    await waitFor(
      () => {
        expect(auditService.fetchAuditLogs).toHaveBeenCalledWith(
          expect.objectContaining({
            search: 'Notebook',
          })
        );
      },
      { timeout: 1000 }
    );
  });
});
