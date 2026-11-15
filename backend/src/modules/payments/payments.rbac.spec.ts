import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../generated/prisma';
import { PaymentsController } from './payments.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('PaymentsController — RBAC & Authorization Tests', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    jwtAuthGuard = new JwtAuthGuard(reflector);
  });

  function createMockContext(handler: Function, user?: any): ExecutionContext {
    return {
      getHandler: () => handler,
      getClass: () => PaymentsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: user ? { authorization: 'Bearer valid.jwt.token' } : {},
        }),
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  describe('Bank Transfer Verification Queue (getBankTransfers, approve, reject)', () => {
    it('requires MANAGER or ADMIN for getBankTransfers (queue access)', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        PaymentsController.prototype.getBankTransfers,
        PaymentsController,
      ]);
      expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.STAFF);
    });

    it('requires MANAGER or ADMIN for approveBankTransfer', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        PaymentsController.prototype.approveBankTransfer,
        PaymentsController,
      ]);
      expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.STAFF);
    });

    it('requires MANAGER or ADMIN for rejectBankTransfer', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        PaymentsController.prototype.rejectBankTransfer,
        PaymentsController,
      ]);
      expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.STAFF);
    });

    it('rejects STAFF when attempting to access verification queue or approval', () => {
      const staffContext = createMockContext(PaymentsController.prototype.getBankTransfers, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });

      expect(() => rolesGuard.canActivate(staffContext)).toThrow(ForbiddenException);

      const staffApproveContext = createMockContext(PaymentsController.prototype.approveBankTransfer, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });

      expect(() => rolesGuard.canActivate(staffApproveContext)).toThrow(ForbiddenException);
    });

    it('allows MANAGER to access verification queue and approve', () => {
      const managerContext = createMockContext(PaymentsController.prototype.getBankTransfers, {
        id: 'manager-1',
        role: UserRole.MANAGER,
      });

      expect(rolesGuard.canActivate(managerContext)).toBe(true);
    });

    it('allows ADMIN to access verification queue and approve', () => {
      const adminContext = createMockContext(PaymentsController.prototype.getBankTransfers, {
        id: 'admin-1',
        role: UserRole.ADMIN,
      });

      expect(rolesGuard.canActivate(adminContext)).toBe(true);
    });
  });

  describe('Payments Dashboard (summary, transactions, export)', () => {
    it('allows STAFF to view dashboard summary and transaction list (without receipt files or actions)', () => {
      const staffSummaryContext = createMockContext(PaymentsController.prototype.getPaymentsSummary, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(rolesGuard.canActivate(staffSummaryContext)).toBe(true);

      const staffTxContext = createMockContext(PaymentsController.prototype.getPaymentTransactions, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(rolesGuard.canActivate(staffTxContext)).toBe(true);
    });

    it('restricts CSV export to MANAGER and ADMIN (denies STAFF)', () => {
      const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
        PaymentsController.prototype.exportPaymentsCsv,
        PaymentsController,
      ]);
      expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
      expect(roles).not.toContain(UserRole.STAFF);

      const staffExportContext = createMockContext(PaymentsController.prototype.exportPaymentsCsv, {
        id: 'staff-1',
        role: UserRole.STAFF,
      });
      expect(() => rolesGuard.canActivate(staffExportContext)).toThrow(ForbiddenException);
    });
  });
});
