import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UserRole, Prisma } from '../../generated/prisma';
import { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  CreateAdminUserDto,
  InviteAdminUserDto,
  AdminUserQueryDto,
  UpdateAdminStatusDto,
  UpdateAdminRoleDto,
  UpdateAdminProfileDto,
  AdminExportQueryDto,
} from './dto/admin-users.dto';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);
  private readonly bcryptRounds = 12;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(NotificationsService) private readonly notificationsService: NotificationsService,
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {}

  /**
   * Get real database counts for dashboard overview cards.
   */
  async getStats() {
    const adminRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
    const [totalAdmins, activeAdmins, inactiveAdmins, pendingInvitations, totalRoles, customRoles] = await Promise.all([
      this.prisma.user.count({ where: { role: { in: adminRoles } } }),
      this.prisma.user.count({ where: { role: { in: adminRoles }, isActive: true } }),
      this.prisma.user.count({ where: { role: { in: adminRoles }, isActive: false } }),
      this.prisma.adminInvitation.count({ where: { usedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.role.count(),
      this.prisma.role.count({ where: { isSystem: false } }),
    ]);

    return {
      success: true,
      data: {
        totalAdmins,
        activeAdmins,
        inactiveAdmins,
        pendingInvitations,
        totalRoles,
        customRoles,
      },
    };
  }

  /**
   * List all administrative users with search, role, and active status filters.
   */
  async findAll(query: AdminUserQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: query.role ? query.role : { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
    };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          assignedRole: {
            select: {
              id: true,
              name: true,
              slug: true,
              isSystem: true,
              isActive: true,
              _count: {
                select: { permissions: true },
              },
            },
          },
          isActive: true,
          isEmailVerified: true,
          failedLoginAttempts: true,
          lockedUntil: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get administrator by ID.
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        roleId: true,
        assignedRole: {
          select: {
            id: true,
            name: true,
            slug: true,
            isSystem: true,
            isActive: true,
            permissions: {
              select: {
                permission: {
                  select: { key: true, displayName: true, category: true },
                },
              },
            },
          },
        },
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
    if (!user || !adminRoles.includes(user.role)) {
      throw new NotFoundException('Administrator account not found');
    }

    return {
      success: true,
      data: user,
    };
  }

  /**
   * Direct creation of administrator accounts (Super Admin only).
   */
  async createAdmin(dto: CreateAdminUserDto, actor: AuthenticatedUser) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    return this.prisma.$transaction(async (tx) => {
      // 1. FIRST STATEMENT: Acquire mutual exclusion lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      // 2. Re-read live actor to verify Super Admin status
      const liveActor = await tx.user.findUnique({
        where: { id: actor.id },
        include: { assignedRole: true },
      });
      if (
        !liveActor ||
        !liveActor.isActive ||
        liveActor.role !== UserRole.ADMIN ||
        liveActor.assignedRole?.slug !== 'super_admin'
      ) {
        throw new ForbiddenException('Only a verified Super Admin can directly create administrator accounts.');
      }

      // Check unique email
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existingUser) {
        throw new ConflictException('A user with this email address already exists');
      }

      // Validate dynamic roleId if supplied, or default to matching system role
      let targetRoleId = dto.roleId;
      if (!targetRoleId) {
        const defaultRole = await tx.role.findFirst({
          where: { slug: dto.role === UserRole.ADMIN ? 'project_manager' : dto.role === UserRole.MANAGER ? 'product_manager' : 'order_manager' },
        });
        targetRoleId = defaultRole?.id;
      }

      if (targetRoleId) {
        const assignedRole = await tx.role.findUnique({ where: { id: targetRoleId } });
        if (!assignedRole || !assignedRole.isActive) {
          throw new BadRequestException('Assigned role is invalid or deactivated.');
        }
      }

      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          role: UserRole.ADMIN, // Authoritative ADMIN enum for all admin users
          roleId: targetRoleId,
          passwordHash,
          isActive: true,
          isEmailVerified: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          isActive: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_USER_CREATED',
          entityType: 'user',
          entityId: created.id,
          description: `Super Admin ${liveActor.email} directly created new administrator account for ${normalizedEmail}`,
          userId: liveActor.id,
        },
      });

      return {
        success: true,
        message: 'Administrator account created successfully',
        data: created,
      };
    });
  }

  /**
   * Generate and send an administrator invitation (Super Admin mutex enforced).
   */
  async inviteAdmin(dto: InviteAdminUserDto, actor: AuthenticatedUser) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      // 1. FIRST STATEMENT: Acquire mutual exclusion lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      // 2. Re-read live actor to verify privileges
      const liveActor = await tx.user.findUnique({
        where: { id: actor.id },
        include: { assignedRole: true },
      });
      if (
        !liveActor ||
        !liveActor.isActive ||
        liveActor.role !== UserRole.ADMIN ||
        !liveActor.assignedRole?.isActive
      ) {
        throw new ForbiddenException('Only active administrators can invite colleagues.');
      }

      // Resolve roleId
      let targetRoleId = dto.roleId;
      if (!targetRoleId) {
        const defaultRole = await tx.role.findFirst({
          where: { slug: dto.role === UserRole.ADMIN ? 'project_manager' : dto.role === UserRole.MANAGER ? 'product_manager' : 'order_manager' },
        });
        targetRoleId = defaultRole?.id;
      }

      const targetRole = await tx.role.findUnique({
        where: { id: targetRoleId },
      });
      if (!targetRole || !targetRole.isActive) {
        throw new BadRequestException('Target dynamic role is invalid or deactivated.');
      }

      // Hardcoded Super Admin protection: Only Super Admin can invite Super Admin
      if (targetRole.slug === 'super_admin' && liveActor.assignedRole?.slug !== 'super_admin') {
        throw new ForbiddenException('Only Super Admins can issue invitations with Super Admin privileges.');
      }

      // Check if an existing admin account already exists
      const existingUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
      });
      const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
      if (existingUser && adminRoles.includes(existingUser.role)) {
        throw new ConflictException('An active administrator account with this email address already exists');
      }

      // Invalidate any previously unused invitations for this email
      await tx.adminInvitation.deleteMany({
        where: {
          email: normalizedEmail,
          usedAt: null,
        },
      });

      // Generate 64-char crypto raw token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresHours = 48;
      const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

      const invitation = await tx.adminInvitation.create({
        data: {
          email: normalizedEmail,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          role: dto.role,
          roleId: targetRole.id,
          tokenHash,
          expiresAt,
          invitedById: liveActor.id,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          expiresAt: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_INVITATION_SENT',
          entityType: 'admin_invitation',
          entityId: invitation.id,
          description: `Administrator ${liveActor.email} issued ${targetRole.name} invitation to ${normalizedEmail}`,
          userId: liveActor.id,
        },
      });

      // Build URL
      const baseUrl = this.configService.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL || 'http://localhost:3000';
      const invitationUrl = `${baseUrl}/admin/invite/accept?token=${rawToken}`;

      // Send invitation email
      const emailResult = await this.notificationsService.sendAdminInvitationEmail({
        email: normalizedEmail,
        name: dto.name.trim(),
        role: dto.role,
        invitationUrl,
        expiresHours,
      });

      this.logger.log(`Admin invitation issued for ${normalizedEmail} (${targetRole.name}) by ${liveActor.email}`);

      return {
        success: true,
        message: emailResult.deliveryStatus === 'DELIVERED'
          ? `Invitation sent successfully to ${normalizedEmail}`
          : `Invitation created. Email delivery was simulated (ID: ${emailResult.messageId})`,
        data: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          roleId: invitation.roleId,
          expiresAt: invitation.expiresAt,
          invitationUrl,
          emailStatus: emailResult,
        },
      };
    });
  }

  /**
   * Update administrator account activation status (activate / deactivate).
   * Acquires the advisory lock FIRST, re-verifies live actor & target, and preserves last Super Admin.
   */
  async updateStatus(id: string, dto: UpdateAdminStatusDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. FIRST STATEMENT: Acquire mutual exclusion lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      // 2. Fetch authoritative super_admin system role
      const superAdminRole = await tx.role.findUniqueOrThrow({
        where: { slug: 'super_admin' },
      });

      // 3. Re-read live actor
      const liveActor = await tx.user.findUnique({
        where: { id: actor.id },
        include: { assignedRole: true },
      });
      if (
        !liveActor ||
        !liveActor.isActive ||
        liveActor.role !== UserRole.ADMIN ||
        !liveActor.assignedRole?.isActive
      ) {
        throw new ForbiddenException('Only active administrators can modify status.');
      }

      // 4. Re-read live target
      const liveTarget = await tx.user.findUnique({
        where: { id },
        include: { assignedRole: true },
      });
      const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
      if (!liveTarget || !adminRoles.includes(liveTarget.role)) {
        throw new NotFoundException('Administrator account not found');
      }

      // 5. Prevent self-deactivation
      if (liveActor.id === id && !dto.isActive) {
        throw new BadRequestException('You cannot deactivate your own administrative account');
      }

      // 6. Super Admin sovereignty: Only Super Admin can deactivate a Super Admin
      const isTargetSuperAdmin =
        liveTarget.roleId === superAdminRole.id &&
        liveTarget.assignedRole?.slug === 'super_admin' &&
        liveTarget.isActive;

      if (isTargetSuperAdmin && liveActor.assignedRole?.slug !== 'super_admin') {
        throw new ForbiddenException('Only Super Admins can deactivate a Super Admin account.');
      }

      // 7. Last active Super Admin protection
      if (isTargetSuperAdmin && !dto.isActive) {
        const activeSuperAdminCount = await tx.user.count({
          where: {
            roleId: superAdminRole.id,
            role: UserRole.ADMIN,
            isActive: true,
          },
        });

        if (activeSuperAdminCount <= 1) {
          throw new BadRequestException('Cannot deactivate the last active Super Admin account');
        }
      }

      // 8. Execute update
      const updatedUser = await tx.user.update({
        where: { id },
        data: { isActive: dto.isActive },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // If deactivated, revoke all refresh token sessions immediately
      if (!dto.isActive) {
        await tx.refreshToken.deleteMany({
          where: { userId: id },
        });
      }

      await tx.auditLog.create({
        data: {
          action: dto.isActive ? 'ADMIN_USER_ACTIVATED' : 'ADMIN_USER_DEACTIVATED',
          entityType: 'user',
          entityId: id,
          description: `Administrator ${liveActor.email} ${dto.isActive ? 'activated' : 'deactivated'} administrator account for ${liveTarget.email}`,
          userId: liveActor.id,
        },
      });

      this.logger.log(`Administrator ${id} status updated to ${dto.isActive} by ${liveActor.email}`);

      return {
        success: true,
        message: dto.isActive
          ? 'Administrator account activated successfully'
          : 'Administrator account deactivated and all active sessions revoked',
        data: updatedUser,
      };
    });
  }

  /**
   * Update administrator role (Promote / Demote / Dynamic Role Assignment).
   * Acquires the advisory lock FIRST, re-verifies live actor & target, and preserves last Super Admin.
   */
  async updateRole(id: string, dto: UpdateAdminRoleDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      // 1. FIRST STATEMENT: Acquire mutual exclusion lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      // 2. Fetch authoritative super_admin system role
      const superAdminRole = await tx.role.findUniqueOrThrow({
        where: { slug: 'super_admin' },
      });

      // 3. Re-read live actor
      const liveActor = await tx.user.findUnique({
        where: { id: actor.id },
        include: { assignedRole: true },
      });
      if (
        !liveActor ||
        !liveActor.isActive ||
        liveActor.role !== UserRole.ADMIN ||
        liveActor.assignedRole?.slug !== 'super_admin'
      ) {
        throw new ForbiddenException('Only a verified Super Admin can assign or modify administrator roles.');
      }

      // 4. Re-read live target
      const liveTarget = await tx.user.findUnique({
        where: { id },
        include: { assignedRole: true },
      });
      const adminRoles: UserRole[] = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF];
      if (!liveTarget || !adminRoles.includes(liveTarget.role)) {
        throw new NotFoundException('Administrator account not found');
      }

      // 5. Prevent self-role modification
      if (liveActor.id === id) {
        throw new BadRequestException('You cannot modify your own administrative role');
      }

      // Resolve new dynamic role or explicit quarantine removal
      let newRole: any = null;
      const isTargetActiveSuperAdmin =
        liveTarget.roleId === superAdminRole.id &&
        liveTarget.assignedRole?.slug === 'super_admin' &&
        liveTarget.isActive;

      if (dto.roleId === null) {
        // Explicit quarantine / removal of dynamic role access
        if (isTargetActiveSuperAdmin) {
          const activeSuperAdminCount = await tx.user.count({
            where: {
              roleId: superAdminRole.id,
              role: UserRole.ADMIN,
              isActive: true,
            },
          });
          if (activeSuperAdminCount <= 1) {
            throw new BadRequestException('Cannot remove role access from the last active Super Admin account');
          }
        }
      } else {
        let newRoleId = dto.roleId;
        if (!newRoleId) {
          const defaultRole = await tx.role.findFirst({
            where: { slug: dto.role === UserRole.ADMIN ? 'project_manager' : dto.role === UserRole.MANAGER ? 'product_manager' : 'order_manager' },
          });
          newRoleId = defaultRole?.id;
        }

        newRole = await tx.role.findUnique({ where: { id: newRoleId } });
        if (!newRole || !newRole.isActive) {
          throw new BadRequestException('The selected dynamic role is invalid or deactivated.');
        }

        if (isTargetActiveSuperAdmin && newRole.slug !== 'super_admin') {
          const activeSuperAdminCount = await tx.user.count({
            where: {
              roleId: superAdminRole.id,
              role: UserRole.ADMIN,
              isActive: true,
            },
          });

          if (activeSuperAdminCount <= 1) {
            throw new BadRequestException('Cannot demote the last active Super Admin account');
          }
        }
      }

      // 7. Execute update
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          roleId: newRole ? newRole.id : null,
          role: dto.role || liveTarget.role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          assignedRole: {
            select: { id: true, name: true, slug: true },
          },
          isActive: true,
          updatedAt: true,
        },
      });

      // Invalidate existing sessions so permissions refresh immediately
      await tx.refreshToken.deleteMany({ where: { userId: id } });

      await tx.auditLog.create({
        data: {
          action: newRole ? 'ADMIN_ROLE_UPDATED' : 'ADMIN_ROLE_ACCESS_REMOVED',
          entityType: 'user',
          entityId: id,
          description: newRole
            ? `Super Admin ${liveActor.email} assigned role '${newRole.name}' (${newRole.slug}) to ${liveTarget.email}`
            : `Super Admin ${liveActor.email} removed dynamic role access from ${liveTarget.email}`,
          userId: liveActor.id,
        },
      });

      this.logger.log(`Administrator ${id} role updated to ${newRole ? newRole.slug : 'unassigned'} by ${liveActor.email}`);

      return {
        success: true,
        message: newRole
          ? `Administrator role updated to ${newRole.name}`
          : 'Administrator dynamic role access removed successfully',
        data: updatedUser,
      };
    });
  }

  /**
   * List pending / active invitations.
   */
  async findInvitations() {
    const invitations = await this.prisma.adminInvitation.findMany({
      where: {
        usedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        roleId: true,
        roleRelation: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: invitations,
    };
  }

  /**
   * Revoke a pending invitation (participates in advisory lock).
   */
  async revokeInvitation(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

      const liveActor = await tx.user.findUnique({
        where: { id: actor.id },
        include: { assignedRole: true },
      });
      if (
        !liveActor ||
        !liveActor.isActive ||
        liveActor.role !== UserRole.ADMIN ||
        !liveActor.assignedRole?.isActive
      ) {
        throw new ForbiddenException('Only active administrators can revoke invitations');
      }

      const invitation = await tx.adminInvitation.findUnique({
        where: { id },
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found');
      }

      if (invitation.usedAt) {
        throw new BadRequestException('Cannot revoke an invitation that has already been used');
      }

      await tx.adminInvitation.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_INVITATION_REVOKED',
          entityType: 'admin_invitation',
          entityId: id,
          description: `Administrator ${liveActor.email} revoked pending invitation for ${invitation.email}`,
          userId: liveActor.id,
        },
      });

      this.logger.log(`Invitation ${id} revoked by ${liveActor.email}`);

      return {
        success: true,
        message: 'Invitation revoked successfully',
      };
    });
  }

  /**
   * Update administrator profile details (name, phone).
   */
  async updateProfile(id: string, dto: UpdateAdminProfileDto, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) {
        throw new NotFoundException('Administrator account not found');
      }

      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          roleId: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'ADMIN_PROFILE_UPDATED',
          entityType: 'user',
          entityId: id,
          description: `Administrator ${actor.email} updated profile details for ${user.email}`,
          userId: actor.id,
        },
      });

      return {
        success: true,
        message: 'Administrator profile updated successfully',
        data: updated,
      };
    });
  }

  /**
   * Trigger administrator password reset link email.
   */
  async triggerPasswordReset(id: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Administrator account not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('Cannot reset password for deactivated administrator account');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    await this.notificationsService.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetUrl,
      expiresHours: 1,
    });

    await this.prisma.auditLog.create({
      data: {
        action: 'ADMIN_PASSWORD_RESET_REQUESTED',
        entityType: 'user',
        entityId: id,
        description: `Administrator ${actor.email} initiated password reset for ${user.email}`,
        userId: actor.id,
      },
    });

    return {
      success: true,
      message: `Password reset instructions sent to ${user.email}`,
    };
  }

  /**
   * Retrieve chronological audit history for an administrator.
   */
  async getAuditHistory(id: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: id },
          { userId: id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      success: true,
      data: logs,
    };
  }

  /**
   * Export administrators to CSV or Excel (.xlsx) with formula injection protection.
   */
  async exportAdminUsers(query: AdminExportQueryDto, res: Response) {
    const where: Prisma.UserWhereInput = {
      role: query.role ? query.role : { in: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
    };

    if (query.roleId) {
      where.roleId = query.roleId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      include: {
        assignedRole: {
          include: {
            _count: { select: { permissions: true } },
          },
        },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'desc' }],
    });

    const format = query.format || 'csv';

    // Mitigation for CSV / Spreadsheet Formula Injection (=, +, -, @, tabs)
    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
      }
      return str;
    };

    if (format === 'csv') {
      const headers = [
        'Administrator ID',
        'Full Name',
        'Email',
        'Phone',
        'Role Name',
        'Role Slug',
        'Account Status',
        'Effective Permissions',
        'Created Date',
        'Last Login',
      ];

      const rows = users.map((u) => {
        const status = !u.isActive ? 'Inactive' : !u.roleId ? 'Quarantined' : 'Active';
        const roleName = u.assignedRole?.name || 'Unassigned';
        const roleSlug = u.assignedRole?.slug || 'none';
        const permCount = u.assignedRole?.slug === 'super_admin' ? 46 : (u.assignedRole?._count?.permissions || 0);
        return [
          sanitize(u.id),
          sanitize(u.name),
          sanitize(u.email),
          sanitize(u.phone || 'N/A'),
          sanitize(roleName),
          sanitize(roleSlug),
          sanitize(status),
          String(permCount),
          sanitize(u.createdAt.toISOString()),
          sanitize('N/A'),
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="administrators_${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.send(csvContent);
    } else {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Administrators');

      worksheet.columns = [
        { header: 'Administrator ID', key: 'id', width: 28 },
        { header: 'Full Name', key: 'name', width: 24 },
        { header: 'Email', key: 'email', width: 30 },
        { header: 'Phone', key: 'phone', width: 18 },
        { header: 'Role Name', key: 'roleName', width: 20 },
        { header: 'Role Slug', key: 'roleSlug', width: 20 },
        { header: 'Account Status', key: 'status', width: 16 },
        { header: 'Effective Permissions', key: 'permissions', width: 22 },
        { header: 'Created Date', key: 'createdAt', width: 24 },
        { header: 'Last Login', key: 'lastLogin', width: 16 },
      ];

      worksheet.getRow(1).font = { bold: true };

      for (const u of users) {
        const status = !u.isActive ? 'Inactive' : !u.roleId ? 'Quarantined' : 'Active';
        const roleName = u.assignedRole?.name || 'Unassigned';
        const roleSlug = u.assignedRole?.slug || 'none';
        const permCount = u.assignedRole?.slug === 'super_admin' ? 46 : (u.assignedRole?._count?.permissions || 0);

        worksheet.addRow({
          id: sanitize(u.id),
          name: sanitize(u.name),
          email: sanitize(u.email),
          phone: sanitize(u.phone || 'N/A'),
          roleName: sanitize(roleName),
          roleSlug: sanitize(roleSlug),
          status: sanitize(status),
          permissions: permCount,
          createdAt: u.createdAt.toISOString(),
          lastLogin: 'N/A',
        });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="administrators_${new Date().toISOString().slice(0, 10)}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }
  }
}
