const { chromium } = require('C:/Users/camil/Downloads/teste app/novaesweb-test-center/node_modules/playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const jsErrors = [], cspViolations = [], failed = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/i.test(m.text())) cspViolations.push(m.text()); });
  page.on('requestfailed', r => failed.push(r.url()));

  await page.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.hostname === '127.0.0.1' || u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') route.continue();
    else route.abort();
  });

  await page.goto('http://127.0.0.1:4189/', { waitUntil: 'networkidle' });
  const rootText = await page.locator('#root').innerText();
  const mounted = /NovaesWeb|Entregador|próxima entrega/i.test(rootText);
  console.log('React montou com CSP ativo:', mounted);
  console.log('Erros JS:', jsErrors.length ? jsErrors : 'nenhum');
  console.log('Violações CSP:', cspViolations.length ? cspViolations : 'nenhuma');
  console.log('Requisições bloqueadas:', failed.length ? failed : 'nenhuma');
  await page.screenshot({ path: '.agent/smoke-csp.png' });
  const ok = mounted && jsErrors.length === 0 && cspViolations.length === 0 && failed.length === 0;
  console.log('\nRESULTADO CSP:', ok ? '✅ PASSou — CSP não quebra o app' : '❌ FALHOU');
  await browser.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
