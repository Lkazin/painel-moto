const fs = require('node:fs');
const path = require('node:path');

const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://entregado001-oe6y.vercel.app https://api.github.com; worker-src 'self' blob:; manifest-src 'self'";

// Origens de rede reais (fetch/XHR) usadas no código.
const walk = dir => fs.readdirSync(dir).flatMap(f => { const p = path.join(dir, f); return fs.statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk('src').filter(f => /\.(ts|tsx)$/.test(f));
const networkHosts = new Set();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    const h = m[1].toLowerCase();
    if (h !== 'localhost' && h !== '127.0.0.1') networkHosts.add(h);
  }
}

// connect-src controla apenas fetch/XHR/EventSource/WebSocket. Links de navegação
// (window.open / <a href>) NÃO são controlados por connect-src.
const fetchOrApiHosts = ['entregado001-oe6y.vercel.app', 'api.github.com', 'github.com', 'raw.githubusercontent.com'];
console.log('Hosts usados em chamadas de rede (fetch/XHR/HTTP):');
for (const h of [...networkHosts].sort()) {
  const isNetwork = fetchOrApiHosts.some(x => h === x || h.endsWith('.' + x));
  console.log(`  ${h} ${isNetwork ? '(fetch/API)' : '(apenas link de navegação)'}`);
}

console.log('\nconnect-src no CSP:', (csp.match(/connect-src ([^;]+)/) || [,''])[1].trim());

// Verifica se toda origem usada em fetch está coberta.
const connectList = (csp.match(/connect-src ([^;]+)/) || [,''])[1].trim().split(/\s+/).map(x => x.replace(/^https?:\/\//,''));
const networkOnly = [...networkHosts].filter(h => fetchOrApiHosts.some(x => h === x || h.endsWith('.' + x)));
const uncovered = networkOnly.filter(h => !connectList.some(c => h === c || h.endsWith('.' + c) || c === "'self'" || c === 'wss:'));
console.log('\nResultado:', uncovered.length === 0 ? 'OK — todas as chamadas de rede reais estão permitidas' : 'NÃO COBERTO: ' + uncovered.join(', '));

// Imagens externas? (img-src)
const imgHosts = [...networkHosts].filter(h => !fetchOrApiHosts.some(x => h === x || h.endsWith('.' + x)));
console.log('Possíveis imagens externas (precisam de img-src):', imgHosts.length ? imgHosts.join(', ') : 'nenhuma (só self/data/blob)');
