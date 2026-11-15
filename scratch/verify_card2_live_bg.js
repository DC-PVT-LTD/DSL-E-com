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
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Locate scroll stack container
  const stack = page.locator('.scroll-stack--contained');
  await stack.scrollIntoViewIfNeeded();

  console.log('Testing Desktop Scroll Stack Card 2:');

  // Frame 1: Scroll to Card 2 arrival (~540px)
  await stack.evaluate((el) => { el.scrollTop = 535; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_frame1_arrival.png'), fullPage: false });
  console.log('Saved card2_live_frame1_arrival.png');

  // Frame 2: Mid-scroll (~675px)
  await stack.evaluate((el) => { el.scrollTop = 675; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_frame2_floating.png'), fullPage: false });
  console.log('Saved card2_live_frame2_floating.png');

  // Frame 3: Settled Stack (~815px)
  await stack.evaluate((el) => { el.scrollTop = 815; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_frame3_stacked.png'), fullPage: false });
  console.log('Saved card2_live_frame3_stacked.png');

  // Reverse Scroll back to Frame 1
  await stack.evaluate((el) => { el.scrollTop = 535; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_reverse_frame1.png'), fullPage: false });
  console.log('Saved card2_live_reverse_frame1.png');

  // Mobile Viewport by resizing existing page
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  await stack.evaluate((el) => { el.scrollTop = 535; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_mobile_frame1.png'), fullPage: false });
  console.log('Saved card2_live_mobile_frame1.png');

  await stack.evaluate((el) => { el.scrollTop = 815; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(outDir, 'card2_live_mobile_frame3.png'), fullPage: false });
  console.log('Saved card2_live_mobile_frame3.png');

  await browser.close();
  console.log('Verification completed successfully!');
})();
