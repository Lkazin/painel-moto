const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const origin = 'https://painel-moto-three.vercel.app';
const title = 'NovaesWeb Entregador | Gestão de Entregas';
const description = 'Aplicativo NovaesWeb Entregador para receber pedidos, organizar rotas, acompanhar entregas e trabalhar com lojas parceiras.';

test('static metadata identifies only the official app and never reflects a private URL or query', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const meta = (attribute, key) => new RegExp(`<meta ${attribute}="${key.replaceAll(':','\\:')}" content="([^"]+)"`).exec(html)?.[1];
  assert.equal(/<title>([^<]+)<\/title>/.exec(html)?.[1], title);
  assert.equal(meta('name','description'), description);
  assert.equal(meta('name','robots'), 'noindex, nofollow');
  assert.equal(/<link rel="canonical" href="([^"]+)"/.exec(html)?.[1], origin + '/');
  assert.equal(meta('property','og:url'), origin + '/');
  assert.equal(meta('property','og:title'), title);
  assert.equal(meta('property','og:description'), description);
  assert.equal(meta('property','og:image'), origin + '/brand/og-novaesweb-entregador.png');
  assert.equal(meta('name','twitter:card'), 'summary_large_image');
  assert.equal(meta('name','twitter:image'), meta('property','og:image'));
  assert.match(html, /rel="manifest" href="\/manifest.webmanifest"/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1\.0/);
});

test('manifest aliases retain installation identity, icon purposes and delivery shortcuts', () => {
  const manifest = JSON.parse(fs.readFileSync('public/manifest.webmanifest', 'utf8'));
  assert.deepEqual(manifest, JSON.parse(fs.readFileSync('public/manifest.json', 'utf8')));
  assert.equal(manifest.name, 'NovaesWeb Entregador');
  assert.equal(manifest.short_name, 'Entregador');
  assert.equal(manifest.description, description);
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#16061F');
  for (const size of [192,512]) assert.ok(manifest.icons.some(icon => icon.sizes === `${size}x${size}` && icon.type === 'image/png' && icon.purpose === 'any'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.purpose === 'maskable'));
  assert.deepEqual(manifest.shortcuts.map(shortcut => shortcut.url), ['/?tab=route','/?tab=orders']);
});

test('installation and sharing image files have their declared native dimensions', () => {
  const expected = {'favicon-16.png':[16,16],'favicon-32.png':[32,32],'icon-192.png':[192,192],'icon-512.png':[512,512],'icon-maskable.png':[512,512],'apple-touch-icon.png':[180,180],'brand/og-novaesweb-entregador.png':[1200,630]};
  for (const [name,dimensions] of Object.entries(expected)) {
    const bytes=fs.readFileSync(`public/${name}`);
    assert.equal(bytes.subarray(1,4).toString(),'PNG',`${name} is an actual PNG`);
    assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],dimensions,name);
  }
  const favicon=fs.readFileSync('public/favicon.ico');
  assert.equal(favicon.readUInt16LE(0),0);
  assert.equal(favicon.readUInt16LE(2),1,'browser favicon is an actual ICO');
  assert.ok(favicon.readUInt16LE(4)>0);
});

test('robots lets crawlers read noindex while deployment and HTML both prohibit indexation', () => {
  const robots = fs.readFileSync('public/robots.txt','utf8');
  assert.match(robots, /^Allow: \/$/m);
  assert.doesNotMatch(robots, /^Disallow: \/$/m);
  const deployment = JSON.parse(fs.readFileSync('vercel.json','utf8'));
  assert.ok(deployment.headers.some(rule => rule.source === '/(.*)' && rule.headers.some(h => h.key === 'X-Robots-Tag' && h.value.includes('noindex'))));
  for (const path of ['/manifest.webmanifest','/manifest.json']) assert.ok(deployment.headers.some(rule => rule.source === path && rule.headers.some(h => h.key === 'Content-Type' && h.value.startsWith('application/manifest+json'))));
});

