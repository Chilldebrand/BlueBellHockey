const puppeteer = require('puppeteer-core');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const logs = [];
  page.on('pageerror', (e) => logs.push(`[PAGEERROR] ${e.message}`));

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>/play/i.test(b.textContent))?.click());
  await new Promise((r) => setTimeout(r, 3000));      // PLAY only — do NOT start match
  await page.screenshot({ path: path.join(__dirname, 'shot-3-playonly.png') });

  const dom = await page.evaluate(() => {
    const root = document.getElementById('root');
    const txt = (root && root.textContent) || '';
    return { charSelect:/Choose your skater/i.test(txt), phaseText: txt.replace(/\s+/g,' ').slice(0,120) };
  });
  logs.push(`[diag] PLAY-only DOM: ${JSON.stringify(dom)}`);
  console.log(logs.join('\n'));
  await browser.close();
})().catch((e)=>{console.error('ERR',e);process.exit(1);});
