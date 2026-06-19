// Live check for the music bed + living crowd (WO-11). Audio can't be "heard" in a
// headless run, so we validate the things that actually break: the Web Audio graph
// builds without throwing, the context runs after the PLAY gesture, the crowd +
// music subsystems exist, the music mood follows the match phase, the music toggle
// wires through, and events (goal/save) drive the crowd without errors.
const puppeteer = require('puppeteer-core');

const CHROME = 'C:\\Users\\riche\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800', '--autoplay-policy=no-user-gesture-required'],
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
  await sleep(400);

  // PLAY is the user gesture that boots the AudioContext + music/crowd
  await clickByText(/play/);
  await sleep(2500);

  const afterInit = await page.evaluate(() => {
    const s = window.bbh.sfx;
    return { ctx: s.ctx ? s.ctx.state : 'none', music: !!s.music, crowd: !!s.crowd };
  });
  check('AudioContext created + running', afterInit.ctx === 'running', JSON.stringify(afterInit));
  check('crowd + music subsystems built', afterInit.music && afterInit.crowd);

  // in the lobby/char-select the music mood should be "menu"
  const menuMood = await page.evaluate(() => window.bbh.sfx.music && window.bbh.sfx.music.mood);
  check('menu mood in lobby', menuMood === 'menu', `mood=${menuMood}`);

  // start the match -> mood should switch to "game"
  await clickByText(/START MATCH/);
  await sleep(4000);
  const gameMood = await page.evaluate(() => window.bbh.sfx.music && window.bbh.sfx.music.mood);
  check('game mood once the period starts', gameMood === 'game', `mood=${gameMood}`);

  // music toggle button flips the store + stops the bed without error
  const toggled = await page.evaluate(() => {
    const before = window.bbh.useUi.getState().musicOn;
    const btn = [...document.querySelectorAll('button')].find((b) => b.title && /Music/i.test(b.title));
    btn && btn.click();
    return { before, after: window.bbh.useUi.getState().musicOn, hadBtn: !!btn };
  });
  check('music toggle button flips musicOn', toggled.hadBtn && toggled.before === true && toggled.after === false, JSON.stringify(toggled));
  await sleep(300);
  const moodOff = await page.evaluate(() => window.bbh.sfx.music.mood);
  check('music stops when toggled off', moodOff === null, `mood=${moodOff}`);
  // turn it back on
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.title && /Music/i.test(x.title)); b && b.click(); });

  // events drive the crowd without throwing
  await page.evaluate(() => {
    window.bbh.net.events.emit('goal', { team: 0 });
    window.bbh.net.events.emit('save', { rebound: true });
    window.bbh.net.events.emit('hit', {});
  });
  await sleep(600);
  const exciteRose = await page.evaluate(() => window.bbh.sfx.crowd && window.bbh.sfx.crowd.excite > 0);
  check('crowd excitement rises on a goal/save', exciteRose === true);

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('console.error')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors building/driving the audio graph', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== AUDIO (MUSIC + CROWD) VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