function serviceWorker({shellHtml='public shell'}={}) {
  const handlers = new Map(), saved = new Map(), deleted = [], fetched = [];
  let network = async () => new Response('public shell');
  const cache = {async put(key,response) {saved.set(key,response);},async match(key) {return saved.get(key)?.clone();},async addAll(paths) {for (const path of paths) saved.set(path,new Response(path==='/'||path==='/index.html'?shellHtml:`static content: ${path}`));}};
  const context = {URL,Response,Promise,
    self: {location:{origin},addEventListener:(type,handler)=>handlers.set(type,handler),skipWaiting() {},clients:{claim() {}},registration:{async showNotification(title,options){context.notification={title,options};}}},
    clients:{async matchAll(){return [];}},
    caches:{async open(){return cache;},async keys(){return ['novaesweb-motoboy-v6','another-app-cache','novaesweb-motoboy-v7-brand'];},async delete(key){deleted.push(key);}},
    async fetch(request){fetched.push(request);return network(request);},
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js','utf8'),context);
  return {saved,deleted,fetched,context,
    setNetwork(fn){network=fn;},
    async emit(type,event={}) {const waits=[];let response;handlers.get(type)({...event,waitUntil:promise=>waits.push(promise),respondWith:promise=>{response=promise;}});const result=response?await response:undefined;await Promise.all(waits);return result;},
    request(path,extras={}) {return {url:new URL(path,origin).toString(),method:'GET',mode:'cors',headers:new Headers(),...extras};},
  };
}

test('worker bypasses API, foreign requests, authentication headers, POST and non-static private paths', async () => {
  const sw=serviceWorker();
  for (const request of [sw.request('/api/orders'),sw.request('https://foreign.test/icon.png'),sw.request('/icon-192.png',{method:'POST'}),sw.request('/profile'),sw.request('/icon-192.png',{headers:new Headers({'x-account-session':'private-token'})})]) {
    assert.equal(await sw.emit('fetch',{request}),undefined);
  }
  assert.equal(sw.fetched.length,0);
  assert.equal(sw.saved.size,0);
});

test('fresh installation warms actual entry JS/CSS before the first offline reload', async () => {
  const shellHtml='<html><head><link rel="stylesheet" crossorigin href="/assets/index-brand123.css"><link rel="modulepreload" href="/assets/preload-123.js"><link rel="preconnect" href="https://fonts.example.test"></head><body><script type="module" crossorigin src="/assets/index-brand123.js"></script></body></html>';
  const sw=serviceWorker({shellHtml});
  await sw.emit('install');
  for (const asset of ['/assets/index-brand123.js','/assets/index-brand123.css','/assets/preload-123.js']) assert.ok(sw.saved.has(asset),asset);
  assert.ok(sw.saved.has('/brand/novaesweb-entregador-ui.png'));
  assert.equal(sw.saved.has('/brand/novaesweb-entregador.png'),false);
  sw.setNetwork(async()=>{throw Error('offline');});
  const shell=await sw.emit('fetch',{request:sw.request('/',{mode:'navigate'})});
  assert.equal(await shell.text(),shellHtml);
  for (const asset of ['/assets/index-brand123.js','/assets/index-brand123.css']) {
    const cached=await sw.emit('fetch',{request:sw.request(asset)});
    assert.equal(await cached.text(),`static content: ${asset}`);
  }
});

test('installation HTML cannot add foreign, query-bearing, API or non-code files to entry cache', async () => {
  const shellHtml='<script src="https://foreign.test/assets/external.js"></script><script src="/assets/with-query.js?token=private"></script><script src="/assets/with-fragment.js#private"></script><script src="/api/private.js"></script><link href="/assets/export.json"><script data-src="/assets/data-attribute.js"></script><script src="/assets/safe-123.js"></script><script src="/assets/safe-123.js"></script>';
  const sw=serviceWorker({shellHtml});await sw.emit('install');
  assert.deepEqual([...sw.saved.keys()].filter(key=>key.startsWith('/assets/')),['/assets/safe-123.js']);
  assert.ok(![...sw.saved.keys()].some(key=>key.includes('private')||key.includes('foreign.test')));
});

test('worker caches only the public shell key, never an offer token in the navigation URL', async () => {
  const sw=serviceWorker();
  assert.equal((await sw.emit('fetch',{request:sw.request('/?offerId=private-token',{mode:'navigate'})})).status,200);
  assert.deepEqual([...sw.saved.keys()],['/index.html']);
  sw.setNetwork(async()=>{throw Error('offline');});
  const offline=await sw.emit('fetch',{request:sw.request('/?tab=route',{mode:'navigate'})});
  assert.equal(await offline.text(),'public shell');
});

test('worker refuses private/no-store responses and gives a real failure for an unavailable uncached asset', async () => {
  const sw=serviceWorker();
  for (const policy of ['private, max-age=0','no-store']) {
    sw.setNetwork(async()=>new Response('not cacheable',{headers:{'cache-control':policy}}));
    await sw.emit('fetch',{request:sw.request('/icon-192.png')});
  }
  assert.equal(sw.saved.size,0);
  sw.setNetwork(async()=>{throw Error('offline');});
  assert.equal((await sw.emit('fetch',{request:sw.request('/icon-192.png')})).type,'error');
});

test('worker retires only its own previous caches and retains notification handling', async () => {
  const sw=serviceWorker();await sw.emit('activate');
  assert.deepEqual(sw.deleted,['novaesweb-motoboy-v6']);
  await sw.emit('push',{data:{json:()=>({title:'Nova entrega',body:'Confira o aplicativo',data:{offerId:'offer-own'}})}});
  assert.equal(sw.context.notification.title,'Nova entrega');
  assert.equal(sw.context.notification.options.icon,'/icon-192.png');
  assert.equal(sw.context.notification.options.data.offerId,'offer-own');
});
