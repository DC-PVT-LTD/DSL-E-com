import { Injectable, BadRequestException, Logger, Inject } from '@nestjs/common';
import { Request } from 'express';
import { AuditService } from '../audit/audit.service';

export type ConfirmationAction =
  | 'UPDATE_ROLE_PERMISSIONS'
  | 'CHANGE_ADMIN_ROLE'
  | 'DEACTIVATE_ADMIN'
  | 'DELETE_ADMIN'
  | 'DELETE_ROLE'
  | 'CONFIRM_FINANCIAL_SETTINGS'
  | 'APPROVE_BANK_DEPOSIT'
  | 'REJECT_BANK_DEPOSIT'
  | 'DELETE_PRODUCT'
  | 'DELETE_CATEGORY'
  | 'CONFIRM_STOCK_UPDATE'
  | 'CONFIRM_PRODUCT_IMPORT';

export interface ValidateConfirmationOptions {
  action: ConfirmationAction;
  req: Request | any;
  targetEntity: string;
  targetId?: string;
  expectedValue: string;
  actor: {
    id: string;
    email?: string;
    name?: string;
    roleSlug?: string;
    role?: string;
  };
  isEmail?: boolean;
}

@Injectable()
export class ConfirmationService {
  private readonly logger = new Logger(ConfirmationService.name);

  constructor(@Inject(AuditService) private readonly auditService: AuditService) {}

  /**
   * Validates a typed confirmation phrase for sensitive and destructive operations.
   *
   * Security Rules:
   * 1. The confirmation value is read from HTTP header 'x-action-confirmation' or body.
   * 2. Rejects empty, missing, or generic boolean values with 400 Bad Request.
   * 3. Resolves the expected value strictly on the backend using the target entity/resource.
   * 4. Returns a GENERIC mismatch error without leaking the expected confirmation value.
   * 5. Audits failed attempts without recording the submitted value.
   * 6. Does not replace authentication or permission checks (guards run prior to this).
   */
  async validateConfirmation(options: ValidateConfirmationOptions): Promise<boolean> {
    const { action, req, targetEntity, targetId, expectedValue, actor, isEmail } = options;

    const rawHeader = req.headers ? req.headers['x-action-confirmation'] : undefined;
    const rawBody = req.body?.confirmationValue || req.body?.actionConfirmation;
    const submitted = typeof rawHeader === 'string' ? rawHeader : typeof rawBody === 'string' ? rawBody : null;

    const clientIp = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;
    const userAgent = req.headers ? req.headers['user-agent'] : undefined;

    // Reject missing or empty confirmation
    if (!submitted || !submitted.trim()) {
      await this.auditService.recordAdminActivity({
        userId: actor.id,
        userEmail: actor.email,
        userName: actor.name,
        userRole: actor.roleSlug || actor.role,
        action: `CONFIRMATION_MISSING_${action}`,
        entityType: targetEntity,
        entityId: targetId,
        description: `Sensitive action "${action}" rejected: confirmation value was not provided.`,
        status: 'FAILED',
        ipAddress: clientIp,
        userAgent,
      });

      throw new BadRequestException('Action confirmation is required for this operation.');
    }

    // Comparison logic:
    // For email-based confirmations (e.g. Deactivate Admin, Delete Admin), normalize casing.
    // For other confirmation phrases (e.g. "UPDATE ROLE PERMISSIONS"), exact trimmed match is required.
    const isMatch = isEmail
      ? submitted.trim().toLowerCase() === expectedValue.trim().toLowerCase()
      : submitted.trim() === expectedValue.trim();

    if (!isMatch) {
      // Audit the failed attempt WITHOUT recording the submitted value
      await this.auditService.recordAdminActivity({
        userId: actor.id,
        userEmail: actor.email,
        userName: actor.name,
        userRole: actor.roleSlug || actor.role,
        action: `CONFIRMATION_MISMATCH_${action}`,
        entityType: targetEntity,
        entityId: targetId,
        description: `Sensitive action "${action}" rejected: confirmation value mismatch.`,
        status: 'FAILED',
        ipAddress: clientIp,
        userAgent,
      });

      this.logger.warn(
        `[CONFIRMATION_MISMATCH] Action: ${action} | User: ${actor.email || actor.id} | Entity: ${targetEntity}:${targetId || 'N/A'}`
      );

      // Rule 2: Never return the expected confirmation phrase in the error message
      throw new BadRequestException('Action confirmation is invalid or does not match the required confirmation.');
    }

    return true;
  }
}
