// Live check for friend lobbies — room codes + team pick (WO-14). Two browser
// pages prove the real behavior: a player creates a private room (Home), a second
// joins by that code (Away), and they end up in the SAME room (both appear as human
// skaters to each other) on the teams they chose.
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Users\\riche\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173';
const OUT = path.resolve(__dirname);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 760 });
  page._logs = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') page._logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', (e) => page._logs.push(`[PAGEERROR] ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(400);
  return page;
}
const clickExact = (page, label) => page.evaluate((label) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === label);
  if (b) { b.click(); return true; } return false;
}, label);
const state = (page) => page.evaluate(() => {
  const s = window.bbh.useUi.getState();
  const snap = window.bbh.net.snapshots[window.bbh.net.snapshots.length - 1];
  let humans = 0;
  if (snap) for (const id of Object.keys(snap.skaters)) { const sk = snap.skaters[id]; if (!sk.isGoalie && !sk.isBot) humans++; }
  return { roomCode: s.roomCode, myTeam: s.myTeam, status: s.status, humans };
});

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1100,760'],
  });

  const results = [];
  const check = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);

  // Player A: pick Home, create a private room
  const a = await newPage(browser);
  await clickExact(a, 'Home');
  await clickExact(a, '✦ Create private room');
  await sleep(3500);
  const aState = await state(a);
  check('A created a room with a 4-char code', /^[A-Z0-9]{4}$/.test(aState.roomCode), `code=${aState.roomCode}`);
  check('A was placed on Home (team 0)', aState.myTeam === 0, `team=${aState.myTeam}`);
  await a.screenshot({ path: path.join(OUT, 'rooms-1-host.png') });

  const code = aState.roomCode;

  // Player B: pick Away, join by that code
  const b = await newPage(browser);
  await clickExact(b, 'Away');
  await b.type('input[placeholder="ROOM CODE"]', code);
  await clickExact(b, 'JOIN');
  await sleep(3500);
  const bState = await state(b);
  check('B joined the room by code', bState.roomCode === code, `code=${bState.roomCode}`);
  check('B was placed on Away (team 1)', bState.myTeam === 1, `team=${bState.myTeam}`);
  check('B sees two humans (same room as A)', bState.humans === 2, `humans=${bState.humans}`);

  // and A now sees B too
  await sleep(800);
  const aAfter = await state(a);
  check('A also sees two humans after B joins', aAfter.humans === 2, `humans=${aAfter.humans}`);
  await b.screenshot({ path: path.join(OUT, 'rooms-2-joiner.png') });

  const logs = [...a._logs, ...b._logs].filter((l) => (l.includes('PAGEERROR') || l.includes('[error]')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors across both clients', logs.length === 0, logs.join(' | ') || 'clean');

  console.log('\n=== ROOM CODES / TEAM PICK VERIFICATION ===');
  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
