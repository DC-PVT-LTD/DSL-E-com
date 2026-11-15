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
  
  const targetDir = 'C:/Users/Yehara Kobbagala/.gemini/antigravity/brain/4c1b4457-76fd-4820-8a78-be37fb3a5151/scratch';
  
  // Find the ScrollStack section and scroll to it
  const stackSection = await page.$('section[aria-label="Feature Highlights Stack"]');
  if (stackSection) {
    console.log('Found Feature Highlights Stack section, scrolling into view...');
    await stackSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000); // allow in-view animations to finish
    
    // Screenshot the section
    await stackSection.screenshot({ path: path.join(targetDir, 'browser_scroll_stack_card1_desktop.png') });
    console.log('Captured browser_scroll_stack_card1_desktop.png');
  } else {
    console.log('Could not find stackSection');
  }

  // Mobile viewport test (390 x 844)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1000);
  const mobileStackSection = await page.$('section[aria-label="Feature Highlights Stack"]');
  if (mobileStackSection) {
    await mobileStackSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);
    await mobileStackSection.screenshot({ path: path.join(targetDir, 'browser_scroll_stack_card1_mobile.png') });
    console.log('Captured browser_scroll_stack_card1_mobile.png');
  }

  await browser.close();
  console.log('Done capturing ScrollStack screenshots!');
})();
