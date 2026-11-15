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

  console.log('Testing Desktop Scroll Stack Card 3 (Third Section):');

  // Find scroll positions for Card 3
  const scrollInfo = await stack.evaluate((el) => {
    const slots = el.querySelectorAll('[data-stack-slot]');
    return {
      slotCount: slots.length,
      slot0Top: slots[0]?.offsetTop,
      slot1Top: slots[1]?.offsetTop,
      slot2Top: slots[2]?.offsetTop,
      maxScroll: el.scrollHeight - el.clientHeight,
    };
  });
  console.log('Scroll Info:', scrollInfo);

  // Card 3 arrives around ~1000px - 1100px
  // Stage 1: Card 3 Arrival - Empty Background (no cards entered yet)
  const card3Pin = (scrollInfo.slot2Top || 1200) - (600 * 0.15 + 48);
  console.log('Calculated Card 3 Pin scroll:', card3Pin);

  // Scroll to arrival point
  await stack.evaluate((el, target) => { el.scrollTop = target - 5; }, card3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_stage1_arrival.png'), fullPage: false });
  console.log('Saved card3_stage1_arrival.png');

  // Stage 2: Mid-Scroll - Cards entering staggered from multiple directions
  await stack.evaluate((el, target) => { el.scrollTop = target + 160; }, card3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_stage2_entering.png'), fullPage: false });
  console.log('Saved card3_stage2_entering.png');

  // Stage 3: Fully Settled Diagonal Arrangement
  await stack.evaluate((el, target) => { el.scrollTop = target + 340; }, card3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_stage3_settled.png'), fullPage: false });
  console.log('Saved card3_stage3_settled.png');

  // Reverse Scroll back to Stage 1
  await stack.evaluate((el, target) => { el.scrollTop = target - 5; }, card3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_stage1_reversed.png'), fullPage: false });
  console.log('Saved card3_stage1_reversed.png');

  // Mobile Viewport
  console.log('Testing Mobile Viewport:');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileScrollInfo = await stack.evaluate((el) => {
    const slots = el.querySelectorAll('[data-stack-slot]');
    return {
      slot2Top: slots[2]?.offsetTop,
    };
  });
  const mobileCard3Pin = (mobileScrollInfo.slot2Top || 1200) - (600 * 0.15 + 48);

  // Mobile Stage 1
  await stack.evaluate((el, target) => { el.scrollTop = target - 5; }, mobileCard3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_mobile_stage1.png'), fullPage: false });
  console.log('Saved card3_mobile_stage1.png');

  // Mobile Stage 3 (Settled Compact Cascade)
  await stack.evaluate((el, target) => { el.scrollTop = target + 340; }, mobileCard3Pin);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card3_mobile_stage3.png'), fullPage: false });
  console.log('Saved card3_mobile_stage3.png');

  await browser.close();
  console.log('All Card 3 verifications complete!');
})();

