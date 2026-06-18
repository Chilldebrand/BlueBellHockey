const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=900,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 900 });
  page.on('console', (m) => console.log('[console]', m.text()));
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
  await page.goto('http://localhost:5173/sticktest.html', { waitUntil: 'load', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3500));
  await page.screenshot({ path: path.join(__dirname, 'stick-closeup.png') });
  console.log('attached=', await page.evaluate(() => window.__stickAttached));
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
