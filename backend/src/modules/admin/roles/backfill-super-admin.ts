import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserRole } from '../../../generated/prisma';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:yehara123%40A@localhost:5432/dsl_stationery?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const AUTHORITATIVE_PERMISSIONS = [
  // Products (4)
  { key: 'products.view', displayName: 'View Products', category: 'Products', description: 'View products catalogue and details' },
  { key: 'products.create', displayName: 'Create Products', category: 'Products', description: 'Create new products and variants' },
  { key: 'products.edit', displayName: 'Edit Products', category: 'Products', description: 'Update products, variants, and toggle status' },
  { key: 'products.delete', displayName: 'Delete Products', category: 'Products', description: 'Deactivate products and variants' },

  // Categories (4)
  { key: 'categories.view', displayName: 'View Categories', category: 'Categories', description: 'View categories' },
  { key: 'categories.create', displayName: 'Create Categories', category: 'Categories', description: 'Create new categories' },
  { key: 'categories.edit', displayName: 'Edit Categories', category: 'Categories', description: 'Update categories' },
  { key: 'categories.delete', displayName: 'Delete Categories', category: 'Categories', description: 'Delete categories' },

  // Brands (4)
  { key: 'brands.view', displayName: 'View Brands', category: 'Brands', description: 'View brands' },
  { key: 'brands.create', displayName: 'Create Brands', category: 'Brands', description: 'Create new brands' },
  { key: 'brands.edit', displayName: 'Edit Brands', category: 'Brands', description: 'Update brands' },
  { key: 'brands.delete', displayName: 'Delete Brands', category: 'Brands', description: 'Delete brands' },

  // Inventory (2)
  { key: 'inventory.view', displayName: 'View Inventory', category: 'Inventory', description: 'View inventory movements, stock levels, and low-stock alerts' },
  { key: 'inventory.update', displayName: 'Adjust Inventory', category: 'Inventory', description: 'Perform stock adjustments' },

  // Orders (3)
  { key: 'orders.view', displayName: 'View Orders', category: 'Orders', description: 'View orders, order details, stats, and audit history' },
  { key: 'orders.update_status', displayName: 'Update Order Status', category: 'Orders', description: 'Update order processing status' },
  { key: 'orders.add_notes', displayName: 'Add Order Notes', category: 'Orders', description: 'Add operational notes to orders' },

  // School Packs (2)
  { key: 'school_packs.view', displayName: 'View School Packs', category: 'School Packs', description: 'View school packs and configuration' },
  { key: 'school_packs.manage', displayName: 'Manage School Packs', category: 'School Packs', description: 'Create, update, and manage school packs' },

  // Uploaded Documents (2)
  { key: 'uploaded_documents.view', displayName: 'View Uploaded Documents', category: 'Uploaded Documents', description: 'View customer uploaded stationery lists' },
  { key: 'uploaded_documents.manage', displayName: 'Manage Uploaded Documents', category: 'Uploaded Documents', description: 'Review and edit customer uploaded stationery items' },

  // Promotions (2)
  { key: 'promotions.view', displayName: 'View Promotions', category: 'Promotions', description: 'View promotions, codes, and redemptions' },
  { key: 'promotions.manage', displayName: 'Manage Promotions', category: 'Promotions', description: 'Create, edit, activate, and deactivate promotions' },

  // Banners (2)
  { key: 'banners.view', displayName: 'View Banners', category: 'Banners', description: 'View homepage banners' },
  { key: 'banners.manage', displayName: 'Manage Banners', category: 'Banners', description: 'Create, edit, reorder, and duplicate banners' },

  // Newsletter (2)
  { key: 'newsletter.view', displayName: 'View Newsletter', category: 'Newsletter', description: 'View subscribers and consent history' },
  { key: 'newsletter.export', displayName: 'Export Newsletter', category: 'Newsletter', description: 'Export newsletter subscriber list' },

  // Recommendations (2)
  { key: 'recommendations.view', displayName: 'View Recommendations', category: 'Recommendations', description: 'View recommendation rules' },
  { key: 'recommendations.manage', displayName: 'Manage Recommendations', category: 'Recommendations', description: 'Create, edit, toggle, and delete recommendation rules' },

  // Audit Logs (1)
  { key: 'audit_logs.view', displayName: 'View Audit Logs', category: 'Audit Logs', description: 'View platform audit logs' },

  // Uploads (1)
  { key: 'uploads.create', displayName: 'Upload Media', category: 'Uploads', description: 'Upload product, brand, and banner images' },

  // Admins (3)
  { key: 'admins.view', displayName: 'View Admins', category: 'Admins', description: 'View administrator accounts' },
  { key: 'admins.manage', displayName: 'Manage Admins', category: 'Admins', description: 'Activate or deactivate administrators' },
  { key: 'admins.invite', displayName: 'Invite Admins', category: 'Admins', description: 'Send and revoke administrator invitations' },

  // Roles (4)
  { key: 'roles.view', displayName: 'View Roles', category: 'Roles', description: 'View roles and permissions' },
  { key: 'roles.manage', displayName: 'Manage Roles', category: 'Roles', description: 'Create, edit, and delete custom roles' },
  { key: 'roles.assign', displayName: 'Assign Roles', category: 'Roles', description: 'Assign roles to administrators' },
  { key: 'roles.assign_permissions', displayName: 'Assign Permissions', category: 'Roles', description: 'Assign permissions to roles' },
];

