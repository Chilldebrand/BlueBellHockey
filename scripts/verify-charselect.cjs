// Live check for character-select depth (WO-12): ultimate descriptions + the idle
// 3D preview that follows the hovered/selected skater.
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
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

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
  const bodyText = () => page.evaluate(() => document.body.innerText);

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(400);
  await clickByText(/play/);
  await sleep(3500); // connect -> character select

  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
  check('character-select preview canvas present', canvases >= 2, `canvases=${canvases}`);

  // default pick is Blaze -> Afterburner description should be on screen
  let txt = await bodyText();
  check('shows the selected ultimate description', /Blazing speed burst/i.test(txt), txt.slice(0, 0) || '');
  await page.screenshot({ path: path.join(OUT, 'charselect-1-default.png') });

  // hover Sniper -> hero updates to the Cannon description without selecting
  const handles = await page.$$('button');
  let hovered = false;
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent, h);
    if (/^Sniper/.test(t.trim())) { await h.hover(); hovered = true; break; }
  }
  await sleep(600);
  txt = await bodyText();
  check('hovering a card found', hovered);
  check('hover updates the hero ultimate description', /guaranteed goal/i.test(txt));
  await page.screenshot({ path: path.join(OUT, 'charselect-2-hover-sniper.png') });

  const realErrors = logs.filter((l) => (l.includes('PAGEERROR') || l.includes('console.error')) && !/favicon|Failed to load resource/.test(l));
  check('no console errors in character select', realErrors.length === 0, realErrors.join(' | ') || 'clean');

  console.log('\n=== CHARACTER-SELECT VERIFICATION ===');
  console.log(results.join('\n'));
  console.log('\n=== console errors/warnings ===');
  console.log(logs.join('\n') || '[none]');
  const failed = results.filter((r) => r.startsWith('FAIL'));
  await browser.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('SCRIPT ERROR', e); process.exit(2); });
