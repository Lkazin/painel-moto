// Service Worker para PWA do Painel do Motoboy
const CACHE_NAME = 'novaesweb-motoboy-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia Network First para navegação e Stale-While-Revalidate para assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não interceptar chamadas externas do Supabase nem APIs
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          return cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : null);
        });
      })
  );
});

// Manipulador de Cliques em Notificações na Tela de Bloqueio
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Receptor de Mensagens para Exibição de Notificação com Celular Bloqueado
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_OFFER_NOTIFICATION') {
    const { title, body, tag, data } = event.data;
    self.registration.showNotification(title || '🍕 Nova Corrida Disponível!', {
      body: body || 'Toque para abrir o painel e aceitar o pedido.',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [500, 200, 500, 200, 800],
      tag: tag || 'nova-oferta',
      renotify: true,
      requireInteraction: true,
      data: data || { url: '/' }
    });
  }
});