export const INITIAL_SYSTEM_ROLES = [
  {
    name: 'Super Admin',
    slug: 'super_admin',
    description: 'Root system administrator with unrestricted sovereignty and configuration rights.',
    isSystem: true,
    permissionKeys: AUTHORITATIVE_PERMISSIONS.map((p) => p.key), // All 38
  },
  {
    name: 'Project Manager',
    slug: 'project_manager',
    description: 'Operations manager overseeing catalogue, inventory, orders, marketing, and school packs.',
    isSystem: true,
    permissionKeys: [
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
      'brands.view', 'brands.create', 'brands.edit', 'brands.delete',
      'inventory.view', 'inventory.update',
      'orders.view', 'orders.update_status', 'orders.add_notes',
      'school_packs.view', 'school_packs.manage',
      'uploaded_documents.view', 'uploaded_documents.manage',
      'promotions.view', 'promotions.manage',
      'banners.view', 'banners.manage',
      'newsletter.view', 'newsletter.export',
      'recommendations.view', 'recommendations.manage',
      'audit_logs.view',
      'uploads.create',
      'admins.view',
    ], // Exactly 32
  },
  {
    name: 'Product Manager',
    slug: 'product_manager',
    description: 'Catalogue manager handling products, categories, brands, school packs, and recommendations.',
    isSystem: true,
    permissionKeys: [
      'products.view', 'products.create', 'products.edit', 'products.delete',
      'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
      'brands.view', 'brands.create', 'brands.edit', 'brands.delete',
      'inventory.view', 'inventory.update',
      'school_packs.view', 'school_packs.manage',
      'recommendations.view', 'recommendations.manage',
      'uploads.create',
    ], // Exactly 19
  },
  {
    name: 'Order Manager',
    slug: 'order_manager',
    description: 'Fulfillment specialist processing orders, verifying stock, and reviewing uploaded stationery lists.',
    isSystem: true,
    permissionKeys: [
      'orders.view', 'orders.update_status', 'orders.add_notes',
      'inventory.view',
      'uploaded_documents.view', 'uploaded_documents.manage',
    ], // Exactly 6
  },
  {
    name: 'Customer Manager',
    slug: 'customer_manager',
    description: 'Customer service and marketing representative handling promotions, newsletters, and order lookups.',
    isSystem: true,
    permissionKeys: [
      'promotions.view', 'promotions.manage',
      'newsletter.view', 'newsletter.export',
      'orders.view',
      'uploaded_documents.view',
    ], // Exactly 6
  },
];

