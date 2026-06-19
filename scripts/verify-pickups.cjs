// Live check for ice pickups (WO-16). A match runs; a token spawns and is synced to
// the client store + rendered; the pickup event drives the callout + chime. (Spawn
// cadence, collection, the boost/charge effects, and the goalie exclusion are covered
// deterministically by shared/src/sim/world.test.ts.)
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
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

  const results = [];
  const check = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  const clickExact = (label) => page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
    if (b) { b.click(); return true; } return false;
  }, label);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(400);
  await clickExact('QUICK PLAY');
  await sleep(3000);
  await clickExact('START MATCH ▶');

  // a token spawns ~9s into the period — poll until one shows up in the store
  let pk = 0;
  for (let i = 0; i < 24; i++) {
    await sleep(1000);
    pk = await page.evaluate(() => window.bbh.useUi.getState().pickups.length);
    if (pk >= 1) break;
  }
  check('a pickup spawned + synced to the client', pk >= 1, `pickups=${pk}`);

  const kinds = await page.evaluate(() => window.bbh.useUi.getState().pickups.map((p) => p.kind));
  check('synced pickups have a valid kind', kinds.every((k) => k === 'boost' || k === 'charge'), JSON.stringify(kinds));
  await page.screenshot({ path: path.join(OUT, 'pickups-1-onice.png') });

  // the pickup event drives my callout (forced, so it doesn't depend on a bot path)
  const calledOut = await page.evaluate(async () => {
    const my = window.bbh.useUi.getState().mySkaterId;
    window.bbh.net.events.emit('pickup', { by: my, kind: 'charge' });
    await new Promise((r) => setTimeout(r, 200));
    return /CHARGED/.test(document.body.innerText);
  });
  check('my pickup fires a callout', calledOut === true);

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('[error]')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== ICE PICKUPS VERIFICATION ===');
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
