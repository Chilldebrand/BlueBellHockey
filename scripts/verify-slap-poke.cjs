// Live check for the slap shot + stick-lift/poke-check feature (WO-08).
//  1. Lobby: the rebind panel exposes the new actions (Shoot / Slap, Stick Lift,
//     Poke Check) with their default binds — proves the binding wiring end-to-end.
//  2. A match runs under the new server schema/events without console errors.
//  3. Best-effort: hold shoot while chasing the puck to try to catch a wind-up ring.
// The slap power curve, release-to-fire, poke-knocks-loose, stick-lift-takes, and
// poke cooldown are all covered deterministically by shared/src/sim/world.test.ts.
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

  const clickByText = (re) => page.evaluate((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  }, re.source);

  // Read the action label + its key chips from a row in the Controls panel.
  const rowFor = (label) => page.evaluate((label) => {
    const rows = [...document.querySelectorAll('div')].filter((d) => {
      const first = d.children[0];
      return first && first.textContent === label && d.querySelector('button');
    });
    const row = rows[rows.length - 1];
    if (!row) return null;
    const chips = [...row.querySelectorAll('span')].map((s) => s.textContent.replace(/✕$/, '').trim()).filter(Boolean);
    const pad = [...row.querySelectorAll('button')].map((b) => b.textContent).find((t) => /🎮/.test(t)) || '';
    return { chips, pad };
  }, label);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);

  // 1. open controls, assert the new actions + their defaults
  await clickByText(/Controls/);
  await sleep(400);
  const shoot = await rowFor('Shoot / Slap');
  const lift = await rowFor('Stick Lift');
  const poke = await rowFor('Poke Check');
  check('panel shows "Shoot / Slap"', !!shoot, JSON.stringify(shoot));
  check('panel shows "Stick Lift" (F / LB)', !!lift && lift.chips.includes('F') && /LB/.test(lift.pad), JSON.stringify(lift));
  check('panel shows "Poke Check" (G / LT)', !!poke && poke.chips.includes('G') && /LT/.test(poke.pad), JSON.stringify(poke));
  await page.screenshot({ path: path.join(OUT, 'slap-1-controls.png') });
  await clickByText(/Done/);
  await sleep(300);

  // 2. run a match under the new server
  await clickByText(/play/);
  await sleep(3000);
  await clickByText(/START MATCH/);
  await sleep(5000);
  const stillConnected = await page.evaluate(() => !document.querySelector('h1')); // lobby <h1> gone => in game
  check('match started + running under new server schema', stillConnected);
  await page.screenshot({ path: path.join(OUT, 'slap-2-match.png') });

  // 3. best-effort: chase the puck holding shoot, try to catch a wind-up
  await page.keyboard.down('j'); // hold shoot (charges whenever we carry)
  for (const k of ['w', 'a', 'd', 's', 'w']) {
    await page.keyboard.down(k);
    await sleep(700);
    await page.keyboard.up(k);
  }
  await page.screenshot({ path: path.join(OUT, 'slap-3-holding-shoot.png') });
  await page.keyboard.up('j'); // release -> any charged shot fires
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, 'slap-4-after-release.png') });

  const errors = logs.filter((l) => l.includes('PAGEERROR') || l.includes('console.error'));
  // a missing-favicon 404 is pre-existing and unrelated
  const realErrors = errors.filter((l) => !/favicon|Failed to load resource/.test(l));
  check('no unexpected console errors during play', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== SLAP / POKE VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
