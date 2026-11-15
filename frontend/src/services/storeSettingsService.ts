import { apiClient, BackendApiResponse } from '@/lib/api/apiClient';

export interface PublicBankTransferDetails {
  bankName: string;
  accountHolderName: string;
  accountNumber: string;
  branchName: string;
  branchCode: string | null;
  bankCode: string | null;
  paymentInstructions: string;
  referenceInstructions: string;
  bankLogoUrl: string | null;
}

export interface PublicStoreSettingsResponse {
  codEnabled: boolean;
  onlineCardEnabled: boolean;
  bankTransferEnabled: boolean;
  bankTransfer: PublicBankTransferDetails | null;
}

export interface AdminBankTransferSettings {
  bankName: string | null;
  accountHolderName: string | null;
  accountNumber: string | null;
  maskedAccountNumber: string | null;
  branchName: string | null;
  branchCode: string | null;
  bankCode: string | null;
  paymentInstructions: string | null;
  referenceInstructions: string | null;
  bankLogoUrl: string | null;
  isConfigComplete: boolean;
}

export interface AdminStoreSettingsResponse {
  id: string;
  flatDeliveryFeeCents: number;
  freeDeliveryThresholdCents: number;
  hotlinePhone: string;
  whatsappNumber: string;
  contactEmail: string;
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  onlineCardEnabled: boolean;
  bankTransfer: AdminBankTransferSettings;
  updatedAt: string;
}

export interface UpdateBankTransferPayload {
  bankTransferEnabled: boolean;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  branchName?: string;
  branchCode?: string;
  bankCode?: string;
  paymentInstructions?: string;
  referenceInstructions?: string;
  bankLogoUrl?: string;
}

export const storeSettingsService = {
  /**
   * Fetch customer-facing active store settings and payment methods.
   */
  async getPublicSettings(): Promise<PublicStoreSettingsResponse> {
    const response = await apiClient.get<BackendApiResponse<PublicStoreSettingsResponse>>(
      '/store-settings/public',
    );
    return response.data;
  },

  /**
   * Fetch administrative store settings with bank configuration.
   */
  async getAdminSettings(): Promise<AdminStoreSettingsResponse> {
    const response = await apiClient.get<BackendApiResponse<AdminStoreSettingsResponse>>(
      '/store-settings/admin',
    );
    return response.data;
  },

  /**
   * Update Bank Transfer configuration and payment instructions.
   */
  async updateBankTransfer(payload: UpdateBankTransferPayload): Promise<AdminStoreSettingsResponse> {
    const response = await apiClient.put<BackendApiResponse<AdminStoreSettingsResponse>>(
      '/store-settings/admin/bank-transfer',
      payload,
    );
    return response.data;
  },
};

