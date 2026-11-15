const { chromium } = require('playwright');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
  } catch (e) {
    browser = await chromium.launch({ headless: true });
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Click slide 2 button to show SchoolPackHeroSlide
  const slide2Btn = await page.$('button[aria-label="Go to slide 2"]');
  if (slide2Btn) await slide2Btn.click();
  await page.waitForTimeout(600);

  const dimsDesktop = await page.evaluate(() => {
    const el = document.querySelector('a[href="/school-packs"]')?.closest('.relative.w-full.h-full') || document.querySelector('a[href="/school-packs"]')?.closest('section > div > div:nth-child(2) > div');
    const rect = el?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  });
  console.log('Slide 2 on Desktop 1440x900:', dimsDesktop);

  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(400);
  const dims1080 = await page.evaluate(() => {
    const el = document.querySelector('a[href="/school-packs"]')?.closest('.relative.w-full.h-full') || document.querySelector('a[href="/school-packs"]')?.closest('section > div > div:nth-child(2) > div');
    const rect = el?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  });
  console.log('Slide 2 on Desktop 1920x1080:', dims1080);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const dimsMobile = await page.evaluate(() => {
    const el = document.querySelector('a[href="/school-packs"]')?.closest('section > div > div:nth-child(2) > div');
    const rect = el?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  });
  console.log('Slide 2 on Mobile 390x844:', dimsMobile);

  await browser.close();
})();

