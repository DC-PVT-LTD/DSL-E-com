import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CheckoutPage from '../page';
import { checkoutService } from '@/services/checkoutService';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock Cart Store
vi.mock('@/services/cartStore', () => ({
  useCartStore: (selector: any) =>
    selector({
      items: [
        {
          id: 'item-1',
          productId: 'p-1',
          quantity: 2,
          selected: true,
          product: { id: 'p-1', name: 'Atlas Blue Pen', priceCents: 10000 },
        },
      ],
      appliedDiscount: null,
      removePurchasedItems: vi.fn(),
    }),
}));

// Mock User Store
vi.mock('@/services/userStore', () => ({
  useUserStore: (selector: any) =>
    selector({
      currentUser: null,
      fetchCurrentUser: vi.fn().mockResolvedValue(null),
    }),
}));

// Mock Inventory Socket
vi.mock('@/services/inventorySocketService', () => ({
  inventorySocketService: {
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

// Mock PayHere
vi.mock('@/lib/payhere', () => ({
  loadPayHereScript: vi.fn().mockResolvedValue(true),
}));

// Mock Checkout Sub-components
vi.mock('@/components/checkout/DeliveryLocationPicker', () => ({
  default: () => <div data-testid="delivery-location-picker">Delivery Picker</div>,
  DISTRICT_TO_PROVINCE_MAP: {},
}));

vi.mock('@/components/checkout/ReservationCountdown', () => ({
  default: () => <div data-testid="countdown">10:00</div>,
}));

vi.mock('@/components/checkout/CheckoutGateway', () => ({
  CheckoutGateway: ({ onContinueAsGuest }: any) => (
    <button data-testid="gateway-continue" onClick={onContinueAsGuest}>
      Continue to Details
    </button>
  ),
}));

// Mock checkoutService
vi.mock('@/services/checkoutService', () => ({
  checkoutService: {
    fetchCheckoutSettings: vi.fn(),
    createReservation: vi.fn(),
    renewReservation: vi.fn(),
    checkExpiredStock: vi.fn(),
    uploadBankReceipt: vi.fn(),
    validatePrePay: vi.fn(),
    processPayment: vi.fn(),
  },
}));

describe('CheckoutPage — Bank Transfer Payment Method', () => {
  const completeBankSettings = {
    onlineCardEnabled: false,
    codEnabled: true,
    bankTransferEnabled: true,
    flatDeliveryFeeCents: 35000,
    freeDeliveryThresholdCents: 500000,
    bankTransfer: {
      bankName: 'Commercial Bank of Ceylon',
      accountHolderName: 'DSL Stationery (Pvt) Ltd',
      accountNumber: '1000123456',
      branchName: 'Kollupitiya',
      branchCode: '045',
      bankCode: '7010',
      paymentInstructions: 'Deposit exact total into the corporate account.',
      referenceInstructions: 'Include your full name and order reference.',
      bankLogoUrl: null,
    },
  };

  const sampleReservation = {
    reservationId: 'res-test-99',
    status: 'ACTIVE' as const,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
    expiresInSeconds: 600,
    items: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkoutService.createReservation).mockResolvedValue(sampleReservation);
  });

  it('renders Bank Transfer option when bankTransferEnabled is true with complete details', async () => {
    vi.mocked(checkoutService.fetchCheckoutSettings).mockResolvedValueOnce(completeBankSettings);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId('gateway-continue')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('gateway-continue'));

    await waitFor(() => {
      expect(screen.getByText('Bank Transfer')).toBeDefined();
    });

    expect(screen.getByText('Direct corporate bank deposit or online fund transfer')).toBeDefined();
  });

  it('hides Bank Transfer option when bankTransferEnabled is false', async () => {
    vi.mocked(checkoutService.fetchCheckoutSettings).mockResolvedValueOnce({
      ...completeBankSettings,
      bankTransferEnabled: false,
      bankTransfer: null,
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId('gateway-continue')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('gateway-continue'));

    await waitFor(() => {
      expect(screen.getByText('Cash on Delivery (COD)')).toBeDefined();
    });

    expect(screen.queryByText('Bank Transfer')).toBeNull();
  });

  it('displays bank account details and required slip upload form when Bank Transfer is selected', async () => {
    vi.mocked(checkoutService.fetchCheckoutSettings).mockResolvedValueOnce(completeBankSettings);

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByTestId('gateway-continue')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('gateway-continue'));

    await waitFor(() => {
      expect(screen.getByText('Bank Transfer')).toBeDefined();
    });

    // Select Bank Transfer
    fireEvent.click(screen.getByText('Bank Transfer'));

    await waitFor(() => {
      expect(screen.getByText('DSL Stationery Bank Account Details')).toBeDefined();
      expect(screen.getByText('Commercial Bank of Ceylon')).toBeDefined();
      expect(screen.getByText('DSL Stationery (Pvt) Ltd')).toBeDefined();
      expect(screen.getByText('1000123456')).toBeDefined();
      expect(screen.getByText('Kollupitiya (045)')).toBeDefined();
    });

    // Check that required inputs are present
    expect(screen.getByPlaceholderText(/TXN987654321/i)).toBeDefined();
    expect(screen.getByText(/Bank Deposit Slip \/ Transfer Receipt/i)).toBeDefined();
    expect(screen.getByText(/Click or drag bank slip to upload/i)).toBeDefined();
  });
});
