const { chromium } = require('./frontend/node_modules/playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const artifactDir = 'C:/Users/Yehara Kobbagala/.gemini/antigravity/brain/4c1b4457-76fd-4820-8a78-be37fb3a5151';

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const dot2 = await page.$('button[aria-label="Go to slide 2"]');
  if (dot2) await dot2.click();
  await page.waitForTimeout(1500);

  // Test 3 shift amounts: 100px, 180px, 260px
  for (const shift of [100, 180, 260]) {
    await page.evaluate((s) => {
      // Find left elements: hero-content, product-set, product-shadow, buttons
      const leftElements = Array.from(document.querySelectorAll('img[src*="hero-content"], img[src*="product-set"], img[src*="product-shadow"]'))
        .map(img => img.closest('.pointer-events-none'));
      const buttonsContainer = document.querySelector('div.z-60');

      leftElements.forEach(el => {
        if (el) el.style.transform = `translateX(-${s}px)`;
      });
      if (buttonsContainer) buttonsContainer.style.transform = `translateX(-${s}px)`;

      // Find right elements: children, back-ribbon, front-ribbon
      const rightElements = Array.from(document.querySelectorAll('img[src*="children"], img[src*="back-ribbon"], img[src*="front-ribbon"]'))
        .map(img => img.closest('.pointer-events-none'));

      rightElements.forEach(el => {
        if (el) el.style.transform = `translateX(${s}px)`;
      });
    }, shift);

    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(artifactDir, `shift_${shift}px_1920.png`) });
    console.log(`Captured shift_${shift}px_1920.png`);
  }

  // Also test at 1440x900 with 120px shift
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const s = 120;
    const leftElements = Array.from(document.querySelectorAll('img[src*="hero-content"], img[src*="product-set"], img[src*="product-shadow"]'))
      .map(img => img.closest('.pointer-events-none'));
    const buttonsContainer = document.querySelector('div.z-60');
    leftElements.forEach(el => { if (el) el.style.transform = `translateX(-${s}px)`; });
    if (buttonsContainer) buttonsContainer.style.transform = `translateX(-${s}px)`;

    const rightElements = Array.from(document.querySelectorAll('img[src*="children"], img[src*="back-ribbon"], img[src*="front-ribbon"]'))
      .map(img => img.closest('.pointer-events-none'));
    rightElements.forEach(el => { if (el) el.style.transform = `translateX(${s}px)`; });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(artifactDir, `shift_120px_1440.png`) });
  console.log('Captured shift_120px_1440.png');

  await browser.close();
  console.log('All tests done!');
})();
