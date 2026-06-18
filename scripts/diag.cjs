const puppeteer = require('puppeteer-core');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:5173';
const OUT = path.resolve(__dirname);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', (m) => { const t=m.type(); if (t==='error'||t==='warning') logs.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) logs.push(`[HTTP ${r.status()}] ${r.url()}`); });

  const clickByText = (re) => page.evaluate((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  }, re.source);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await clickByText(/play/);
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: path.join(OUT, 'shot-1-charselect.png') });

  const started = await clickByText(/START MATCH/);
  logs.push(`[diag] START MATCH clicked: ${started}`);
  await new Promise((r) => setTimeout(r, 5000));
  await page.screenshot({ path: path.join(OUT, 'shot-2-match.png') });

  const dom = await page.evaluate(() => {
    const root = document.getElementById('root');
    const txt = (root && root.textContent) || '';
    return { rootKids: root ? root.childElementCount : -1, blank: txt.trim().length < 5,
      charSelect: /Choose your skater/i.test(txt), canvas: !!document.querySelector('canvas'),
      bodyText: txt.replace(/\s+/g,' ').slice(0, 160) };
  });
  logs.push(`[diag] DOM after START: ${JSON.stringify(dom)}`);

  console.log(logs.join('\n'));
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
