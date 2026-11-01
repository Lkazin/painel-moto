const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');
const BASE = 'https://entregado001-oe6y.vercel.app/api/v1/logistics';
function server() {
  let sequence = 0; const accounts = new Map(); const tokens = new Map(); const calls = []; let unavailable = false;
  function response(status, data) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
  return {
    calls, setUnavailable(value) { unavailable = value; }, async fetch(url, options = {}) {
      if (unavailable) throw new TypeError('Network unavailable');
      const body = options.body ? JSON.parse(options.body) : {}; const headers = new Headers(options.headers); calls.push({ url, body, headers });
      const action = new URL(url).pathname.split('/').at(-1);
      if (action === 'register') { if (body.registrationCode !== 'NW-8K72P') return response(403, { success: false, error: 'Código de cadastro inválido.' }); const account = { id: 'account-' + body.phone, name: body.name, phone: body.phone, vehiclePlate: body.vehiclePlate, vehicleModel: body.vehicleModel, createdAt: '2026-11-01' }; accounts.set(body.phone, { account, password: body.password, active: '', session: null }); }
      if (action === 'login' || action === 'register') {
        const entry = accounts.get(body.identifier || body.phone);
        if (!entry || entry.password !== body.password) return response(401, { success: false, error: 'Telefone ou senha incorretos.' });
        const token = 'account-session-' + (++sequence); entry.active = token; tokens.set(token, entry); return response(200, { success: true, account: entry.account, accountToken: token });
      }
      const token = headers.get('x-account-session'), entry = tokens.get(token);
      if (!entry || entry.active !== token) return response(401, { success: false, code: 'ACCOUNT_SESSION_REPLACED' });
      if (action === 'logout') { entry.active = ''; return response(200, { success: true }); }
      if (action === 'me') return response(200, { success: true, account: entry.account });
      if (action === 'account-bootstrap') return response(200, { success: true, account: entry.account, session: entry.session, ledger: [{ storeId: 'store-A', storeName: 'Loja', completedCount: 2, canceledCount: 0, totalToReceive: 16, lastShiftDate: '2026-11-01' }] });
      if (action === 'invite-activate') {
        if (body.inviteCode !== 'NW-123456') return response(404, { success: false, error: 'Código inválido' });
        entry.session = { token: 'drv_v1.signed-test-session', driverId: entry.account.id, driverName: entry.account.name, phone: entry.account.phone, storeId: 'store-A', storeName: 'Loja', membershipId: 'membership-A', role: 'entregador_plantao', expiresAt: '2099-01-01', isActivated: true, deviceFingerprint: 'test' };
        return response(200, { success: true });
      }
      if (action === 'delivery-confirm') return response(200, { success: true, message: 'Entrega confirmada' });
      return response(200, { success: true });
    }
  };
}
function browser(server, memory = new Map()) {
  let online = true; const modules = {}; const events = [];
  const storage = { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  function load(file) {
    if (modules[file]) return modules[file];
    let source = fs.readFileSync('src/services/' + file + '.ts', 'utf8').replace(/import \{[\s\S]*?\} from '..\/types';/g, '');
    source = stripTypeScriptTypes(source).replace(/import \{([^}]+)\} from '(.+)';/g, (_all, names, path) => 'const {' + names + '}=require(' + JSON.stringify(path) + ');').replaceAll('export class ', 'class ').replaceAll('export const ', 'const ');
    const exported = file === 'accountClient' ? 'accountClient,AccountRequestError,ACCOUNT_REPLACED_MESSAGE' : file === 'api' ? 'api,ApiClient' : 'offlineQueue';
    source += ';Object.assign(exports,{' + exported + '});';
    const context = { exports: {}, console, Date, URL, URLSearchParams, Headers, crypto: require('node:crypto').webcrypto, localStorage: storage, navigator: { get onLine() { return online; } }, window: { addEventListener() { }, dispatchEvent(event) { events.push(event); } }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } }, fetch: server.fetch.bind(server), require: name => name === './logisticsConfig' ? { logisticsApiUrl: () => BASE } : load(name.replace('./', '')) };
    vm.runInNewContext(source, context, { filename: file + '.ts' }); return modules[file] = context.exports;
  }
  return { api: load('api').api, account: load('accountClient').accountClient, queue: load('offlineQueue').offlineQueue, memory, events, setOnline(value) { online = value; } };
}
const register = b => b.api.registerDriver('Entregador Teste', '11999999999', 'TEST123', 'Moto', 'SenhaSegura123', 'NW-8K72P');
test('cadastro central, senha errada rejeitada e dados recuperados em outro aparelho', async () => {
  const backend = server(), phone = browser(backend); await register(phone); await phone.api.activateStoreShift('nw-123456');
  const computer = browser(backend); await assert.rejects(computer.api.loginDriver('11999999999', 'errada'), /incorretos/); assert.equal(computer.api.getDriverAccount(), null);
  await computer.api.loginDriver('11999999999', 'SenhaSegura123'); assert.equal(computer.api.getDriverAccount().id, phone.api.getDriverAccount().id); assert.equal(computer.api.getSession().membershipId, 'membership-A'); assert.equal(computer.api.getStoresLedger()[0].totalToReceive, 16);
  await assert.rejects(phone.api.synchronizeAccount(), /outro aparelho/); assert.equal(phone.api.getDriverAccount(), null); assert.equal(phone.api.getSession(), null); assert.equal(phone.queue.getQueue().length, 0);
});
test('recarregar valida a conta antes de restaurar plantão e falha de rede não faz logout', async () => {
  const backend = server(), first = browser(backend); await register(first); await first.api.activateStoreShift('NW-123456');
  const reloaded = browser(backend, first.memory); assert.equal(reloaded.api.getSession(), null); await reloaded.api.synchronizeAccount(); assert.equal(reloaded.api.getSession().storeId, 'store-A');
  backend.setUnavailable(true); await assert.rejects(reloaded.api.synchronizeAccount(), /Network/); assert.ok(reloaded.api.getDriverAccount());
});
test('fila offline usa sessão original e sessão substituída não sincroniza confirmação', async () => {
  const backend = server(), first = browser(backend); await register(first); await first.api.activateStoreShift('NW-123456'); first.setOnline(false);
  const result = await first.api.confirmDelivery('assignment-A', '1234'); assert.equal(result.isOfflinePending, true); assert.equal(first.queue.getQueue()[0].accountToken, first.account.getToken());
  const second = browser(backend); await second.api.loginDriver('11999999999', 'SenhaSegura123'); first.setOnline(true);
  await assert.rejects(first.api.flushOfflineQueue(), /outro aparelho/); assert.equal(first.queue.getQueue().length, 0); assert.equal(backend.calls.filter(call => call.url.endsWith('/delivery-confirm')).length, 0);
});
test('código inválido não cria sessão e logout não encerra plantão no servidor', async () => {
  const backend = server(), first = browser(backend); await register(first); await assert.rejects(first.api.activateStoreShift('NW-INVALID'), /inválido/); assert.equal(first.api.getSession(), null);
  await first.api.activateStoreShift('NW-123456'); await first.api.logoutDriver(); assert.equal(first.api.getDriverAccount(), null); assert.equal(backend.calls.some(call => call.url.endsWith('/shift-close')), false);
  await first.api.loginDriver('11999999999', 'SenhaSegura123'); assert.equal(first.api.getSession().storeId, 'store-A');
});

