const { chromium } = require('C:/Users/camil/Downloads/teste app/novaesweb-test-center/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const jsErrors = [];
  const failedRequests = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('requestfailed', r => failedRequests.push(r.url() + ' :: ' + (r.failure()?.errorText || 'unknown')));

  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    // Permite o dist local e as fontes Google (mesmas permitidas pelo CSP).
    if (u.hostname === '127.0.0.1' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') route.continue();
    else route.abort();
  });

  await page.goto('http://127.0.0.1:4188/', { waitUntil: 'networkidle' });

  const scripts = await page.evaluate(() => Array.from(document.querySelectorAll('script[src],link[rel=modulepreload]')).map(e => e.src || e.href));
  const fontApplied = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    return true;
  });
  const rootText = await page.locator('#root').innerText();
  console.log('Scripts/preloads (devem ser 5):', scripts.length);
  console.log('React montou:', /NovaesWeb|Entregador|próxima entrega/i.test(rootText));
  console.log('Erros JS:', jsErrors.length ? jsErrors : 'nenhum');
  console.log('Requisições falhadas (esperado: nenhuma):', failedRequests.length ? failedRequests : 'nenhuma');

  const ok = jsErrors.length === 0 && failedRequests.length === 0 && scripts.length >= 5;
  console.log('\nRESULTADO FINAL:', ok ? '✅ PASSOU — sem interferência' : '❌ FALHOU');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
