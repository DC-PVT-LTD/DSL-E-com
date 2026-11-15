import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RefundManagementCard } from '../RefundManagementCard';
import { orderService } from '@/services/orderService';
import { OrderRefundsResponse } from '@/types/order';

describe('RefundManagementCard (Stage 2 Frontend)', () => {
  const mockRefundData: OrderRefundsResponse = {
    orderId: 'ord-100',
    orderNumber: 'DSL-2026-100',
    orderTotalCents: 10000,
    paymentMethod: 'CARD_PAYHERE',
    paymentStatus: 'PAID',
    verifiedCollectedCents: 10000,
    refundCeilingCents: 10000,
    completedRefundsCents: 3000,
    reservedRefundsCents: 2000,
    availableRefundBalanceCents: 5000,
    refundRecords: [
      {
        id: 'ref-req-1',
        orderId: 'ord-100',
        amountCents: 2000,
        currency: 'LKR',
        method: 'CARD_PAYHERE',
        status: 'REQUESTED',
        reference: 'REF-REQ-001',
        reason: 'Customer return refund',
        requestedById: 'admin-requester',
        processedBy: 'Admin Requester',
        createdAt: '2026-11-14T10:00:00Z',
        updatedAt: '2026-11-14T10:00:00Z',
      },
      {
        id: 'ref-proc-1',
        orderId: 'ord-100',
        amountCents: 3000,
        currency: 'LKR',
        method: 'CARD_PAYHERE',
        status: 'PROCESSING',
        reference: 'REF-PROC-001',
        reason: 'Defective item refund',
        requestedById: 'admin-requester',
        approvedById: 'admin-approver',
        processedBy: 'Admin Requester',
        createdAt: '2026-11-14T11:00:00Z',
        updatedAt: '2026-11-14T11:00:00Z',
      },
      {
        id: 'ref-comp-1',
        orderId: 'ord-100',
        amountCents: 3000,
        currency: 'LKR',
        method: 'CARD_PAYHERE',
        status: 'COMPLETED',
        reference: 'REF-COMP-001',
        externalReference: 'PAYHERE-TX-999',
        reason: 'Approved partial refund',
        requestedById: 'admin-requester',
        approvedById: 'admin-approver',
        completedById: 'admin-completer',
        processedBy: 'Admin Requester',
        createdAt: '2026-11-14T09:00:00Z',
        updatedAt: '2026-11-14T09:30:00Z',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(orderService, 'fetchOrderRefunds').mockResolvedValue(mockRefundData);
  });

  it('renders financial summary metrics correctly with LKR formatting', async () => {
    render(
      <RefundManagementCard
        orderId="ord-100"
        orderNumber="DSL-2026-100"
        orderTotalCents={10000}
        paymentMethod="CARD_PAYHERE"
        paymentStatus="PAID"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Refund Management & Financial Lineage')).toBeDefined();
    });

    expect(screen.getByText('Rs. 100.00')).toBeDefined(); // Verified Collected
    expect(screen.getByText('Rs. 50.00')).toBeDefined(); // Available to Refund
  });

  it('renders refund records with status and actor lineage', async () => {
    render(
      <RefundManagementCard
        orderId="ord-100"
        orderNumber="DSL-2026-100"
        orderTotalCents={10000}
        paymentMethod="CARD_PAYHERE"
        paymentStatus="PAID"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('REF-REQ-001')).toBeDefined();
      expect(screen.getByText('REF-PROC-001')).toBeDefined();
      expect(screen.getByText('REF-COMP-001')).toBeDefined();
    });

    expect(screen.getByText('PAYHERE-TX-999')).toBeDefined();
    expect(screen.getAllByText('admin-requester').length).toBeGreaterThan(0);
    expect(screen.getAllByText('admin-approver').length).toBeGreaterThan(0);
    expect(screen.getAllByText('admin-completer').length).toBeGreaterThan(0);
  });

  it('allows approving a REQUESTED refund', async () => {
    const approveSpy = vi
      .spyOn(orderService, 'approveRefund')
      .mockResolvedValueOnce({ success: true });

    render(
      <RefundManagementCard
        orderId="ord-100"
        orderNumber="DSL-2026-100"
        orderTotalCents={10000}
        paymentMethod="CARD_PAYHERE"
        paymentStatus="PAID"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Authorize / Approve')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Authorize / Approve'));

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('ord-100', 'ref-req-1', expect.any(String));
    });
  });

  it('requires external reference when completing a PROCESSING refund', async () => {
    const completeSpy = vi
      .spyOn(orderService, 'completeRefund')
      .mockResolvedValueOnce({ success: true });

    render(
      <RefundManagementCard
        orderId="ord-100"
        orderNumber="DSL-2026-100"
        orderTotalCents={10000}
        paymentMethod="CARD_PAYHERE"
        paymentStatus="PAID"
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Record Completion Reference')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Record Completion Reference'));

    const input = screen.getByPlaceholderText('e.g. PAYHERE-REF-992348 or BANK-SLIP-77382');
    fireEvent.change(input, { target: { value: 'PAYHERE-EXT-8877' } });

    const submitBtn = screen.getByText('Confirm & Complete Refund');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(completeSpy).toHaveBeenCalledWith(
        'ord-100',
        'ref-proc-1',
        'PAYHERE-EXT-8877',
        undefined
      );
    });
  });

  it('displays blocked banner for CASH_ON_DELIVERY orders', async () => {
    render(
      <RefundManagementCard
        orderId="ord-cod"
        orderNumber="DSL-2026-COD"
        orderTotalCents={5000}
        paymentMethod="CASH_ON_DELIVERY"
        paymentStatus="PAID"
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText('Cash on Delivery (COD) Refunds Strictly Blocked')
      ).toBeDefined();
    });
  });
});
