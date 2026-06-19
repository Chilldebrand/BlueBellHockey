// Live check for penalties / power play (WO-17). The authoritative penalty logic
// (a check away from the puck boxes the hitter; clean carrier hits don't; boxed
// skaters sit out) is covered by shared/src/sim/world.test.ts. Here we validate the
// client wiring: the penalty event fires the callout + whistle, and the power-play
// banner renders from the derived store state. As a bonus we watch for a real
// bot-drawn penalty flowing server->client.
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
  await sleep(3500);

  // bonus: watch for a real bot-drawn penalty flowing through to the store
  let realPP = false;
  await page.evaluate(() => { window.__pen = 0; window.bbh.net.events.on('penalty', () => window.__pen++); });
  for (let i = 0; i < 18; i++) {
    await sleep(1000);
    const s = await page.evaluate(() => ({ pp: !!window.bbh.useUi.getState().powerPlay, pen: window.__pen }));
    if (s.pp || s.pen > 0) { realPP = true; break; }
  }
  results.push(`INFO  real bot-drawn penalty observed: ${realPP}`);

  // the penalty event fires a callout + whistle
  const callout = await page.evaluate(async () => {
    window.bbh.net.events.emit('penalty', { on: 's3', team: 1 });
    await new Promise((r) => setTimeout(r, 200));
    return /POWER PLAY/.test(document.body.innerText);
  });
  check('penalty event fires the POWER PLAY callout', callout === true);

  // the power-play banner renders from store state (freeze net->store so it holds)
  const banner = await page.evaluate(async () => {
    const { useUi, net } = window.bbh;
    net.onState = () => {};
    const t = useUi.getState().serverTime || 1000;
    useUi.getState().set({ powerPlay: { team: 0, until: t + 6000 } });
    await new Promise((r) => setTimeout(r, 250));
    return /POWER PLAY/.test(document.body.innerText) && /HOME \+1/.test(document.body.innerText);
  });
  check('power-play banner renders for the advantaged team', banner === true);
  await page.screenshot({ path: path.join(OUT, 'powerplay-1.png') });

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('[error]')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== POWER PLAY VERIFICATION ===');
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
