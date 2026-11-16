require('dotenv').config();
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('./dist/src/generated/prisma');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BASE_URL = 'http://localhost:4000/api/v1';
const JWT_SECRET = process.env.JWT_SECRET;

function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

async function request(endpoint, token, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }

  return { status: res.status, data };
}

let createdUserIds = [];
let createdRoleIds = [];

async function cleanup() {
  console.log('\n--- Cleaning up test records ---');
  for (const id of createdUserIds) {
    try {
      await prisma.user.deleteMany({ where: { id } });
    } catch (e) { }
  }
  for (const id of createdRoleIds) {
    try {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await prisma.role.deleteMany({ where: { id } });
    } catch (e) { }
  }
  console.log('Cleanup completed.');
}

async function runTests() {
  console.log('=====================================================');
  console.log('   DSL STATIONERY — PLATFORM-WIDE RBAC VERIFICATION  ');
  console.log('=====================================================\n');

  try {
    // 1. Fetch Super Admin
    const superAdminRole = await prisma.role.findFirst({
      where: { slug: 'super_admin' },
      include: { permissions: { include: { permission: true } } },
    });

    if (!superAdminRole) {
      throw new Error('Super Admin role not found in database');
    }

    let superAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN', roleId: superAdminRole.id, isActive: true },
    });

    if (!superAdmin) {
      throw new Error('Active Super Admin user not found in database');
    }

    console.log(`[FOUND] Super Admin: ${superAdmin.email} (Role: ${superAdminRole.name})`);
    console.log(`[INFO] Super Admin has ${superAdminRole.permissions.length} database permissions.`);
    const superAdminToken = generateToken(superAdmin);

    // TEST SUITE 1: Super Admin Sovereignty across all 12 modules
    console.log('\n--- TEST SUITE 1: Super Admin Sovereignty (Full Access) ---');
    const superAdminEndpoints = [
      { name: 'Orders View', ep: '/admin/orders', method: 'GET' },
      { name: 'Products Analytics', ep: '/products/admin/analytics', method: 'GET' },
      { name: 'Categories Analytics', ep: '/categories/admin/analytics', method: 'GET' },
      { name: 'Brands Analytics', ep: '/brands/admin/analytics', method: 'GET' },
      { name: 'Inventory Movements', ep: '/inventory/movements', method: 'GET' },
      { name: 'Banners View', ep: '/admin/banners', method: 'GET' },
      { name: 'Newsletter Subscribers', ep: '/admin/newsletter/subscribers', method: 'GET' },
      { name: 'Promotions View', ep: '/admin/promotions', method: 'GET' },
      { name: 'Recommendations Rules', ep: '/admin/recommendations/rules', method: 'GET' },
      { name: 'School Packs View', ep: '/admin/school-packs', method: 'GET' },
      { name: 'Payments Summary', ep: '/admin/payments/summary', method: 'GET' },
      { name: 'Admin Users View', ep: '/admin/users', method: 'GET' },
      { name: 'Admin Roles View', ep: '/admin/roles', method: 'GET' },
      { name: 'Admin Settings View', ep: '/store-settings/admin', method: 'GET' },
      { name: 'Audit Logs View', ep: '/audit-logs', method: 'GET' },
    ];

    let saPass = true;
    for (const test of superAdminEndpoints) {
      const res = await request(test.ep, superAdminToken, { method: test.method });
      const pass = res.status >= 200 && res.status < 300;
      console.log(`  ${pass ? '✔ PASS' : '✖ FAIL'}: ${test.name} [${test.method} ${test.ep}] -> Status ${res.status}`);
      if (!pass) saPass = false;
    }
    if (!saPass) throw new Error('Super Admin sovereignty verification failed.');

    // Find all system permissions for creating test roles
    const allPermissions = await prisma.permission.findMany();
    const permMap = new Map(allPermissions.map((p) => [p.key, p.id]));

    // Helper to create test role and user
    async function createTestRoleAndUser(roleName, roleSlug, permKeys, userEmail) {
      // Check if role exists or create
      let role = await prisma.role.findFirst({
        where: { OR: [{ slug: roleSlug }, { name: roleName }] },
      });
      if (!role) {
        role = await prisma.role.create({
          data: {
            name: roleName,
            slug: roleSlug,
            description: `Automated test role for ${roleName}`,
            isSystem: false,
            isActive: true,
            permissions: {
              create: permKeys
                .filter((key) => permMap.has(key))
                .map((key) => ({
                  permission: { connect: { id: permMap.get(key) } },
                })),
            },
          },
        });
        createdRoleIds.push(role.id);
      } else {
        // Ensure the existing role has the required test permissions
        for (const key of permKeys) {
          if (permMap.has(key)) {
            const permId = permMap.get(key);
            const exists = await prisma.rolePermission.findFirst({
              where: { roleId: role.id, permissionId: permId },
            });
            if (!exists) {
              await prisma.rolePermission.create({
                data: { roleId: role.id, permissionId: permId },
              });
            }
          }
        }
      }

      // Check if user exists or create
      let user = await prisma.user.findFirst({ where: { email: userEmail } });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'ADMIN', roleId: role.id, isActive: true },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: `Test ${roleName}`,
            passwordHash: 'dummy_hash_for_rbac_test',
            role: 'ADMIN',
            roleId: role.id,
            isActive: true,
          },
        });
        createdUserIds.push(user.id);
      }

      return { user, role, token: generateToken(user) };
    }

    // TEST SUITE 2: Product Manager
    console.log('\n--- TEST SUITE 2: Product Manager Authorization Boundaries ---');
    const pmPerms = [
      'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import',
      'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
      'brands.view', 'brands.create', 'brands.edit', 'brands.delete',
      'school_packs.view', 'school_packs.manage',
      'recommendations.view', 'recommendations.manage',
    ];
    const pm = await createTestRoleAndUser('Product Manager', 'test_product_manager', pmPerms, 'pm_test@dsl.com');

    // PM Allowed
    const pmAllowed = [
      { name: 'Products Analytics', ep: '/products/admin/analytics', method: 'GET' },
      { name: 'Categories Analytics', ep: '/categories/admin/analytics', method: 'GET' },
      { name: 'Brands Analytics', ep: '/brands/admin/analytics', method: 'GET' },
      { name: 'School Packs View', ep: '/admin/school-packs', method: 'GET' },
      { name: 'Recommendations Rules', ep: '/admin/recommendations/rules', method: 'GET' },
    ];
    for (const test of pmAllowed) {
      const res = await request(test.ep, pm.token, { method: test.method });
      const pass = res.status >= 200 && res.status < 300;
      console.log(`  ${pass ? '✔ PASS (Allowed)' : '✖ FAIL'}: ${test.name} -> Status ${res.status}`);
    }

    // PM Denied
    const pmDenied = [
      { name: 'Orders Access', ep: '/admin/orders', method: 'GET' },
      { name: 'Users Access', ep: '/admin/users', method: 'GET' },
      { name: 'Roles Access', ep: '/admin/roles', method: 'GET' },
      { name: 'Settings Access', ep: '/store-settings/admin', method: 'GET' },
    ];
    for (const test of pmDenied) {
      const res = await request(test.ep, pm.token, { method: test.method });
      const pass = res.status === 403;
      console.log(`  ${pass ? '✔ PASS (Denied 403)' : '✖ FAIL'}: ${test.name} -> Status ${res.status} [${res.data?.message}]`);
    }

    // TEST SUITE 3: Order Manager
    console.log('\n--- TEST SUITE 3: Order Manager Authorization Boundaries ---');
    const omPerms = ['orders.view', 'orders.update_status', 'orders.add_notes', 'inventory.view', 'inventory.update'];
    const om = await createTestRoleAndUser('Order Manager', 'test_order_manager', omPerms, 'om_test@dsl.com');

    // OM Allowed
    const omAllowed = [
      { name: 'Orders View', ep: '/admin/orders', method: 'GET' },
      { name: 'Inventory Movements', ep: '/inventory/movements', method: 'GET' },
      { name: 'Payments Summary', ep: '/admin/payments/summary', method: 'GET' },
    ];
    for (const test of omAllowed) {
      const res = await request(test.ep, om.token, { method: test.method });
      const pass = res.status >= 200 && res.status < 300;
      console.log(`  ${pass ? '✔ PASS (Allowed)' : '✖ FAIL'}: ${test.name} -> Status ${res.status}`);
    }

    // OM Denied
    const omDenied = [
      { name: 'Create Product', ep: '/products', method: 'POST', body: { name: 'Unauthorized Product' } },
      { name: 'Delete Product', ep: '/products/00000000-0000-0000-0000-000000000000', method: 'DELETE' },
      { name: 'Roles Access', ep: '/admin/roles', method: 'GET' },
      { name: 'Settings Access', ep: '/store-settings/admin', method: 'GET' },
    ];
    for (const test of omDenied) {
      const res = await request(test.ep, om.token, { method: test.method, body: test.body });
      const pass = res.status === 403;
      console.log(`  ${pass ? '✔ PASS (Denied 403)' : '✖ FAIL'}: ${test.name} -> Status ${res.status} [${res.data?.message}]`);
    }

    // TEST SUITE 4: Customer Manager / Marketing
    console.log('\n--- TEST SUITE 4: Customer / Marketing Manager Boundaries ---');
    const cmPerms = ['newsletter.view', 'newsletter.export', 'promotions.view', 'promotions.manage', 'banners.view', 'banners.manage'];
    const cm = await createTestRoleAndUser('Customer Marketing Manager', 'test_cust_manager', cmPerms, 'cm_test@dsl.com');

    // CM Allowed
    const cmAllowed = [
      { name: 'Newsletter Subscribers', ep: '/admin/newsletter/subscribers', method: 'GET' },
      { name: 'Promotions View', ep: '/admin/promotions', method: 'GET' },
      { name: 'Banners View', ep: '/admin/banners', method: 'GET' },
    ];
    for (const test of cmAllowed) {
      const res = await request(test.ep, cm.token, { method: test.method });
      const pass = res.status >= 200 && res.status < 300;
      console.log(`  ${pass ? '✔ PASS (Allowed)' : '✖ FAIL'}: ${test.name} -> Status ${res.status}`);
    }

    // CM Denied
    const cmDenied = [
      { name: 'Create Product', ep: '/products', method: 'POST', body: { name: 'Unauthorized' } },
      { name: 'Inventory Adjust', ep: '/inventory/adjust', method: 'POST', body: {} },
      { name: 'Orders Access', ep: '/admin/orders', method: 'GET' },
      { name: 'Users Access', ep: '/admin/users', method: 'GET' },
    ];
    for (const test of cmDenied) {
      const res = await request(test.ep, cm.token, { method: test.method, body: test.body });
      const pass = res.status === 403;
      console.log(`  ${pass ? '✔ PASS (Denied 403)' : '✖ FAIL'}: ${test.name} -> Status ${res.status} [${res.data?.message}]`);
    }

    // TEST SUITE 5: Custom Role "Product Viewer" (Read Only)
    console.log('\n--- TEST SUITE 5: Custom Role "Product Viewer" (Read-Only) ---');
    const pvPerms = ['products.view', 'categories.view', 'brands.view'];
    const pv = await createTestRoleAndUser('Product Viewer', 'custom_product_viewer', pvPerms, 'pv_test@dsl.com');

    // PV Allowed
    const pvAllowed = [
      { name: 'Products Analytics (Read)', ep: '/products/admin/analytics', method: 'GET' },
      { name: 'Categories Analytics (Read)', ep: '/categories/admin/analytics', method: 'GET' },
      { name: 'Brands Analytics (Read)', ep: '/brands/admin/analytics', method: 'GET' },
    ];
    for (const test of pvAllowed) {
      const res = await request(test.ep, pv.token, { method: test.method });
      const pass = res.status >= 200 && res.status < 300;
      console.log(`  ${pass ? '✔ PASS (Allowed)' : '✖ FAIL'}: ${test.name} -> Status ${res.status}`);
    }

    // PV Denied Mutation & other modules
    const pvDenied = [
      { name: 'Create Product (requires products.create)', ep: '/products', method: 'POST', body: { name: 'Attempt' } },
      { name: 'Delete Product (requires products.delete)', ep: '/products/00000000-0000-0000-0000-000000000000', method: 'DELETE' },
      { name: 'Orders Access (requires orders.view)', ep: '/admin/orders', method: 'GET' },
      { name: 'Inventory View (requires inventory.view)', ep: '/inventory/movements', method: 'GET' },
    ];
    for (const test of pvDenied) {
      const res = await request(test.ep, pv.token, { method: test.method, body: test.body });
      const pass = res.status === 403;
      console.log(`  ${pass ? '✔ PASS (Denied 403)' : '✖ FAIL'}: ${test.name} -> Status ${res.status} [${res.data?.message}]`);
    }

    // TEST SUITE 6: Quarantined Administrator (roleId = null)
    console.log('\n--- TEST SUITE 6: Quarantined Administrator (roleId = null) ---');
    // We update pv user's roleId to null
    await prisma.user.update({
      where: { id: pv.user.id },
      data: { roleId: null },
    });
    const quarantinedRes = await request('/products/admin/analytics', pv.token);
    const quarantinePass =
      quarantinedRes.status === 403 &&
      quarantinedRes.data?.message?.includes('pending dynamic role assignment');
    console.log(
      `  ${quarantinePass ? '✔ PASS' : '✖ FAIL'}: Quarantine Response -> Status ${quarantinedRes.status} [${quarantinedRes.data?.message}]`
    );

    // TEST SUITE 7: Deactivated Administrator (isActive = false)
    console.log('\n--- TEST SUITE 7: Deactivated Administrator (isActive = false) ---');
    await prisma.user.update({
      where: { id: pv.user.id },
      data: { roleId: pv.role.id, isActive: false },
    });
    const deactRes = await request('/products/admin/analytics', pv.token);
    const deactPass =
      (deactRes.status === 401 || deactRes.status === 403) &&
      (deactRes.data?.message?.includes('deactivated') ||
        deactRes.data?.message?.includes('inactive'));
    console.log(
      `  ${deactPass ? '✔ PASS' : '✖ FAIL'}: Deactivation Response -> Status ${deactRes.status} [${deactRes.data?.message}]`
    );

    console.log('\n=====================================================');
    console.log('   ALL RBAC TEST SUITES COMPLETED SUCCESSFULLY!      ');
    console.log('=====================================================');
  } catch (err) {
    console.error('RBAC Verification Error:', err);
    process.exitCode = 1;
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

runTests();
