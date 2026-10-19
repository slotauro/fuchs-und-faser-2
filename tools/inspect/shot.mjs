// Screenshot-Helfer: node shot.mjs <url> <out.png> [waitMs] [steps...]
// Schritt: "taste:ms" hält eine Taste, "taste" tippt sie, "wait:ms" wartet, "state" gibt den Spielzustand aus.
import { chromium } from '@playwright/test';
const [url, out, wait = '2500', ...steps] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.waitForTimeout(Number(wait));
for (const s of steps) {
  const [key, ms] = s.split(':');
  if (key === 'wait') await page.waitForTimeout(Number(ms));
  else if (key === 'state') {
    console.log(await page.evaluate(() => {
      const st = window.__ff.state();
      const p = st.players[0];
      return JSON.stringify({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), carrying: p.carrying, job: p.job?.kind, dug: st.cells.flatMap((c, i) => (c.dug ? [i] : [])), cable: st.cells.flatMap((c, i) => (c.cable ? [i] : [])) });
    }));
  } else if (ms) {
    await page.keyboard.down(key);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(key);
  } else await page.keyboard.press(key);
  await page.waitForTimeout(60);
}
await page.screenshot({ path: out });
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close();
