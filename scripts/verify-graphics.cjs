// Live check for the graphics-quality toggle (WO-13). Confirms the Settings panel
// exposes Low/Medium/High, switching tiers updates + persists the store and rebuilds
// the canvas without errors, and the low tier (no post-processing composer) still
// renders an encoded — not washed-out — frame.
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Users\\riche\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173';
const OUT = path.resolve(__dirname);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[console.${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

  const results = [];
  const check = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  const clickExact = (label) => page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
    if (b) { b.click(); return true; } return false;
  }, label);
  const quality = () => page.evaluate(() => window.bbh.useUi.getState().quality);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(400);
  await clickExact('PLAY');
  await sleep(3000);
  await clickExact('START MATCH ▶');
  await sleep(4000);

  // open Settings (the ⚙ button)
  await clickExact('⚙');
  await sleep(400);
  const hasGraphics = await page.evaluate(() => ['Low', 'Medium', 'High'].every((l) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === l)));
  check('Settings panel shows a Graphics tier selector', hasGraphics);

  // switch to Low -> store + localStorage update, canvas survives
  await clickExact('Low');
  await sleep(1200);
  const qLow = await quality();
  const lsLow = await page.evaluate(() => localStorage.getItem('bbh.quality'));
  check('selecting Low updates the store', qLow === 'low', `q=${qLow}`);
  check('quality persisted to localStorage', lsLow === 'low', `ls=${lsLow}`);
  const canvasLow = await page.evaluate(() => document.querySelector('canvas') && document.querySelector('canvas').width > 0);
  check('canvas still rendering on Low', canvasLow === true);
  // close panel + screenshot the low-quality frame to eyeball it isn't washed out
  await clickExact('Done');
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'graphics-1-low.png') });

  // back to High
  await clickExact('⚙');
  await sleep(300);
  await clickExact('High');
  await sleep(1200);
  const qHigh = await quality();
  check('selecting High updates the store', qHigh === 'high', `q=${qHigh}`);
  await clickExact('Done');
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, 'graphics-2-high.png') });

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('console.error')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors switching quality (incl. low/no-composer path)', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== GRAPHICS-QUALITY VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
