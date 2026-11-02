// Service Worker para PWA do Painel do Motoboy — NovaesWeb Entregador
const CACHE_NAME = 'novaesweb-motoboy-v6';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  '/apple-touch-icon.png'
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

  // Não interceptar chamadas externas do Supabase nem APIs dinâmicas
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
  const badge = data.badge || '/favicon.svg';
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
