const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  await page.goto('http://localhost:3000/images/hero%202/hero-content.png');

  const rects = await page.evaluate(() => {
    const img = document.querySelector('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    // Scan Shop Catalogue button:
    // It is a blue pill around x: 140..560, y: 640..760
    let b1_minX = 2560, b1_maxX = 0, b1_minY = 1440, b1_maxY = 0;
    // Scan Our Brands button:
    // It is a pill with dark blue outline around x: 550..880, y: 640..760
    let b2_minX = 2560, b2_maxX = 0, b2_minY = 1440, b2_maxY = 0;

    for (let y = 630; y < 770; y++) {
      for (let x = 140; x < 540; x++) {
        const idx = (y * canvas.width + x) * 4;
        const a = data[idx+3];
        // Blue fill of button 1
        if (a > 150) {
          if (x < b1_minX) b1_minX = x;
          if (x > b1_maxX) b1_maxX = x;
          if (y < b1_minY) b1_minY = y;
          if (y > b1_maxY) b1_maxY = y;
        }
      }
      for (let x = 540; x < 870; x++) {
        const idx = (y * canvas.width + x) * 4;
        const a = data[idx+3];
        // Button 2 (border or fill)
        if (a > 150) {
          if (x < b2_minX) b2_minX = x;
          if (x > b2_maxX) b2_maxX = x;
          if (y < b2_minY) b2_minY = y;
          if (y > b2_maxY) b2_maxY = y;
        }
      }
    }

    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      btn1: {
        x: b1_minX, y: b1_minY, w: b1_maxX - b1_minX, h: b1_maxY - b1_minY,
        left: (b1_minX / canvas.width * 100).toFixed(2) + '%',
        top: (b1_minY / canvas.height * 100).toFixed(2) + '%',
        width: ((b1_maxX - b1_minX) / canvas.width * 100).toFixed(2) + '%',
        height: ((b1_maxY - b1_minY) / canvas.height * 100).toFixed(2) + '%',
      },
      btn2: {
        x: b2_minX, y: b2_minY, w: b2_maxX - b2_minX, h: b2_maxY - b2_minY,
        left: (b2_minX / canvas.width * 100).toFixed(2) + '%',
        top: (b2_minY / canvas.height * 100).toFixed(2) + '%',
        width: ((b2_maxX - b2_minX) / canvas.width * 100).toFixed(2) + '%',
        height: ((b2_maxY - b2_minY) / canvas.height * 100).toFixed(2) + '%',
      }
    };
  });

  console.log('EXACT BUTTON COORDINATES:', JSON.stringify(rects, null, 2));
  await browser.close();
})();

