import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReturnManagementCard } from '../ReturnManagementCard';
import { orderService } from '@/services/orderService';
import { OrderReturnRequest } from '@/types/order';

describe('ReturnManagementCard (Stage 1)', () => {
  const mockReturns: OrderReturnRequest[] = [
    {
      id: 'ret-pending',
      returnNumber: 'RET-1001',
      orderId: 'ord-1',
      status: 'PENDING',
      reason: 'Wrong size',
      createdAt: '2026-11-14T10:00:00Z',
      updatedAt: '2026-11-14T10:00:00Z',
      items: [
        {
          id: 'item-1',
          orderItemId: 'oi-1',
          productName: 'Atlas Pen',
          quantity: 2,
          reason: 'Defective tip',
          status: 'PENDING',
          createdAt: '2026-11-14T10:00:00Z',
        },
      ],
    },
    {
      id: 'ret-approved',
      returnNumber: 'RET-1002',
      orderId: 'ord-1',
      status: 'APPROVED',
      reason: 'Damaged package',
      createdAt: '2026-11-14T11:00:00Z',
      updatedAt: '2026-11-14T11:00:00Z',
      items: [
        {
          id: 'item-2',
          orderItemId: 'oi-2',
          productName: 'Notebook',
          quantity: 1,
          reason: 'Torn pages',
          status: 'APPROVED',
          createdAt: '2026-11-14T11:00:00Z',
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(orderService, 'fetchOrderReturns').mockResolvedValue(mockReturns);
  });

  it('renders return requests correctly', async () => {
    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Return #RET-1001')).toBeDefined();
      expect(screen.getByText('Return #RET-1002')).toBeDefined();
    });
  });

  it('allows rejecting a return with a rejection reason', async () => {
    const processSpy = vi
      .spyOn(orderService, 'processReturnAction')
      .mockResolvedValueOnce({ success: true });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Reject Return')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Reject Return'));

    const input = screen.getByPlaceholderText('State official rejection reason...');
    fireEvent.change(input, { target: { value: 'Item damaged by customer' } });

    const confirmBtn = screen.getByText('Confirm Rejection');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(processSpy).toHaveBeenCalledWith('ord-1', 'ret-pending', 'REJECT', {
        rejectionReason: 'Item damaged by customer',
      });
    });
  });

  it('renders restock checkbox defaulted to checked for approved returns and sends restockItems: true', async () => {
    const processSpy = vi
      .spyOn(orderService, 'processReturnAction')
      .mockResolvedValueOnce({ success: true });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Confirm Products Received')).toBeDefined();
    });

    const checkbox = screen.getByLabelText(/Restock returned items to catalogue inventory/i) as HTMLInputElement;
    expect(checkbox).toBeDefined();
    expect(checkbox.checked).toBe(true); // Default to checked

    const confirmBtn = screen.getByText('Confirm Products Received');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(processSpy).toHaveBeenCalledWith('ord-1', 'ret-approved', 'CONFIRM_RECEIVED', {
        restockItems: true,
      });
    });
  });

  it('allows unchecking restock checkbox and sends restockItems: false', async () => {
    const processSpy = vi
      .spyOn(orderService, 'processReturnAction')
      .mockResolvedValueOnce({ success: true });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Confirm Products Received')).toBeDefined();
    });

    const checkbox = screen.getByLabelText(/Restock returned items to catalogue inventory/i) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    // Uncheck the checkbox
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    const confirmBtn = screen.getByText('Confirm Products Received');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(processSpy).toHaveBeenCalledWith('ord-1', 'ret-approved', 'CONFIRM_RECEIVED', {
        restockItems: false,
      });
    });
  });

  it('AUD-01: displays error state with retry button when return fetching fails', async () => {
    vi.spyOn(orderService, 'fetchOrderReturns').mockRejectedValueOnce(
      new Error('Internal Server Error 500')
    );

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Return Requests')).toBeDefined();
      expect(
        screen.getByText('Failed to retrieve return requests. Please try again.')
      ).toBeDefined();
      expect(screen.getByText('Retry')).toBeDefined();
    });

    // Verify it does NOT display the empty state falsely
    expect(screen.queryByText('No Return Requests Registered')).toBeNull();

    // Now clicking Retry recovers when service succeeds
    vi.spyOn(orderService, 'fetchOrderReturns').mockResolvedValueOnce(mockReturns);
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('Return #RET-1001')).toBeDefined();
      expect(screen.queryByText('Failed to Load Return Requests')).toBeNull();
    });
  });

  it('AUD-01: displays network-friendly message when a network failure occurs', async () => {
    vi.spyOn(orderService, 'fetchOrderReturns').mockRejectedValueOnce({
      isNetworkError: true,
      message: 'Network request failed',
    });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to Load Return Requests')).toBeDefined();
      expect(
        screen.getByText('Unable to connect to the server. Please check your network connection.')
      ).toBeDefined();
    });
  });

  it('AUD-01: displays empty state when returns list is legitimately empty', async () => {
    vi.spyOn(orderService, 'fetchOrderReturns').mockResolvedValueOnce([]);

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('No Return Requests Registered')).toBeDefined();
      expect(screen.queryByText('Failed to Load Return Requests')).toBeNull();
    });
  });

  it('AUD-02: displays inline error banner instead of browser alert when action fails', async () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(orderService, 'processReturnAction').mockResolvedValueOnce({
      success: false,
      error: 'Cannot approve return in current status',
    });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Approve Return')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Approve Return'));

    await waitFor(() => {
      expect(screen.getByText('Cannot approve return in current status')).toBeDefined();
      expect(screen.getByText('Action Failed:')).toBeDefined();
    });

    // Native browser alert must NOT be called
    expect(alertMock).not.toHaveBeenCalled();
    alertMock.mockRestore();
  });

  it('AUD-02: displays inline success notice upon successful action', async () => {
    vi.spyOn(orderService, 'processReturnAction').mockResolvedValueOnce({
      success: true,
    });

    render(<ReturnManagementCard orderId="ord-1" orderNumber="DSL-1001" />);

    await waitFor(() => {
      expect(screen.getByText('Approve Return')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Approve Return'));

    await waitFor(() => {
      expect(screen.getByText('Return request approved successfully.')).toBeDefined();
    });
  });
});
