import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBankTransferSettingsDto {
  @ApiProperty({ description: 'Whether Bank Transfer is enabled for customers' })
  bankTransferEnabled!: boolean;

  @ApiPropertyOptional({ description: 'Name of the banking institution' })
  bankName?: string;

  @ApiPropertyOptional({ description: 'Official corporate account holder name' })
  accountHolderName?: string;

  @ApiPropertyOptional({ description: 'Bank account number' })
  accountNumber?: string;

  @ApiPropertyOptional({ description: 'Branch name of the account' })
  branchName?: string;

  @ApiPropertyOptional({ description: 'Branch code (optional)' })
  branchCode?: string;

  @ApiPropertyOptional({ description: 'Bank code (optional)' })
  bankCode?: string;

  @ApiPropertyOptional({ description: 'Instructions displayed to the customer for payment' })
  paymentInstructions?: string;

  @ApiPropertyOptional({ description: 'Instructions for transaction reference entry' })
  referenceInstructions?: string;

  @ApiPropertyOptional({ description: 'Optional URL to bank logo image' })
  bankLogoUrl?: string;
}

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
  bankTransfer: {
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
  };
  updatedAt: Date;
}

