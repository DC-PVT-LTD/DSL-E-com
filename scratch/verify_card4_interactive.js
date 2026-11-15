const { chromium } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/frontend/node_modules/playwright');
const path = require('path');
const fs = require('fs');

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

  // Locate scroll stack container
  const stack = page.locator('.scroll-stack--contained');
  await stack.scrollIntoViewIfNeeded();

  console.log('Testing Desktop Scroll Stack Card 4:');

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
  console.log('Scroll Info:', scrollInfo);

  // Scroll to Card 4 pinned position (index 3)
  const card4Pin = (scrollInfo.slot3Top || 1800) - (600 * 0.15 + 72);
  console.log('Calculated Card 4 Pin scroll:', card4Pin);

  await stack.evaluate((el, target) => { el.scrollTop = target + 50; }, card4Pin);
  await page.waitForTimeout(600);

  // 1. Initial State: SPEED selected by default
  await page.screenshot({ path: path.join(outDir, 'card4_default_speed.png'), fullPage: false });
  console.log('Saved card4_default_speed.png (Default SPEED selection)');

  // 2. Click DOMS logo
  const domsBtn = page.locator('button[aria-label="Select DOMS brand information"]');
  await domsBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card4_selected_doms.png'), fullPage: false });
  console.log('Saved card4_selected_doms.png (DOMS selected)');

  // 3. Click LINC logo
  const lincBtn = page.locator('button[aria-label="Select LINC brand information"]');
  await lincBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card4_selected_linc.png'), fullPage: false });
  console.log('Saved card4_selected_linc.png (LINC selected)');

  // 4. Click flexoffice logo
  const flexBtn = page.locator('button[aria-label="Select flexoffice brand information"]');
  await flexBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card4_selected_flexoffice.png'), fullPage: false });
  console.log('Saved card4_selected_flexoffice.png (flexoffice selected)');

  // 5. Mobile Viewport
  console.log('Testing Mobile Viewport:');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileScrollInfo = await stack.evaluate((el) => {
    const slots = el.querySelectorAll('[data-stack-slot]');
    return {
      slot3Top: slots[3]?.offsetTop,
    };
  });
  const mobileCard4Pin = (mobileScrollInfo.slot3Top || 1800) - (600 * 0.15 + 72);

  await stack.evaluate((el, target) => { el.scrollTop = target + 50; }, mobileCard4Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card4_mobile_speed.png'), fullPage: false });
  console.log('Saved card4_mobile_speed.png');

  await browser.close();
  console.log('Verification completed successfully!');
})();

