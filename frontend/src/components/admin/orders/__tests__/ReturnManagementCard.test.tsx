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
});
