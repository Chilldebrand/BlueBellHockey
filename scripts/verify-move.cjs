const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => console.log('[PAGEERROR]', e.message));

  const click = (re) => page.evaluate((s) => {
    const rx = new RegExp(s, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  }, re);

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await click('play'); await new Promise((r) => setTimeout(r, 2000));
  await click('START MATCH'); await new Promise((r) => setTimeout(r, 5500)); // past countdown into period

  await page.screenshot({ path: path.join(__dirname, 'mv-0-before.png') });
  await page.focus('body');
  await page.keyboard.down('KeyA');
  await new Promise((r) => setTimeout(r, 1800));
  await page.keyboard.up('KeyA');
  await page.screenshot({ path: path.join(__dirname, 'mv-1-after-A.png') });

  console.log('done: pressed A for 1.8s');
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
