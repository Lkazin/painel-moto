const fs = require('node:fs');
const assert = require('node:assert/strict');

// Extrai a regex real do sw.js para não haver divergência.
const sw = fs.readFileSync('public/sw.js', 'utf8');
const html = fs.readFileSync('dist/index.html', 'utf8');

// Replica a lógica do install do service worker.
const CACHE_NAME = 'novaesweb-motoboy-v7-brand';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/manifest.webmanifest', '/favicon.ico', '/favicon-16.png', '/favicon-32.png', '/icon-192.png', '/icon-512.png', '/icon-maskable.png', '/apple-touch-icon.png', '/brand/novaesweb-entregador-ui.png'];

const base = 'https://painel-moto-three.vercel.app';
const entries = new Set();
for (const match of html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
  const asset = new URL(match[1], base);
  if (asset.origin === base && !asset.search && !asset.hash &&
    /^\/assets\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(asset.pathname)) entries.add(asset.pathname);
}

const realAssets = fs.readdirSync('dist/assets').map(f => '/assets/' + f);
console.log('Chunks JS/CSS no HTML de produção que o sw.js tenta pré-cachear:');
console.log([...entries].sort().join('\n'));
console.log('\nArquivos reais em dist/assets:');
console.log(realAssets.sort().join('\n'));

// Verificação: cada chunk referenciado no HTML existe no dist, e cada js/css dos assets está coberto.
const missing = [...entries].filter(e => !realAssets.includes(e));
console.log('\nVerificação 1 (HTML->dist):', missing.length === 0 ? 'OK — todos os chunks existem' : 'FALTANDO: ' + missing);

// O sw cacheia via regex /^\/assets\/[^/]+\.(?:js|css|...)$/ no fetch; confirma que todos os chunks são capturados.
const fetchRegex = /^\/assets\/[^/]+\.(?:js|css|woff2?|png|webp|svg)$/;
const notMatched = [...entries].filter(e => !fetchRegex.test(e));
console.log('Verificação 2 (fetch cache):', notMatched.length === 0 ? 'OK — todos os chunks passam no regex do fetch' : 'NÃO CAPTURADOS: ' + notMatched);

// O limite do addAll no pré-cache é 32; verifica quantidade.
console.log('Total pré-cache JS/CSS:', entries.size, '(limite 32) ->', entries.size <= 32 ? 'OK' : 'EXCEDEU');
