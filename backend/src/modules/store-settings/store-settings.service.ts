import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  UpdateBankTransferSettingsDto,
  PublicStoreSettingsResponse,
  AdminStoreSettingsResponse,
} from './dto/store-settings.dto';

export const STORE_SETTINGS_DEFAULT_ID = 'default';

export function maskAccountNumber(accountNumber?: string | null): string | null {
  if (!accountNumber) return null;
  const trimmed = accountNumber.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= 4) return '••••';
  return '••••••••' + trimmed.slice(-4);
}

@Injectable()
export class StoreSettingsService {
  private readonly logger = new Logger(StoreSettingsService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  /**
   * Helper to check if all mandatory bank configuration fields are present and non-empty.
   */
  isBankConfigComplete(settings: {
    bankName?: string | null;
    accountHolderName?: string | null;
    accountNumber?: string | null;
    branchName?: string | null;
    paymentInstructions?: string | null;
    referenceInstructions?: string | null;
  }): boolean {
    return Boolean(
      settings.bankName?.trim() &&
      settings.accountHolderName?.trim() &&
      settings.accountNumber?.trim() &&
      settings.branchName?.trim() &&
      settings.paymentInstructions?.trim() &&
      settings.referenceInstructions?.trim()
    );
  }

  /**
   * Retrieves or initializes default StoreSettings entity without mutating on read.
   */
  private async getOrCreateSettingsRecord() {
    let settings = await this.prisma.storeSettings.findUnique({
      where: { id: STORE_SETTINGS_DEFAULT_ID },
    });

    if (!settings) {
      settings = await this.prisma.storeSettings.create({
        data: {
          id: STORE_SETTINGS_DEFAULT_ID,
          flatDeliveryFeeCents: 35000,
          freeDeliveryThresholdCents: 500000,
          hotlinePhone: '+94 11 200 9000',
          whatsappNumber: '+94 77 123 4567',
          contactEmail: 'support@dslstationery.lk',
          codEnabled: true,
          bankTransferEnabled: false,
          onlineCardEnabled: false,
          bankName: null,
          accountHolderName: null,
          accountNumber: null,
          branchName: null,
          branchCode: null,
          bankCode: null,
          paymentInstructions: null,
          referenceInstructions: null,
          bankLogoUrl: null,
        },
      });
    }

    return settings;
  }

  /**
   * Public store settings endpoint.
   * Suppresses Bank Transfer unless enabled AND all required bank details are complete.
   */
  async getPublicSettings(): Promise<PublicStoreSettingsResponse> {
    const settings = await this.getOrCreateSettingsRecord();
    const isComplete = this.isBankConfigComplete(settings);
    const bankTransferAvailable = Boolean(settings.bankTransferEnabled && isComplete);

    return {
      codEnabled: settings.codEnabled,
      onlineCardEnabled: settings.onlineCardEnabled,
      bankTransferEnabled: bankTransferAvailable,
      bankTransfer: bankTransferAvailable
        ? {
            bankName: settings.bankName!.trim(),
            accountHolderName: settings.accountHolderName!.trim(),
            accountNumber: settings.accountNumber!.trim(),
            branchName: settings.branchName!.trim(),
            branchCode: settings.branchCode ? settings.branchCode.trim() : null,
            bankCode: settings.bankCode ? settings.bankCode.trim() : null,
            paymentInstructions: settings.paymentInstructions!.trim(),
            referenceInstructions: settings.referenceInstructions!.trim(),
            bankLogoUrl: settings.bankLogoUrl ? settings.bankLogoUrl.trim() : null,
          }
        : null,
    };
  }

  /**
   * Admin store settings endpoint.
   * Returns complete settings for administrative editing with completeness indicator.
   */
  async getAdminSettings(): Promise<AdminStoreSettingsResponse> {
    const settings = await this.getOrCreateSettingsRecord();
    const isComplete = this.isBankConfigComplete(settings);

    return {
      id: settings.id,
      flatDeliveryFeeCents: settings.flatDeliveryFeeCents,
      freeDeliveryThresholdCents: settings.freeDeliveryThresholdCents,
      hotlinePhone: settings.hotlinePhone,
      whatsappNumber: settings.whatsappNumber,
      contactEmail: settings.contactEmail,
      codEnabled: settings.codEnabled,
      bankTransferEnabled: settings.bankTransferEnabled,
      onlineCardEnabled: settings.onlineCardEnabled,
      bankTransfer: {
        bankName: settings.bankName,
        accountHolderName: settings.accountHolderName,
        accountNumber: settings.accountNumber,
        maskedAccountNumber: maskAccountNumber(settings.accountNumber),
        branchName: settings.branchName,
        branchCode: settings.branchCode,
        bankCode: settings.bankCode,
        paymentInstructions: settings.paymentInstructions,
        referenceInstructions: settings.referenceInstructions,
        bankLogoUrl: settings.bankLogoUrl,
        isConfigComplete: isComplete,
      },
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Updates Bank Transfer store settings.
   * Validates mandatory fields when enabling, masks account numbers in audit trails,
   * and persists changes via Prisma upsert.
   */
  async updateBankTransferSettings(
    dto: UpdateBankTransferSettingsDto,
    adminUserId: string,
  ): Promise<AdminStoreSettingsResponse> {
    // 1. Validation: Field length bounds
    if (dto.bankName && dto.bankName.length > 100) {
      throw new BadRequestException('Bank name must not exceed 100 characters.');
    }
    if (dto.accountHolderName && dto.accountHolderName.length > 150) {
      throw new BadRequestException('Account holder name must not exceed 150 characters.');
    }
    if (dto.accountNumber && dto.accountNumber.length > 50) {
      throw new BadRequestException('Account number must not exceed 50 characters.');
    }
    if (dto.branchName && dto.branchName.length > 100) {
      throw new BadRequestException('Branch name must not exceed 100 characters.');
    }
    if (dto.branchCode && dto.branchCode.length > 20) {
      throw new BadRequestException('Branch code must not exceed 20 characters.');
    }
    if (dto.bankCode && dto.bankCode.length > 20) {
      throw new BadRequestException('Bank code must not exceed 20 characters.');
    }
    if (dto.paymentInstructions && dto.paymentInstructions.length > 1000) {
      throw new BadRequestException('Payment instructions must not exceed 1000 characters.');
    }
    if (dto.referenceInstructions && dto.referenceInstructions.length > 500) {
      throw new BadRequestException('Reference instructions must not exceed 500 characters.');
    }
    if (dto.bankLogoUrl && dto.bankLogoUrl.length > 500) {
      throw new BadRequestException('Bank logo URL must not exceed 500 characters.');
    }

    // 2. Strict completeness validation if enabling Bank Transfer
    if (dto.bankTransferEnabled === true) {
      const missingFields: string[] = [];
      if (!dto.bankName || !dto.bankName.trim()) missingFields.push('Bank name');
      if (!dto.accountHolderName || !dto.accountHolderName.trim()) missingFields.push('Account holder name');
      if (!dto.accountNumber || !dto.accountNumber.trim()) missingFields.push('Account number');
      if (!dto.branchName || !dto.branchName.trim()) missingFields.push('Branch name');
      if (!dto.paymentInstructions || !dto.paymentInstructions.trim()) missingFields.push('Payment instructions');
      if (!dto.referenceInstructions || !dto.referenceInstructions.trim()) missingFields.push('Reference instructions');

      if (missingFields.length > 0) {
        throw new BadRequestException(
          `Cannot enable Bank Transfer without all required details. Missing or blank: ${missingFields.join(', ')}.`,
        );
      }
    }

    const current = await this.getOrCreateSettingsRecord();

    const cleanBankName = dto.bankName !== undefined ? (dto.bankName?.trim() || null) : current.bankName;
    const cleanAccountHolder = dto.accountHolderName !== undefined ? (dto.accountHolderName?.trim() || null) : current.accountHolderName;
    const cleanAccountNumber = dto.accountNumber !== undefined ? (dto.accountNumber?.trim() || null) : current.accountNumber;
    const cleanBranchName = dto.branchName !== undefined ? (dto.branchName?.trim() || null) : current.branchName;
    const cleanBranchCode = dto.branchCode !== undefined ? (dto.branchCode?.trim() || null) : current.branchCode;
    const cleanBankCode = dto.bankCode !== undefined ? (dto.bankCode?.trim() || null) : current.bankCode;
    const cleanPaymentInstructions = dto.paymentInstructions !== undefined ? (dto.paymentInstructions?.trim() || null) : current.paymentInstructions;
    const cleanReferenceInstructions = dto.referenceInstructions !== undefined ? (dto.referenceInstructions?.trim() || null) : current.referenceInstructions;
    const cleanBankLogoUrl = dto.bankLogoUrl !== undefined ? (dto.bankLogoUrl?.trim() || null) : current.bankLogoUrl;

    const updated = await this.prisma.storeSettings.upsert({
      where: { id: STORE_SETTINGS_DEFAULT_ID },
      create: {
        id: STORE_SETTINGS_DEFAULT_ID,
        bankTransferEnabled: dto.bankTransferEnabled,
        bankName: cleanBankName,
        accountHolderName: cleanAccountHolder,
        accountNumber: cleanAccountNumber,
        branchName: cleanBranchName,
        branchCode: cleanBranchCode,
        bankCode: cleanBankCode,
        paymentInstructions: cleanPaymentInstructions,
        referenceInstructions: cleanReferenceInstructions,
        bankLogoUrl: cleanBankLogoUrl,
      },
      update: {
        bankTransferEnabled: dto.bankTransferEnabled,
        bankName: cleanBankName,
        accountHolderName: cleanAccountHolder,
        accountNumber: cleanAccountNumber,
        branchName: cleanBranchName,
        branchCode: cleanBranchCode,
        bankCode: cleanBankCode,
        paymentInstructions: cleanPaymentInstructions,
        referenceInstructions: cleanReferenceInstructions,
        bankLogoUrl: cleanBankLogoUrl,
      },
    });

    // 3. Compute audit diff with masked account numbers
    const changes: Record<string, { old?: any; new?: any }> = {};

    if (current.bankTransferEnabled !== updated.bankTransferEnabled) {
      changes['bankTransferEnabled'] = { old: current.bankTransferEnabled, new: updated.bankTransferEnabled };
    }
    if (current.bankName !== updated.bankName) {
      changes['bankName'] = { old: current.bankName, new: updated.bankName };
    }
    if (current.accountHolderName !== updated.accountHolderName) {
      changes['accountHolderName'] = { old: current.accountHolderName, new: updated.accountHolderName };
    }
    if (current.accountNumber !== updated.accountNumber) {
      changes['accountNumber'] = {
        old: maskAccountNumber(current.accountNumber),
        new: maskAccountNumber(updated.accountNumber),
      };
    }
    if (current.branchName !== updated.branchName) {
      changes['branchName'] = { old: current.branchName, new: updated.branchName };
    }
    if (current.branchCode !== updated.branchCode) {
      changes['branchCode'] = { old: current.branchCode, new: updated.branchCode };
    }
    if (current.bankCode !== updated.bankCode) {
      changes['bankCode'] = { old: current.bankCode, new: updated.bankCode };
    }
    if (current.paymentInstructions !== updated.paymentInstructions) {
      changes['paymentInstructions'] = { old: current.paymentInstructions, new: updated.paymentInstructions };
    }
    if (current.referenceInstructions !== updated.referenceInstructions) {
      changes['referenceInstructions'] = { old: current.referenceInstructions, new: updated.referenceInstructions };
    }
    if (current.bankLogoUrl !== updated.bankLogoUrl) {
      changes['bankLogoUrl'] = { old: current.bankLogoUrl, new: updated.bankLogoUrl };
    }

    if (Object.keys(changes).length > 0) {
      await this.auditService.recordAuditLog({
        action: 'UPDATE_STORE_SETTINGS',
        entityType: 'StoreSettings',
        entityId: STORE_SETTINGS_DEFAULT_ID,
        userId: adminUserId,
        summary: `Admin updated StoreSettings bank transfer configuration (enabled: ${updated.bankTransferEnabled})`,
        changes,
      });
      this.logger.log(
        `StoreSettings bank transfer updated by admin ${adminUserId}. Enabled: ${updated.bankTransferEnabled}`,
      );
    }

    return this.getAdminSettings();
  }
}