export async function runBackfill(primarySuperAdminEmail = process.env.PRIMARY_SUPER_ADMIN_EMAIL || 'admin@dslstationery.lk') {
  console.log(`Starting Phase 3 Backfill with primary Super Admin: ${primarySuperAdminEmail}`);

  return prisma.$transaction(async (tx) => {
    // 1. Acquire PostgreSQL transaction advisory mutex
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dsl_super_admin_mutex'))`;

    // 2. Seed all 38 permissions
    console.log(`Seeding ${AUTHORITATIVE_PERMISSIONS.length} authoritative permissions...`);
    for (const perm of AUTHORITATIVE_PERMISSIONS) {
      await tx.permission.upsert({
        where: { key: perm.key },
        update: {
          displayName: perm.displayName,
          description: perm.description,
          category: perm.category,
        },
        create: {
          key: perm.key,
          displayName: perm.displayName,
          description: perm.description,
          category: perm.category,
        },
      });
    }

    // 3. Create or update the 5 System Roles
    console.log(`Creating 5 System Roles...`);
    const roleIdMap: Record<string, string> = {};

    for (const roleDef of INITIAL_SYSTEM_ROLES) {
      const role = await tx.role.upsert({
        where: { slug: roleDef.slug },
        update: {
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
        create: {
          name: roleDef.name,
          slug: roleDef.slug,
          description: roleDef.description,
          isSystem: true,
          isActive: true,
        },
      });
      roleIdMap[roleDef.slug] = role.id;

      // Map role permissions
      for (const permKey of roleDef.permissionKeys) {
        const perm = await tx.permission.findUniqueOrThrow({ where: { key: permKey } });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: perm.id,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: perm.id,
          },
        });
      }
    }

    // 4. Assign ONLY primary Super Admin (admin@dslstationery.lk)
    const superAdminRoleId = roleIdMap['super_admin'];
    const primaryAdmin = await tx.user.findFirst({
      where: {
        email: {
          equals: primarySuperAdminEmail,
          mode: 'insensitive',
        },
      },
    });

    if (primaryAdmin) {
      console.log(`Assigning Super Admin role to primary administrator: ${primaryAdmin.email}`);
      await tx.user.update({
        where: { id: primaryAdmin.id },
        data: {
          roleId: superAdminRoleId,
          role: UserRole.ADMIN,
          isActive: true,
        },
      });
    } else {
      console.warn(`WARNING: Primary admin with email '${primarySuperAdminEmail}' was not found!`);
    }

    // 5. Leave ALL other secondary admins strictly unassigned (roleId = null)
    const secondaryAdmins = await tx.user.findMany({
      where: {
        id: primaryAdmin ? { not: primaryAdmin.id } : undefined,
        role: { in: [UserRole.ADMIN, UserRole.STAFF, UserRole.MANAGER] },
      },
    });

    console.log(`Found ${secondaryAdmins.length} secondary administrators. Setting roleId = null for quarantine.`);
    for (const sec of secondaryAdmins) {
      await tx.user.update({
        where: { id: sec.id },
        data: { roleId: null },
      });
    }

    // 6. Handle Historical Invitations
    // Revoke pending legacy invitations in place (usedAt IS NULL -> expiresAt = NOW())
    const revokedPending = await tx.adminInvitation.updateMany({
      where: { usedAt: null },
      data: { expiresAt: new Date() },
    });
    console.log(`Revoked ${revokedPending.count} pending legacy invitations in place.`);

    // Record audit event
    await tx.auditLog.create({
      data: {
        action: 'PHASE3_MIGRATION_BACKFILL_COMPLETED',
        entityType: 'System',
        entityId: 'dsl-ecom-phase3',
        description: `Phase 3 Backfill: Super Admin assigned to ${primarySuperAdminEmail}, ${AUTHORITATIVE_PERMISSIONS.length} permissions seeded, ${secondaryAdmins.length} secondary admins quarantined.`,
        userId: primaryAdmin ? primaryAdmin.id : null,
      },
    });

    console.log('Phase 3 Backfill successfully completed.');
  });
}

if (require.main === module) {
  runBackfill()
    .then(() => {
      console.log('Backfill script finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Backfill script failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
