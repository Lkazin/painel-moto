const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const rawCode = fs.readFileSync('src/services/pushService.ts', 'utf8')
  .replace(/import\s+type\s+[^;]+;/g, '')
  .replace(/import\s+[^;]+from\s+['"][^'"]+['"];/g, '');
const source = stripTypeScriptTypes(rawCode);

function createHarness({ backendKey = null, backendFails = false, envKey = '', native = false, receive = 'granted', registerFails = false } = {}) {
  let fetchUrl = null;
  const listeners = new Map(), removed = [], requests = [], events = [], storage = new Map();
  let unregistered = false;
  const accountClient = { getToken: () => 'session', getAccount: () => ({id:'account1'}), request: async (url, options) => { requests.push({url, body: JSON.parse(options.body)}); return {}; } };
  const PushNotifications = {
    checkPermissions: async () => ({receive}), requestPermissions: async () => ({receive}),
    createChannel: async () => {},
    addListener: async (name, handler) => { listeners.set(name, handler); return {remove: async () => {listeners.delete(name); removed.push(name);}}; },
    register: async () => { if(registerFails) throw new Error('register failed'); listeners.get('registration')({value:'fcm-device-token'}); },
    unregister: async () => { unregistered = true; },
  };
  const context = {
    exports: {},
    Capacitor: {isNativePlatform: () => native}, PushNotifications, accountClient,
    setTimeout, clearTimeout,
    CustomEvent: class { constructor(type, options) {this.type=type;this.detail=options?.detail;} },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) },
    console,
    Date,
    window: {
      dispatchEvent: event => events.push(event),
      atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    },
    Notification: { permission: 'default' },
    navigator: {
      serviceWorker: {},
    },
    importMeta: {
      env: { VITE_VAPID_PUBLIC_KEY: envKey },
    },
    logisticsApiUrl: () => 'http://localhost:3000/api/v1/logistics',
    require: (name) => {
      if (name === './accountClient') return { accountClient: { getToken: () => 'token', request: async () => ({}) } };
      if (name === './logisticsConfig') return { logisticsApiUrl: () => 'http://localhost:3000/api/v1/logistics' };
      return {};
    },
    fetch: async (url) => {
      fetchUrl = url;
      if (backendFails) throw new Error('Network error');
      if (backendKey !== null) {
        return {
          ok: true,
          json: async () => ({ success: true, publicKey: backendKey, enabled: true }),
        };
      }
      return {
        ok: true,
        json: async () => ({ success: true, publicKey: '', enabled: false }),
      };
    },
  };

  // Replace import.meta with importMeta and exports
  const code = source
    .replace(/import\.meta/g, 'importMeta')
    .replace(/export\s+const\s+([a-zA-Z0-9_]+)\s*=/g, 'const $1 = exports.$1 =')
    .replace(/export\s+class\s+/g, 'class ');
  vm.runInNewContext(code, context);

  return {
    pushService: context.exports.pushService,
    DEFAULT_VAPID_PUBLIC_KEY: context.exports.DEFAULT_VAPID_PUBLIC_KEY,
    getFetchUrl: () => fetchUrl, listeners, removed, requests, events, storage, isUnregistered: () => unregistered,
  };
}

test('1. DEFAULT_VAPID_PUBLIC_KEY é exportada e possui formato base64url VAPID válido (65 bytes / ~87 chars)', () => {
  const h = createHarness();
  assert.ok(h.DEFAULT_VAPID_PUBLIC_KEY, 'Chave padrão deve estar definida');
  assert.equal(typeof h.DEFAULT_VAPID_PUBLIC_KEY, 'string');
  assert.equal(h.DEFAULT_VAPID_PUBLIC_KEY.length, 87, 'Chave VAPID pública descompactada P-256 tem 65 bytes (87 caracteres base64url)');
});

test('2. getVapidPublicKey retorna chave fornecida dinamicamente pelo backend', async () => {
  const h = createHarness({ backendKey: 'dynamic-backend-key-123' });
  const key = await h.pushService.getVapidPublicKey();
  assert.equal(key, 'dynamic-backend-key-123');
  assert.ok(h.getFetchUrl().includes('vapid-public-key'));
});

test('3. getVapidPublicKey usa fallback do VITE_VAPID_PUBLIC_KEY quando backend retorna chave vazia', async () => {
  const h = createHarness({ backendKey: '', envKey: 'env-vapid-key-456' });
  const key = await h.pushService.getVapidPublicKey();
  assert.equal(key, 'env-vapid-key-456');
});

test('4. getVapidPublicKey usa DEFAULT_VAPID_PUBLIC_KEY quando backend e env estão vazios', async () => {
  const h = createHarness({ backendKey: '', envKey: '' });
  const key = await h.pushService.getVapidPublicKey();
  assert.equal(key, h.DEFAULT_VAPID_PUBLIC_KEY);
});

test('5. getVapidPublicKey usa DEFAULT_VAPID_PUBLIC_KEY quando backend falha na conexão e env está vazio', async () => {
  const h = createHarness({ backendFails: true, envKey: '' });
  const key = await h.pushService.getVapidPublicKey();
  assert.equal(key, h.DEFAULT_VAPID_PUBLIC_KEY);
});


test('native permission comes from OS, not saved enabled flag', async () => {
  const h=createHarness({native:true,receive:'denied'});
  h.storage.set('novaesweb_push_enabled','true');
  assert.equal(await h.pushService.refreshPermission(),'denied');
  assert.equal(h.pushService.getPermissionStatus(),'denied');
  assert.equal(await h.pushService.getExistingSubscription(),null);
});
test('native registration persists token and removes temporary listeners', async () => {
  const h=createHarness({native:true});
  assert.equal((await h.pushService.subscribe()).success,true);
  assert.equal(h.requests[0].body.fcmToken,'fcm-device-token');
  assert.equal(h.listeners.has('registration'),false);
  assert.equal(h.listeners.has('registrationError'),false);
  assert.equal((await h.pushService.getExistingSubscription()).endpoint,'fcm:fcm-device-token');
  h.listeners.get('pushNotificationActionPerformed')({notification:{data:{url:'https://untrusted.invalid'}}});
  assert.equal(h.events[0].type,'novaesweb:push-open');
  h.listeners.get('pushNotificationReceived')({title:'Pedido',body:'Nova entrega'});
  assert.equal(h.events[1].type,'novaesweb:push-received');
});
test('native unsubscribe revokes server endpoint and FCM without destroying permanent listeners', async () => {
  const h=createHarness({native:true}); await h.pushService.subscribe();
  await h.pushService.unsubscribe();
  assert.equal(h.requests[1].body.endpoint,'fcm:fcm-device-token');
  assert.equal(h.isUnregistered(),true);
  assert.equal(h.storage.has('novaesweb_fcm_token'),false);
  assert.equal(h.listeners.has('pushNotificationActionPerformed'),true);
  await h.pushService.subscribe();
  assert.equal((await h.pushService.getExistingSubscription()).endpoint,'fcm:fcm-device-token');
});
test('registration failure cleans listeners and does not mark notifications enabled', async () => {
  const h=createHarness({native:true,registerFails:true});
  assert.equal((await h.pushService.subscribe()).success,false);
  assert.equal(h.listeners.has('registration'),false);
  assert.equal(h.listeners.has('registrationError'),false);
  assert.equal(h.storage.has('novaesweb_push_enabled'),false);
});
