const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const rawCode = fs.readFileSync('src/services/pushService.ts', 'utf8')
  .replace(/import\s+type\s+[^;]+;/g, '')
  .replace(/import\s+[^;]+from\s+['"][^'"]+['"];/g, '');
const source = stripTypeScriptTypes(rawCode);

function createHarness({ backendKey = null, backendFails = false, envKey = '' } = {}) {
  let fetchUrl = null;
  const context = {
    exports: {},
    console,
    Date,
    window: {
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
    getFetchUrl: () => fetchUrl,
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
