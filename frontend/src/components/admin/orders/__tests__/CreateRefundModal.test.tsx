import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateRefundModal } from '../CreateRefundModal';
import { orderService } from '@/services/orderService';

describe('CreateRefundModal (AUD-03 Idempotency & Safety)', () => {
  const defaultProps = {
    orderId: 'ord-100',
    orderNumber: 'DSL-2026-100',
    paymentMethod: 'CARD_PAYHERE' as const,
    availableBalanceCents: 500000, // Rs. 5,000.00
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUD-03: generates a stable idempotency key and reuses it across retries after a network error', async () => {
    const requestRefundSpy = vi.spyOn(orderService, 'requestRefund');

    // First attempt fails with network error
    requestRefundSpy.mockResolvedValueOnce({
      success: false,
      error: 'Network connection lost. Please retry.',
    });

    // Second attempt succeeds
    requestRefundSpy.mockResolvedValueOnce({
      success: true,
      data: { id: 'ref-1', status: 'REQUESTED' },
    });

    const { container } = render(<CreateRefundModal {...defaultProps} />);

    // Fill in required reason
    const reasonInput = screen.getByPlaceholderText('State reason for customer refund...');
    fireEvent.change(reasonInput, { target: { value: 'Customer returned damaged goods' } });

    // Set amount input
    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(amountInput).toBeDefined();
    fireEvent.change(amountInput, { target: { value: '2000.00' } });

    const submitBtn = screen.getByText('Submit Refund Request');

    // First click: fails
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Network connection lost. Please retry.')).toBeDefined();
    });

    expect(requestRefundSpy).toHaveBeenCalledTimes(1);
    const firstCallKey = requestRefundSpy.mock.calls[0][1].idempotencyKey;
    expect(firstCallKey).toBeDefined();
    expect(firstCallKey).toMatch(/^ref-req-ord-100-\d+$/);

    // Second click (Retry with identical parameters):
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    expect(requestRefundSpy).toHaveBeenCalledTimes(2);
    const secondCallKey = requestRefundSpy.mock.calls[1][1].idempotencyKey;

    // Critical assertion: Idempotency key MUST be identical across retries!
    expect(secondCallKey).toBe(firstCallKey);
  });

  it('AUD-03: generates a new idempotency key if user alters refund amount before retry', async () => {
    const requestRefundSpy = vi.spyOn(orderService, 'requestRefund');

    // First attempt fails
    requestRefundSpy.mockResolvedValueOnce({
      success: false,
      error: 'Amount exceeds daily quota',
    });

    // Second attempt succeeds
    requestRefundSpy.mockResolvedValueOnce({
      success: true,
      data: { id: 'ref-2', status: 'REQUESTED' },
    });

    const { container } = render(<CreateRefundModal {...defaultProps} />);

    const reasonInput = screen.getByPlaceholderText('State reason for customer refund...');
    fireEvent.change(reasonInput, { target: { value: 'Partial return' } });

    const amountInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: '3000.00' } });

    const submitBtn = screen.getByText('Submit Refund Request');

    // First submission
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Amount exceeds daily quota')).toBeDefined();
    });

    const firstKey = requestRefundSpy.mock.calls[0][1].idempotencyKey;

    // User changes amount to 1500.00 before retrying
    fireEvent.change(amountInput, { target: { value: '1500.00' } });

    // Second submission
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    const secondKey = requestRefundSpy.mock.calls[1][1].idempotencyKey;

    // Critical assertion: A new key is generated when payload parameters are altered
    expect(secondKey).not.toBe(firstKey);
    expect(secondKey).toMatch(/^ref-req-ord-100-\d+$/);
  });

  it('AUD-03: generates a fresh idempotency key when reopening modal for a new refund workflow', async () => {
    const requestRefundSpy = vi.spyOn(orderService, 'requestRefund').mockResolvedValue({
      success: true,
    });

    const { rerender } = render(<CreateRefundModal {...defaultProps} isOpen={true} />);

    const reasonInput = screen.getByPlaceholderText('State reason for customer refund...');
    fireEvent.change(reasonInput, { target: { value: 'Initial refund' } });

    const submitBtn = screen.getByText('Submit Refund Request');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(requestRefundSpy).toHaveBeenCalledTimes(1);
    });

    const firstWorkflowKey = requestRefundSpy.mock.calls[0][1].idempotencyKey;

    // Close modal
    rerender(<CreateRefundModal {...defaultProps} isOpen={false} />);

    // Reopen modal for a new workflow
    rerender(<CreateRefundModal {...defaultProps} isOpen={true} />);

    const newReasonInput = screen.getByPlaceholderText('State reason for customer refund...');
    fireEvent.change(newReasonInput, { target: { value: 'Second independent refund' } });

    const newSubmitBtn = screen.getByText('Submit Refund Request');
    fireEvent.click(newSubmitBtn);

    await waitFor(() => {
      expect(requestRefundSpy).toHaveBeenCalledTimes(2);
    });

    const secondWorkflowKey = requestRefundSpy.mock.calls[1][1].idempotencyKey;

    // Critical assertion: Modal reopening initiates a new key
    expect(secondWorkflowKey).not.toBe(firstWorkflowKey);
  });

  it('AUD-03: blocks submission and disables button while submission is in-flight', async () => {
    let resolvePromise: (val: any) => void = () => {};
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.spyOn(orderService, 'requestRefund').mockReturnValueOnce(pendingPromise as any);

    render(<CreateRefundModal {...defaultProps} />);

    const reasonInput = screen.getByPlaceholderText('State reason for customer refund...');
    fireEvent.change(reasonInput, { target: { value: 'Double click test' } });

    const submitBtn = screen.getByText('Submit Refund Request') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    // Verify button is disabled during in-flight submission and label updates
    await waitFor(() => {
      const inFlightBtn = screen.getByText('Submitting Request...') as HTMLButtonElement;
      expect(inFlightBtn).toBeDefined();
      expect(inFlightBtn.disabled).toBe(true);
    });

    // Resolve the promise
    resolvePromise({ success: true });

    await waitFor(() => {
      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });
  });

  it('AUD-03: blocks refunds for unsupported payment methods (COD, Koko)', () => {
    const { rerender } = render(
      <CreateRefundModal {...defaultProps} paymentMethod="CASH_ON_DELIVERY" />
    );

    expect(
      screen.getByText(/Cash on Delivery refunds are strictly blocked/i)
    ).toBeDefined();

    rerender(<CreateRefundModal {...defaultProps} paymentMethod="KOKO_BNPL" />);

    expect(
      screen.getByText(/Koko gateway refund API integration is not implemented/i)
    ).toBeDefined();
  });
});
