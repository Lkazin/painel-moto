const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function harness(request = async () => ({ success: true, updatedAt: '2026-11-02T01:00:00.000Z' })) {
  const calls = [], current = [], watches = [], events = {};
  const navigator = { onLine: true, geolocation: {
    getCurrentPosition(ok, fail) { current.push({ ok, fail }); },
    watchPosition(ok, fail) { watches.push({ ok, fail }); return watches.length; }, clearWatch() {},
  }};
  const document = { visibilityState: 'visible', addEventListener(name, fn) { events[name] = fn; } };
  const context = { exports: {}, console, Date, Number, Math, Set, Promise, AbortController, setTimeout, clearTimeout,
    navigator, document, window: { addEventListener(name, fn) { events[name] = fn; } },
    localStorage: { getItem(key) { return key.includes('session') ? JSON.stringify({ driverId: 'driver', membershipId: 'membership', token: 'shift' }) : null; } },
    NativeTrackingWatcher: class { start(){} async stop(){} }, supportsBackgroundTracking: () => false, nativeCurrentPosition(){},
    logisticsApiUrl: () => 'https://example.test/api',
    accountClient: { subscribe() {}, getToken: () => 'account', async request(url, options) { calls.push({ url, body: JSON.parse(options.body) }); return request(url, options); } },
  };
  const source = stripTypeScriptTypes(fs.readFileSync('src/services/trackingService.ts', 'utf8').replace(/import[^;]+;/g, ''))
    .replace('export const trackingService', 'const trackingService');
  vm.runInNewContext(source + ';exports.service = trackingService;', context);
  const service = context.exports.service;
  const location = (extra = {}) => ({ driverId: 'driver', assignmentId: 'order', latitude: -29.92, longitude: -51.18, accuracy: 10, timestamp: Date.now(), ...extra });
  const position = (extra = {}) => ({ coords: { latitude: -29.92, longitude: -51.18, accuracy: 10, heading: null, speed: 0 }, timestamp: Date.now(), ...extra });
  return { service, calls, current, watches, events, navigator, document, location, position };
}

test('captura de permissão sem rota não transmite localização', async () => {
  const h = harness();
  const pending = h.service.requestLocationPermission({ onlyCheckPermission: true });
  h.current[0].ok(h.position());
  assert.equal((await pending).granted, true);
  assert.equal(h.service.getState().isActive, false);
  assert.equal(h.calls.length, 0);
});

test('ignorado pelo servidor não é confirmação de compartilhamento', async () => {
  const h = harness(async () => ({ success: true, ignored: true }));
  h.service.start('driver', 'order');
  await h.service.handleNewLocation(h.location(), true);
  assert.equal(h.service.getState().lastPushedAt, null);
  assert.match(h.service.getState().error, /não compartilhada/);
  h.service.stop(false);
});

test('posições antigas, imprecisas e fora dos limites não são enviadas', async () => {
  const h = harness();
  h.service.start('driver', 'order');
  for (const invalid of [{ latitude: 91 }, { longitude: NaN }, { timestamp: Date.now() - 60000 }, { timestamp: Date.now() + 60000 }, { accuracy: 101 }]) {
    await h.service.handleNewLocation(h.location(invalid), true);
  }
  assert.equal(h.calls.length, 0);
  await h.service.handleNewLocation(h.location(), true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.service.getState().lastPushedAt, '2026-11-02T01:00:00.000Z');
  h.service.stop(false);
});

test('queda de conexão mantém erro e retorno solicita posição nova sem reenviar histórico', async () => {
  const h = harness();
  h.service.start('driver', 'order');
  h.navigator.onLine = false; h.events.offline();
  await h.service.handleNewLocation(h.location(), true);
  assert.equal(h.calls.length, 0);
  assert.match(h.service.getState().error, /Sem internet/);
  h.navigator.onLine = true; h.events.online();
  assert.equal(h.current.length, 2);
  h.current[1].ok(h.position());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.length, 1);
  assert.equal(h.service.getState().error, null);
  h.service.stop(false);
});

test('envios não sobrepõem e resposta antiga não atualiza sessão reiniciada', async () => {
  let resolveRequest;
  const h = harness(() => new Promise(resolve => { resolveRequest = resolve; }));
  h.service.start('driver', 'order');
  const first = h.service.handleNewLocation(h.location(), true);
  await h.service.handleNewLocation(h.location({ latitude: -29.93 }), true);
  assert.equal(h.calls.length, 1);
  h.service.stop(false); h.service.start('driver', 'other-order');
  resolveRequest({ success: true, updatedAt: '2026-11-02T01:00:00.000Z' });
  await first;
  assert.equal(h.service.getState().lastPushedAt, null);
  assert.equal(h.service.getState().assignmentId, 'other-order');
  h.service.stop(false);
});

test('encerrar invalida callbacks GPS e retorno da página só retoma rota ativa', async () => {
  const h = harness();
  h.service.start('driver', 'order');
  h.service.stop(false);
  h.current[0].ok(h.position()); h.watches[0].ok(h.position());
  h.events.visibilitychange();
  assert.equal(h.current.length, 1);
  assert.equal(h.calls.length, 0);
  assert.equal(h.service.getState().lastLocation, null);
});