test('resposta atrasada de sessão antiga não desconecta o novo login', async () => {
  const backend = server(); const original = backend.fetch.bind(backend); let finish;
  backend.fetch = (url, options) => url.endsWith('/delayed') ? new Promise(resolve => { finish = resolve; }) : original(url, options);
  const first = browser(backend); await register(first);
  const pending = first.account.request(BASE + '/delayed'); await first.api.logoutDriver(); await first.api.loginDriver('11999999999', 'SenhaSegura123');
  finish({ ok: false, status: 401, json: async () => ({ success: false, code: 'ACCOUNT_SESSION_REPLACED' }) });
  await assert.rejects(pending, error => error.code === 'STALE_REQUEST'); assert.ok(first.api.getDriverAccount()); assert.ok(first.account.getToken());
});

test('cadastro exige código de autorização da loja e rejeita código inválido', async () => {
  const backend = server(), first = browser(backend);
  await assert.rejects(first.api.registerDriver('Teste', '11999999999', 'TEST123', 'Moto', 'SenhaSegura123', 'NW-INVALID'), /cadastro inválido/);
  assert.equal(first.api.getDriverAccount(), null);
  await register(first);
  const signup = backend.calls.filter(call => call.url.endsWith('/register')).at(-1);
  assert.equal(signup.body.registrationCode, 'NW-8K72P');
  assert.equal(signup.body.phone, '11999999999');
});
