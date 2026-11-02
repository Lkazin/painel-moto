// Service Worker para PWA do Painel do Motoboy — NovaesWeb Entregador
const CACHE_PREFIX = 'novaesweb-motoboy-';
const CACHE_NAME = `${CACHE_PREFIX}v7-brand`;
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon-16.png',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png',
  '/brand/novaesweb-entregador-ui.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      // O worker é registrado depois do primeiro carregamento do bundle. Aquecer
      // as entradas do HTML garante que o primeiro retorno offline tenha JS/CSS.
      const shell = await cache.match('/index.html');
      if (!shell) return;
      const html = await shell.text();
      const entries = new Set();
      for (const match of html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
        const asset = new URL(match[1], self.location.origin);
        if (asset.origin === self.location.origin && !asset.search && !asset.hash &&
          /^\/assets\/[A-Za-z0-9._-]+\.(?:js|css)$/.test(asset.pathname)) entries.add(asset.pathname);
      }
      if (entries.size) await cache.addAll([...entries].slice(0, 32));
    }).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Somente o shell público e arquivos estáticos entram no cache; APIs e sessões ficam fora.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const authenticated = event.request.headers?.has('authorization') || event.request.headers?.has('x-account-session');
  if (event.request.method !== 'GET' || authenticated || url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }
  const navigation = event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/index.html');
  const staticAsset = STATIC_ASSETS.includes(url.pathname) ||
    /^\/assets\/[^/]+\.(?:js|css|woff2?|png|webp|svg)$/.test(url.pathname) ||
    /^\/brand\/[^/]+\.(?:png|webp|svg)$/.test(url.pathname);
  if (!navigation && !staticAsset) {
    return;
  }
  // Não persistir query strings de ofertas/códigos no CacheStorage.
  const cacheKey = navigation ? '/index.html' : url.pathname;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const policy = response.headers.get('cache-control') || '';
        if (response.status === 200 && !/\b(?:private|no-store)\b/i.test(policy)) {
          const clone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, clone)).catch(() => {}));
        }
        return response;
      })
      .catch(() => {
        return caches.open(CACHE_NAME).then(cache => cache.match(cacheKey)).then(cached => cached || Response.error());
      })
  );
});

// Manipulador de Notificações Web Push em Segundo Plano (Tela Bloqueada e App Fechado)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Nova entrega disponível!', body: event.data.text() };
    }
  }

  const title = data.title || 'Nova entrega disponível!';
  const body = data.body || 'Você recebeu uma nova entrega. Toque para visualizar.';
  const icon = data.icon || '/icon-192.png';
  const badge = data.badge || '/icon-192.png';
  const tag = data.tag || 'novaesweb-offer';
  const targetUrl = data.url || (data.data?.offerId ? `/?offerId=${data.data.offerId}` : '/');

  const options = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 600],
    data: {
      url: targetUrl,
      offerId: data.data?.offerId || null,
      storeId: data.data?.storeId || null,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_offer', title: 'Ver Corrida' },
      { action: 'dismiss', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Notifica abas abertas caso o app esteja em primeiro plano
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({
            type: 'NOVAESWEB_PUSH_RECEIVED',
            payload: data,
          });
        }
      })
    ])
  );
});

// Manipulador de Cliques em Notificações na Tela de Bloqueio / Barra de Notificações
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se houver uma janela aberta do painel, foca nela e envia evento de abertura de oferta
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_OPEN_OFFER',
            offerId: notifData.offerId,
            storeId: notifData.storeId,
            url: targetUrl,
          });
          return;
        }
      }
      // Se o app estiver completamente fechado, abre uma nova janela navegando para a oferta
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
