import { Prisma } from '../../../generated/prisma';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export const SUPER_ADMIN_MUTEX_SQL = Prisma.sql`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

export interface VerifiedSuperAdminContext {
  actorUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    roleId: string | null;
    isActive: boolean;
    assignedRole: {
      id: string;
      slug: string;
      isSystem: boolean;
      isActive: boolean;
    } | null;
  };
  superAdminRole: {
    id: string;
    slug: string;
    isSystem: boolean;
    isActive: boolean;
  };
  activeSuperAdminCount: number;
}

/**
 * Acquires the PostgreSQL transaction-level advisory mutex and verifies that the live actor
 * is an active Super Admin from the fresh database state.
 */
export async function verifyAndLockSuperAdminActor(
  tx: Prisma.TransactionClient,
  actorId: string,
): Promise<VerifiedSuperAdminContext> {
  // 1. FIRST STATEMENT: Acquire exclusive transaction advisory lock
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

  // 2. Fetch authoritative super_admin system role
  const superAdminRole = await tx.role.findUnique({
    where: { slug: 'super_admin' },
    select: { id: true, slug: true, isSystem: true, isActive: true },
  });

  if (!superAdminRole || !superAdminRole.isActive) {
    throw new InternalServerErrorException('System role super_admin is missing or deactivated.');
  }

  // 3. Re-read live actor record directly from PostgreSQL inside the locked transaction
  const actorUser = await tx.user.findUnique({
    where: { id: actorId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      roleId: true,
      isActive: true,
      assignedRole: {
        select: { id: true, slug: true, isSystem: true, isActive: true },
      },
    },
  });

  // 4. Assert live Super Admin identity
  if (
    !actorUser ||
    !actorUser.isActive ||
    actorUser.role !== 'ADMIN' ||
    !actorUser.assignedRole ||
    !actorUser.assignedRole.isActive ||
    actorUser.assignedRole.slug !== 'super_admin'
  ) {
    throw new ForbiddenException('Security violation: live Super Admin credentials required.');
  }

  // 5. Query active Super Admin count using latest committed database state
  const activeSuperAdminCount = await tx.user.count({
    where: {
      roleId: superAdminRole.id,
      role: 'ADMIN',
      isActive: true,
    },
  });

  return { actorUser, superAdminRole, activeSuperAdminCount };
}

