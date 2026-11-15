import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserRole } from '../../generated/prisma';
import { CheckoutController } from './checkout.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('Receipt File Access Authorization (RolesGuard & CheckoutController)', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;
  let jwtAuthGuard: JwtAuthGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
    jwtAuthGuard = new JwtAuthGuard(reflector);
  });

  function createMockExecutionContext(user?: any): ExecutionContext {
    const handler = CheckoutController.prototype.getBankReceipt;
    const targetClass = CheckoutController;

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
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

  it('1. Verifies that GET /bank-receipt/:submissionId requires exactly MANAGER or ADMIN', () => {
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      CheckoutController.prototype.getBankReceipt,
      CheckoutController,
    ]);

    expect(roles).toBeDefined();
    expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
    expect(roles).not.toContain(UserRole.STAFF);
    expect(roles).not.toContain(UserRole.CUSTOMER);
  });

  it('2. Unauthenticated request → 401 Unauthorized (via JwtAuthGuard or missing user in RolesGuard)', () => {
    // Test JwtAuthGuard handleRequest directly without needing Passport strategy initialization
    expect(() => {
      jwtAuthGuard.handleRequest(null, null, null);
    }).toThrow(UnauthorizedException);

    const contextWithoutUser = createMockExecutionContext(undefined);

    // RolesGuard also denies if user is missing
    expect(() => {
      rolesGuard.canActivate(contextWithoutUser);
    }).toThrow(ForbiddenException);
  });

  it('3. STAFF request → 403 Forbidden (STAFF cannot access receipt files)', () => {
    const staffContext = createMockExecutionContext({
      id: 'staff-user-1',
      email: 'staff@dslstationery.lk',
      role: UserRole.STAFF,
    });

    expect(() => {
      rolesGuard.canActivate(staffContext);
    }).toThrow(ForbiddenException);

    try {
      rolesGuard.canActivate(staffContext);
    } catch (err: any) {
      expect(err.message).toContain('Access denied');
      expect(err.message).toContain('MANAGER or ADMIN');
    }
  });

  it('4. MANAGER request → Authorized (canActivate returns true)', () => {
    const managerContext = createMockExecutionContext({
      id: 'manager-user-1',
      email: 'manager@dslstationery.lk',
      role: UserRole.MANAGER,
    });

    expect(rolesGuard.canActivate(managerContext)).toBe(true);
  });

  it('5. ADMIN request → Authorized (canActivate returns true)', () => {
    const adminContext = createMockExecutionContext({
      id: 'admin-user-1',
      email: 'admin@dslstationery.lk',
      role: UserRole.ADMIN,
    });

    expect(rolesGuard.canActivate(adminContext)).toBe(true);
  });

  it('6. CUSTOMER request → 403 Forbidden', () => {
    const customerContext = createMockExecutionContext({
      id: 'cust-user-1',
      email: 'customer@dslstationery.lk',
      role: UserRole.CUSTOMER,
    });

    expect(() => {
      rolesGuard.canActivate(customerContext);
    }).toThrow(ForbiddenException);
  });

  it('7. Proves STAFF cannot access receipt files through alternative endpoints', () => {
    // Assert that CheckoutController exposes NO OTHER endpoint returning receipt file streams
    const prototype = CheckoutController.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);

    // Only uploadBankReceipt (customer POST) and getBankReceipt (staff/admin GET) touch receipts
    const receiptMethods = propertyNames.filter((name) => name.toLowerCase().includes('receipt'));
    expect(receiptMethods).toEqual(['uploadBankReceipt', 'getBankReceipt']);

    // Ensure getBankReceipt is the only getter and requires MANAGER or ADMIN
    const roles = reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      prototype.getBankReceipt,
      CheckoutController,
    ]);
    expect(roles).toEqual([UserRole.MANAGER, UserRole.ADMIN]);
  });
});
