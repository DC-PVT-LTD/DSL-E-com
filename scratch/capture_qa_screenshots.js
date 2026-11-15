const { chromium } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const jwt = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/node_modules/jsonwebtoken');

const envContent = fs.readFileSync('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/backend/.env', 'utf8');
const jwtMatch = envContent.match(/JWT_SECRET=["']?([a-f0-9]+)["']?/i);
const JWT_SECRET = jwtMatch ? jwtMatch[1] : "a9cd9238f31cac2e503e9e863ac589487d7f134f46027159007862a31c5f798503ac3d695f47ca1bdcc99344b133930f1230fb7ea1223ffd9ce47ed99377dc8d";

const adminUser = {
  id: "cmwgeskls0000hgus1mztbhri",
  email: "qa-admin1@dsl.lk",
  role: "ADMIN",
  name: "Alice Requester"
};

const token = jwt.sign(
  { sub: adminUser.id, id: adminUser.id, email: adminUser.email, role: adminUser.role, name: adminUser.name },
  JWT_SECRET,
  { expiresIn: '2h' }
);

const outDir = 'c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/docs/screenshots/stage-2-qa';
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
    } catch (e2) {
      browser = await chromium.launch({ headless: true });
    }
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  await context.addCookies([
    {
      name: 'dsl_access_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax'
    }
  ]);

  const page = await context.newPage();

  // Seed localStorage with admin user
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.evaluate((u) => {
    localStorage.setItem('dsl_user', JSON.stringify(u));
    localStorage.setItem('dsl_admin_token', 'logged-in');
  }, adminUser);

  console.log('--- 1. Capturing Reconciliation Dashboard (Desktop) ---');
  await page.goto('http://localhost:3000/admin/reconciliation', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '01_reconciliation_dashboard_desktop.png'), fullPage: true });
  console.log('Saved 01_reconciliation_dashboard_desktop.png');

  console.log('--- 2. Capturing Reconciliation Dashboard (Mobile) ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '02_reconciliation_dashboard_mobile.png'), fullPage: true });
  console.log('Saved 02_reconciliation_dashboard_mobile.png');

  // Reset to desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });

  console.log('--- 3. Capturing Order 1: Refund Management Card & SoD ---');
  const order1Id = 'cmwgeujdq00012cusax7wjiog';
  await page.goto(`http://localhost:3000/admin/orders/${order1Id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '03_order_refund_management_desktop.png'), fullPage: true });
  console.log('Saved 03_order_refund_management_desktop.png');

  console.log('--- 4. Capturing Order 2: Return Management & REFUNDED Status ---');
  const order2Id = 'cmwgeujz300052cusrlr0io8k';
  await page.goto(`http://localhost:3000/admin/orders/${order2Id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '04_order_return_management_desktop.png'), fullPage: true });
  console.log('Saved 04_order_return_management_desktop.png');

  console.log('--- 5. Capturing COD Order: Blocked Refund Banner ---');
  const codOrderId = 'cmwgeuk4l00092custk03zlg1';
  await page.goto(`http://localhost:3000/admin/orders/${codOrderId}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '05_order_cod_blocked_banner.png'), fullPage: true });
  console.log('Saved 05_order_cod_blocked_banner.png');

  console.log('--- 6. Capturing Order 1 on Mobile Viewport ---');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`http://localhost:3000/admin/orders/${order1Id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '06_order_details_mobile.png'), fullPage: true });
  console.log('Saved 06_order_details_mobile.png');

  await browser.close();
  console.log('All QA screenshots captured successfully!');
})();
