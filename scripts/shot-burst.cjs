const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:5173';
const OUT = path.resolve(__dirname);

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
  }, re.source);
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await click(/play/);
  await new Promise((r) => setTimeout(r, 2000));
  await click(/START MATCH/);
  const N = 20;
  for (let i = 0; i < N; i++) {
    await new Promise((r) => setTimeout(r, 1300));
    await page.screenshot({ path: path.join(OUT, `burst-${String(i).padStart(2, '0')}.png`) });
  }
  console.log('burst done');
  await browser.close();
})().catch((e) => { console.error('ERR', e); process.exit(1); });
