import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminRecommendationsController } from './admin-recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { UserRole } from '../../generated/prisma';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';

describe('AdminRecommendationsController', () => {
  let controller: AdminRecommendationsController;
  let service: any;

  beforeEach(() => {
    service = {
      getAllRules: vi.fn().mockReturnValue([]),
      getRuleById: vi.fn(),
      createRule: vi.fn(),
      updateRule: vi.fn(),
      deleteRule: vi.fn(),
      toggleRuleStatus: vi.fn(),
    };

    controller = new AdminRecommendationsController(service as RecommendationsService);
  });

  describe('Security & Authorization Guard Checks', () => {
    it('restricts admin recommendation management to ADMIN and MANAGER roles', () => {
      const reflector = new Reflector();
      const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminRecommendationsController);
      expect(roles).toBeDefined();
      expect(roles).toContain(UserRole.ADMIN);
      expect(roles).toContain(UserRole.MANAGER);
      expect(roles).not.toContain(UserRole.CUSTOMER);
    });
  });

  describe('Admin rule actions', () => {
    it('lists rules for admin with optional purpose filtering', () => {
      controller.getAllRules('school');
      expect(service.getAllRules).toHaveBeenCalledWith('school');
    });

    it('delegates rule creation to service', async () => {
      const dto = {
        purpose: 'school' as const,
        name: 'Test Rule',
        productId: 'prod-dsl-1',
        defaultQuantity: 2,
        priority: 1,
        reason: 'Testing',
        isActive: true,
      };
      await controller.createRule(dto as any);
      expect(service.createRule).toHaveBeenCalledWith(dto);
    });

    it('delegates rule toggling to service', () => {
      controller.toggleRule('rule-1', true);
      expect(service.toggleRuleStatus).toHaveBeenCalledWith('rule-1', true);
    });

    it('delegates rule deletion to service', () => {
      controller.deleteRule('rule-1');
      expect(service.deleteRule).toHaveBeenCalledWith('rule-1');
    });
  });
});

