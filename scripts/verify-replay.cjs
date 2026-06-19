// Live check for the goal-replay system (WO-10).
//  1. A match runs; the snapshot ring buffer fills with action.
//  2. Firing a goal triggers the slow-mo replay: replayActive flips true, the
//     letterbox + INSTANT REPLAY overlay shows, and the goal cam drops in.
//  3. The replay ends on its own and rendering returns to live (replayActive false).
// We emit the goal through the dev hook (window.bbh.net.events) so the trigger path
// (goalReplay.trigger over real captured snapshots + goal cam + overlay) is exercised
// deterministically rather than waiting for bots to score. The deferred faceoff that
// keeps the puck in the net is covered by shared/src/sim/world.test.ts.
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

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);
  await clickByText(/play/);
  await sleep(3000);
  await clickByText(/START MATCH/);
  await sleep(4000);

  // skate around to fill the snapshot buffer with motion to replay
  for (const k of ['w', 'd', 's', 'a', 'w']) { await page.keyboard.down(k); await sleep(500); await page.keyboard.up(k); }

  const bufLen = await page.evaluate(() => window.bbh?.net.snapshots.length ?? 0);
  check('snapshot buffer filled for capture', bufLen >= 10, `len=${bufLen}`);

  // fire a goal -> replay should start
  const camBefore = await page.evaluate(() => {
    window.bbh.net.events.emit('goal', { team: 0 });
    return null;
  });
  await sleep(500);
  const during = await page.evaluate(() => ({
    active: window.bbh.useUi.getState().replayActive,
    overlay: /INSTANT REPLAY/.test(document.body.innerText),
  }));
  check('replay activates on a goal', during.active === true, JSON.stringify(during));
  check('INSTANT REPLAY overlay visible during replay', during.overlay === true);
  await page.screenshot({ path: path.join(OUT, 'replay-1-during.png') });

  // it should end on its own and return to live within a few seconds
  let ended = false;
  for (let i = 0; i < 12; i++) {
    await sleep(500);
    const a = await page.evaluate(() => window.bbh.useUi.getState().replayActive);
    if (!a) { ended = true; break; }
  }
  check('replay ends on its own and returns to live', ended);
  await sleep(300);
  await page.screenshot({ path: path.join(OUT, 'replay-2-after.png') });
  const overlayGone = await page.evaluate(() => !/INSTANT REPLAY/.test(document.body.innerText));
  check('overlay cleared after replay', overlayGone);

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('console.error')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors through the replay', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== GOAL REPLAY VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
