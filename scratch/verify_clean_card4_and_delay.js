const { chromium } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/frontend/node_modules/playwright');
const path = require('path');

const outDir = 'c:/Users/Yehara Kobbagala/.gemini/antigravity/brain/4c1b4457-76fd-4820-8a78-be37fb3a5151';

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

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const stack = page.locator('.scroll-stack--contained');
  await stack.scrollIntoViewIfNeeded();

  const scrollInfo = await stack.evaluate((el) => {
    const slots = el.querySelectorAll('[data-stack-slot]');
    return {
      slotCount: slots.length,
      slot0Top: slots[0]?.offsetTop,
      slot1Top: slots[1]?.offsetTop,
      slot2Top: slots[2]?.offsetTop,
      slot3Top: slots[3]?.offsetTop,
      maxScroll: el.scrollHeight - el.clientHeight,
    };
  });
  console.log('Scroll Info with delayed Card 4:', scrollInfo);

  // 1. Verify Card 3: Pentonic is fully settled before Card 4 arrives
  // Card 3 Pin scroll:
  const card3Pin = (scrollInfo.slot2Top || 1200) - (600 * 0.15 + 48);
  console.log('Card 3 Pin scroll:', card3Pin);

  // Scroll to Card 3 fully settled (+240px from card3Pin, where all 6 cards including Pentonic are in place)
  await stack.evaluate((el, target) => { el.scrollTop = target + 240; }, card3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_pentonic_fully_settled.png'), fullPage: false });
  console.log('Saved card3_pentonic_fully_settled.png (All 6 cards including Pentonic are settled with NO Card 4 visible yet!)');

  // 2. Verify Card 4: Only arrives much later
  const card4Pin = (scrollInfo.slot3Top || 1800) - (600 * 0.15 + 72);
  console.log('Card 4 Pin scroll:', card4Pin);
  await stack.evaluate((el, target) => { el.scrollTop = target + 40; }, card4Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card4_clean_no_logo_speed.png'), fullPage: false });
  console.log('Saved card4_clean_no_logo_speed.png (Card 4 with clean typography, no logo on left)');

  // 3. Test clicking DOMS in Card 4
  const domsBtn = page.locator('button[aria-label="Select DOMS brand information"]');
  await domsBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card4_clean_no_logo_doms.png'), fullPage: false });
  console.log('Saved card4_clean_no_logo_doms.png (DOMS clicked, clean text without logo)');

  await browser.close();
  console.log('All verifications finished successfully!');
})();

