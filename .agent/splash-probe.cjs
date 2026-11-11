// Mede se a motinha está visível na tela de abertura em 3 cenários.
const { chromium } = require('C:/Users/camil/Downloads/teste app/novaesweb-test-center/node_modules/playwright');
const scenarios = [
  { name: 'normal', reducedMotion: 'no-preference', pref: false },
  { name: 'android-sem-animacoes', reducedMotion: 'reduce', pref: false },
  { name: 'pref-app-reduzir-animacoes', reducedMotion: 'no-preference', pref: true },
];
(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const s of scenarios) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: s.reducedMotion });
    if (s.pref) await ctx.addInitScript(() => localStorage.setItem('nw:driver-experience:v1', JSON.stringify({ reducedMotion: true })));
    const page = await ctx.newPage();
    await page.route('**/*', r => new URL(r.request().url()).hostname === '127.0.0.1' ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:4188/');
    const samples = [];
    for (const ms of [500, 1200, 2000]) {
      await page.waitForTimeout(ms - (samples.length ? [500, 1200, 2000][samples.length - 1] : 0));
      samples.push(await page.evaluate(() => {
        const v = document.querySelector('.nw-startup__vehicle');
        if (!v) return 'sem-elemento';
        const r = v.getBoundingClientRect();
        const visible = r.right > 0 && r.left < innerWidth;
        return `${visible ? 'VISIVEL' : 'FORA'} x=${Math.round(r.left)}`;
      }));
    }
    await page.screenshot({ path: `.agent/splash-${s.name}.png` });
    console.log(s.name.padEnd(28), samples.join(' | '));
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
