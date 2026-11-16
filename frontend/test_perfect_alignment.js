const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const dots = await page.$$('button[aria-label*="slide" i], button[aria-label*="Slide" i]');
  if (dots.length >= 2) {
    await dots[1].click();
    await page.waitForTimeout(1000);
  }

  // Find the exact rendered bounding box of hero-content.png
  const rect = await page.evaluate(() => {
    const img = document.querySelector('img[src*="hero-content.png"]');
    if (!img) return null;
    const r = img.getBoundingClientRect();

    // An object-contain image in a container:
    // Container size:
    const cw = img.clientWidth;
    const ch = img.clientHeight;
    // Image natural aspect ratio:
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const scale = Math.min(cw / nw, ch / nh);
    const rw = nw * scale;
    const rh = nh * scale;
    const rx = (cw - rw) / 2;
    const ry = (ch - rh) / 2;

    return {
      cw, ch, nw, nh, scale, rw, rh, rx, ry,
      imgRect: { left: r.left, top: r.top, width: r.width, height: r.height }
    };
  });

  console.log('RENDER METRICS:', rect);
  await browser.close();
})();

