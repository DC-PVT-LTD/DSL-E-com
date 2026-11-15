const { chromium } = require('playwright');
const path = require('path');

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

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Click slide 1 button to ensure FirstHeroSlide is active
  const slide1Btn = await page.$('button[aria-label="Go to slide 1"]');
  if (slide1Btn) {
    await slide1Btn.click();
    console.log('Clicked Go to slide 1');
  }
  await page.waitForTimeout(1000);

  const targetDir = 'C:/Users/Yehara Kobbagala/.gemini/antigravity/brain/4c1b4457-76fd-4820-8a78-be37fb3a5151/scratch';

  // Find FirstHeroSlide container
  const heroStage = await page.$('.aspect-\\[16\\/9\\]');
  if (heroStage) {
    await heroStage.screenshot({ path: path.join(targetDir, 'browser_hero_stage.png') });
    console.log('Captured browser_hero_stage.png');
  }

  await page.screenshot({ path: path.join(targetDir, 'browser_desktop_full.png'), fullPage: false });
  console.log('Captured browser_desktop_full.png');

  // Mobile test
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);

  const heroStageMobile = await page.$('.aspect-\\[16\\/9\\]');
  if (heroStageMobile) {
    await heroStageMobile.screenshot({ path: path.join(targetDir, 'browser_hero_stage_mobile.png') });
    console.log('Captured browser_hero_stage_mobile.png');
  }

  await page.screenshot({ path: path.join(targetDir, 'browser_mobile_full.png'), fullPage: false });
  console.log('Captured browser_mobile_full.png');

  await browser.close();
  console.log('Done capturing screenshots!');
})();
