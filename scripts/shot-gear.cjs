const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const SHOTS = [
  ['knight.glb', '0', 'gear-knight.png'],
  ['mage.glb', '1', 'gear-mage.png'],
  ['barbarian.glb', '0', 'gear-barbarian.png'],
  ['druid.glb', '1', 'gear-druid.png'],
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=700,700'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 700, height: 700 });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));
  for (const [m, t, out] of SHOTS) {
    await page.goto(`http://localhost:5173/sticktest.html?m=${m}&t=${t}`, { waitUntil: 'load', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 2500));
    await page.screenshot({ path: path.join(__dirname, out) });
    console.log('shot', out);
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
