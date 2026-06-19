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
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

  const clickByText = (re) => page.evaluate((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  }, re.source);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await clickByText(/play/);
  await new Promise((r) => setTimeout(r, 2500));
  await clickByText(/START MATCH/);
  await new Promise((r) => setTimeout(r, 6000));
  await page.screenshot({ path: path.join(OUT, 'fx-1-match.png') });
  // clipped crops at native res to judge detail
  await page.screenshot({ path: path.join(OUT, 'fx-2-closeup.png'), clip: { x: 360, y: 230, width: 560, height: 320 } }); // center: logo + crowd
  await page.screenshot({ path: path.join(OUT, 'fx-3-stands.png'), clip: { x: 0, y: 200, width: 640, height: 260 } }); // far boards + ads + crowd
  // tight zooms on individual skaters to judge helmet/gear
  await page.screenshot({ path: path.join(OUT, 'fx-4-skaterL.png'), clip: { x: 430, y: 360, width: 220, height: 220 } });
  await page.screenshot({ path: path.join(OUT, 'fx-5-skaterR.png'), clip: { x: 720, y: 350, width: 240, height: 240 } });

  console.log(logs.join('\n') || '[ok] no errors/warnings');
  await browser.close();
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(1); });
