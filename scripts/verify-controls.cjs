// Live check for the custom control-mapping feature.
//  1. Lobby: open the ⚙ Controls panel, screenshot it.
//  2. Rebind a keyboard action (Shoot -> press 'Z'), assert the chip + localStorage.
//  3. Conflict: rebind another action to the same key, assert it moved.
//  4. Reset to defaults, assert restored.
//  5. Persistence: set a binding, reload, assert it survived.
//  6. In-game: PLAY -> START MATCH -> open ⚙ from the HUD, screenshot.
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
  const check = (name, cond, extra = '') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`); };

  const clickByText = (re) => page.evaluate((reSrc) => {
    const rx = new RegExp(reSrc, 'i');
    const b = [...document.querySelectorAll('button')].find((x) => rx.test(x.textContent));
    if (b) { b.click(); return true; } return false;
  }, re.source);

  // Click the "＋ add key" button within the row whose label matches `action`.
  const clickAddForAction = (action) => page.evaluate((action) => {
    const rows = [...document.querySelectorAll('div')].filter((d) => {
      const first = d.children[0];
      return first && first.textContent === action && d.querySelector('button');
    });
    const row = rows[rows.length - 1];
    if (!row) return false;
    const add = [...row.querySelectorAll('button')].find((b) => /＋|Press a key/.test(b.textContent));
    if (add) { add.click(); return true; }
    return false;
  }, action);

  const rowTokens = (action) => page.evaluate((action) => {
    const rows = [...document.querySelectorAll('div')].filter((d) => {
      const first = d.children[0];
      return first && first.textContent === action && d.querySelector('button');
    });
    const row = rows[rows.length - 1];
    if (!row) return null;
    return [...row.querySelectorAll('span')].map((s) => s.textContent.replace(/✕$/, '').trim()).filter(Boolean);
  }, action);

  const readStore = () => page.evaluate(() => JSON.parse(localStorage.getItem('bbh.controls.v1') || 'null'));

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(500);

  // 1. open controls from the lobby
  const opened = await clickByText(/Controls/);
  await sleep(400);
  const panelVisible = await page.evaluate(() => !!document.querySelector('h2') && [...document.querySelectorAll('h2')].some((h) => /Controls/.test(h.textContent)));
  check('lobby ⚙ Controls opens panel', opened && panelVisible);
  await page.screenshot({ path: path.join(OUT, 'controls-1-lobby-panel.png') });

  // 2. rebind Shoot -> Z
  const beforeShoot = await rowTokens('Shoot');
  const addClicked = await clickAddForAction('Shoot');
  await sleep(200);
  await page.keyboard.press('z'); // code = KeyZ
  await sleep(250);
  const afterShoot = await rowTokens('Shoot');
  const storeAfter = await readStore();
  check('rebind: Shoot gains Z chip', !!afterShoot && afterShoot.includes('Z'), `before=[${beforeShoot}] after=[${afterShoot}]`);
  check('rebind: persisted to localStorage', !!storeAfter && storeAfter.keyboard.shoot.includes('KeyZ'), `shoot=${storeAfter && storeAfter.keyboard.shoot}`);
  await page.screenshot({ path: path.join(OUT, 'controls-2-rebound-shoot.png') });

  // 3. conflict: bind Pass -> Z, should move off Shoot
  await clickAddForAction('Pass');
  await sleep(200);
  await page.keyboard.press('z');
  await sleep(250);
  const passTokens = await rowTokens('Pass');
  const shootTokens = await rowTokens('Shoot');
  check('conflict: Z moved to Pass', !!passTokens && passTokens.includes('Z'), `pass=[${passTokens}]`);
  check('conflict: Z removed from Shoot', !!shootTokens && !shootTokens.includes('Z'), `shoot=[${shootTokens}]`);

  // 4. reset to defaults
  await clickByText(/Reset to defaults/);
  await sleep(250);
  const resetStore = await readStore();
  const shootReset = await rowTokens('Shoot');
  check('reset: Shoot back to default J + L-Click', !!shootReset && shootReset.includes('J') && shootReset.includes('L-Click'), `shoot=[${shootReset}]`);
  check('reset: store shoot = [KeyJ, Mouse0]', !!resetStore && JSON.stringify(resetStore.keyboard.shoot) === JSON.stringify(['KeyJ', 'Mouse0']));

  // 5. persistence across reload: rebind Hit -> Y, reload, confirm
  await clickAddForAction('Hit');
  await sleep(200);
  await page.keyboard.press('y');
  await sleep(250);
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(500);
  const persisted = await readStore();
  check('persistence: Hit=Y survived reload', !!persisted && persisted.keyboard.hit.includes('KeyY'), `hit=${persisted && persisted.keyboard.hit}`);
  // clean up so we don't leave a weird binding around
  await page.evaluate(() => localStorage.removeItem('bbh.controls.v1'));

  // 6. in-game HUD entry
  await page.reload({ waitUntil: 'networkidle2' });
  await sleep(400);
  await clickByText(/play/);
  await sleep(3000);
  await clickByText(/START MATCH/);
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, 'controls-3-ingame.png') });
  // the HUD has a ⚙ button; click it
  const gearClicked = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '⚙');
    if (b) { b.click(); return true; } return false;
  });
  await sleep(500);
  const panelInGame = await page.evaluate(() => [...document.querySelectorAll('h2')].some((h) => /Controls/.test(h.textContent)));
  check('in-game ⚙ opens panel over the match', gearClicked && panelInGame);
  await page.screenshot({ path: path.join(OUT, 'controls-4-ingame-panel.png') });

  console.log('\n=== CONTROLS VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
