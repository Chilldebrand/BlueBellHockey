// Live check for game modes (WO-15). Confirms the lobby exposes the mode selector,
// and that picking 1-on-1 actually builds a one-skater-per-side roster and flows the
// mode through to the room + character-select. (First-to-5 / blitz end conditions are
// covered deterministically by shared/src/sim/world.test.ts.)
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
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1100,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 800 });
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

  const hasModes = await page.evaluate(() => ['Regulation', 'First to 5', 'Blitz', '1-on-1'].every((l) => [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === l)));
  check('lobby shows all four game modes', hasModes);

  // pick 1-on-1, then Quick Play
  await clickExact('1-on-1');
  await sleep(200);
  await clickExact('QUICK PLAY');
  await sleep(4000);

  const info = await page.evaluate(() => {
    const s = window.bbh.useUi.getState();
    const snap = window.bbh.net.snapshots[window.bbh.net.snapshots.length - 1];
    let skaters = 0, goalies = 0, t0 = 0, t1 = 0;
    if (snap) for (const id of Object.keys(snap.skaters)) {
      const sk = snap.skaters[id];
      if (sk.isGoalie) goalies++; else { skaters++; if (sk.team === 0) t0++; else t1++; }
    }
    return { gameMode: s.gameMode, skaters, goalies, t0, t1, banner: /1-on-1/.test(document.body.innerText) };
  });
  check('mode flowed to the room as 1v1', info.gameMode === '1v1', JSON.stringify(info));
  check('1-on-1 builds one skater per side', info.skaters === 2 && info.t0 === 1 && info.t1 === 1, JSON.stringify(info));
  check('both goalies still present', info.goalies === 2);
  check('character-select shows the mode name', info.banner === true);
  await page.screenshot({ path: path.join(OUT, 'modes-1-1v1.png') });

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('[error]')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== GAME MODES VERIFICATION ===');
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
