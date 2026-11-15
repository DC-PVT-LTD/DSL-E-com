import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminSettingsPage from '../page';
import { storeSettingsService, AdminStoreSettingsResponse } from '@/services/storeSettingsService';

vi.mock('@/services/storeSettingsService', () => ({
  storeSettingsService: {
    getAdminSettings: vi.fn(),
    updateBankTransfer: vi.fn(),
  },
}));

describe('AdminSettingsPage Component', () => {
  const mockSettings: AdminStoreSettingsResponse = {
    id: 'default',
    flatDeliveryFeeCents: 35000,
    freeDeliveryThresholdCents: 500000,
    hotlinePhone: '+94 11 200 9000',
    whatsappNumber: '+94 77 123 4567',
    contactEmail: 'support@dslstationery.lk',
    codEnabled: true,
    bankTransferEnabled: true,
    onlineCardEnabled: false,
    bankTransfer: {
      bankName: 'Commercial Bank of Ceylon',
      accountHolderName: 'DSL Stationery (Pvt) Ltd',
      accountNumber: '1000123456',
      maskedAccountNumber: '••••••••3456',
      branchName: 'City Office',
      branchCode: '001',
      bankCode: '7010',
      paymentInstructions: 'Deposit exact total into corporate account.',
      referenceInstructions: 'Enter your deposit slip reference.',
      bankLogoUrl: 'https://example.com/logo.png',
      isConfigComplete: true,
    },
    updatedAt: '2026-11-14T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and populates bank transfer settings from admin API', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce(mockSettings);

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Commercial Bank of Ceylon')).toBeDefined();
      expect(screen.getByDisplayValue('DSL Stationery (Pvt) Ltd')).toBeDefined();
      expect(screen.getByDisplayValue('1000123456')).toBeDefined();
      expect(screen.getByDisplayValue('City Office')).toBeDefined();
    });

    expect(screen.getByText('Active on Checkout')).toBeDefined();
  });

  it('displays Disabled badge when bankTransferEnabled is false', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce({
      ...mockSettings,
      bankTransferEnabled: false,
    });

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Disabled')).toBeDefined();
    });
  });

  it('validates required fields before submitting when bank transfer is enabled', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce({
      ...mockSettings,
      bankTransferEnabled: true,
      bankTransfer: {
        ...mockSettings.bankTransfer,
        bankName: '',
        accountNumber: '',
        isConfigComplete: false,
      },
    });

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Payment Settings — Bank Transfer')).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: /Save Bank Settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Bank name is required when Bank Transfer is enabled.')).toBeDefined();
      expect(screen.getByText('Account number is required.')).toBeDefined();
    });

    expect(storeSettingsService.updateBankTransfer).not.toHaveBeenCalled();
  });

  it('successfully calls updateBankTransfer API when valid form is saved', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce(mockSettings);
    vi.mocked(storeSettingsService.updateBankTransfer).mockResolvedValueOnce(mockSettings);

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Commercial Bank of Ceylon')).toBeDefined();
    });

    const bankInput = screen.getByDisplayValue('Commercial Bank of Ceylon');
    fireEvent.change(bankInput, { target: { value: 'Hatton National Bank' } });

    const saveButton = screen.getByRole('button', { name: /Save Bank Settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(storeSettingsService.updateBankTransfer).toHaveBeenCalledWith(
        expect.objectContaining({
          bankName: 'Hatton National Bank',
          accountNumber: '1000123456',
          bankTransferEnabled: true,
        }),
      );
    });
  });

  it('displays error banner when API update fails', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce(mockSettings);
    vi.mocked(storeSettingsService.updateBankTransfer).mockRejectedValueOnce(
      new Error('Database connectivity error'),
    );

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Commercial Bank of Ceylon')).toBeDefined();
    });

    const saveButton = screen.getByRole('button', { name: /Save Bank Settings/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText('Settings Update Failed')).toBeDefined();
      expect(screen.getByText('Database connectivity error')).toBeDefined();
    });
  });

  it('reverts edits back to initial values when Reset button is clicked', async () => {
    vi.mocked(storeSettingsService.getAdminSettings).mockResolvedValueOnce(mockSettings);

    render(<AdminSettingsPage />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Commercial Bank of Ceylon')).toBeDefined();
    });

    const bankInput = screen.getByDisplayValue('Commercial Bank of Ceylon');
    fireEvent.change(bankInput, { target: { value: 'Modified Bank Name' } });
    expect(screen.getByDisplayValue('Modified Bank Name')).toBeDefined();

    const resetButton = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetButton);

    expect(screen.getByDisplayValue('Commercial Bank of Ceylon')).toBeDefined();
  });
});
