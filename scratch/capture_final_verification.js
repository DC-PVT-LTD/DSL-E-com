const { chromium } = require('c:/Users/Yehara Kobbagala/Desktop/Projects/DSL E-com/frontend/node_modules/playwright');
const path = require('path');

const outDir = 'c:/Users/Yehara Kobbagala/.gemini/antigravity/brain/4c1b4457-76fd-4820-8a78-be37fb3a5151';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const stack = page.locator('.scroll-stack--contained');
  await stack.scrollIntoViewIfNeeded();

  // 1. Card 3 Stage 1: Arrival (scrollTop = 1310)
  await stack.evaluate((el) => { el.scrollTop = 1310; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card3_stage1_arrival.png'), fullPage: false });
  console.log('Saved card3_stage1_arrival.png');

  // 2. Card 3 Stage 2: Staggered entry (scrollTop = 1450)
  await stack.evaluate((el) => { el.scrollTop = 1450; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card3_stage2_entering.png'), fullPage: false });
  console.log('Saved card3_stage2_entering.png');

  // 3. Card 3 Stage 3: All 6 cards INCLUDING PENTONIC fully settled (scrollTop = 1620)
  await stack.evaluate((el) => { el.scrollTop = 1620; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card3_stage3_all_6_settled.png'), fullPage: false });
  console.log('Saved card3_stage3_all_6_settled.png');

  // 4. Card 3 holding comfortably before Card 4 appears (scrollTop = 1850)
  await stack.evaluate((el) => { el.scrollTop = 1850; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card3_holding_before_card4.png'), fullPage: false });
  console.log('Saved card3_holding_before_card4.png');

  // 5. Card 4 arrival: clean typography, NO logo on left (scrollTop = 2150)
  await stack.evaluate((el) => { el.scrollTop = 2150; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'card4_clean_speed_no_logo.png'), fullPage: false });
  console.log('Saved card4_clean_speed_no_logo.png');

  // 6. Click DOMS on Card 4
  const domsBtn = page.locator('button[aria-label="Select DOMS brand information"]');
  await domsBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'card4_clean_doms_no_logo.png'), fullPage: false });
  console.log('Saved card4_clean_doms_no_logo.png');

  await browser.close();
  console.log('All captures complete!');
})();

