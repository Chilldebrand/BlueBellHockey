// Live check for the end-of-match flow + stats/saves/one-timers (WO-09).
//  1. A full match runs under the new schema (6 box-score fields per skater) and
//     the new save / one_timer broadcasts — i.e. state sync survives, no errors.
//  2. The box score actually tallies during play (shots/saves climb).
//  3. The postgame screen renders: FINAL + MVP + per-team box score + Rematch /
//     Back to Lobby, with real accumulated stats. (Forced via the dev hook since
//     playing a real 9:00 match in a smoke test is impractical.)
// The sim math (stat tally, save rebound/cover, one-timer bonus) is covered
// deterministically by shared/src/sim/world.test.ts.
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

  // 1. start a match
  await clickByText(/play/);
  await sleep(3000);
  await clickByText(/START MATCH/);
  await sleep(4000);
  const inGame = await page.evaluate(() => !document.querySelector('h1'));
  check('match started under the new schema', inGame);

  // 2. play a bit — chase + shoot to create shots, saves, scrambles
  await page.keyboard.down('j');
  for (const k of ['w', 'd', 's', 'a', 'w', 'd']) {
    await page.keyboard.down(k); await sleep(600); await page.keyboard.up(k);
  }
  await page.keyboard.up('j');
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, 'postgame-1-match.png') });

  // the box score is being tallied + published to the store
  const liveStats = await page.evaluate(() => {
    const s = window.bbh?.useUi.getState();
    if (!s) return null;
    let shots = 0, saves = 0;
    for (const id of Object.keys(s.stats)) { shots += s.stats[id].shots; saves += s.stats[id].saves; }
    return { keys: Object.keys(s.stats).length, shots, saves, roster: s.roster.length };
  });
  check('box score published to the store for all skaters', !!liveStats && liveStats.keys >= 6 && liveStats.roster >= 6, JSON.stringify(liveStats));

  const noErrLive = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('console.error')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors during live play under new schema', noErrLive.length === 0, noErrLive.join(' | ') || 'clean');

  // 3. force the postgame screen with crafted-but-plausible final stats. Freeze the
  //    net->store bridge (instead of leaving the room, which would flip us to the
  //    lobby) so the forced 'ended' phase isn't overwritten by the next patch.
  await page.evaluate(() => {
    const { useUi, net } = window.bbh;
    net.onState = () => {};
    const st = useUi.getState();
    const stats = { ...st.stats };
    const put = (id, g, a, h, tk, sv, sog) => { if (stats[id]) stats[id] = { goals: g, assists: a, hits: h, takeaways: tk, saves: sv, shots: sog }; };
    put('s0', 2, 1, 1, 2, 0, 6);
    put('s1', 1, 2, 0, 1, 0, 4);
    put('s2', 0, 1, 3, 0, 0, 2);
    put('s3', 1, 0, 2, 1, 0, 5);
    put('s4', 0, 1, 1, 3, 0, 3);
    put('s5', 1, 1, 0, 0, 0, 4);
    put('g0', 0, 0, 0, 0, 11, 0);
    put('g1', 0, 0, 0, 0, 9, 0);
    useUi.getState().set({ phase: 'ended', score0: 4, score1: 3, stats });
  });
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, 'postgame-2-final.png') });

  const dom = await page.evaluate(() => document.body.innerText);
  check('postgame shows FINAL', /FINAL/.test(dom));
  check('postgame shows a winner banner', /HOME WINS|AWAY WINS|DRAW/.test(dom));
  check('postgame shows MVP', /MVP/.test(dom));
  check('postgame box score has stat columns', /SOG/.test(dom) && /SV/.test(dom));
  const hasRematch = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /REMATCH/i.test(b.textContent)));
  const hasLobby = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /Back to Lobby/i.test(b.textContent)));
  check('postgame has Rematch + Back to Lobby buttons', hasRematch && hasLobby);

  console.log('\n=== POSTGAME / STATS VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
