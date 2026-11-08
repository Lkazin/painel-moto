const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripTypeScriptTypes } = require('node:module');
const fs = require('node:fs');
const vm = require('node:vm');

function loadOfflineQueue() {
  let source = fs.readFileSync('src/services/offlineQueue.ts', 'utf8')
    .replace(/import\s+\{[^}]*\}\s+from\s+['"]\.\.\/types['"];?/g, '');
  source = stripTypeScriptTypes(source)
    .replace(/import \{([^}]+)\} from '(.+)';/g, (_all, names, path) => 'const {' + names + '}=require(' + JSON.stringify(path) + ');')
    .replaceAll('export class ', 'class ')
    .replaceAll('export const ', 'const ')
    .replace(/^\s*export\s+\{\s*\};\s*$/gm, '')
    .replace(/^\s*export\s+/gm, '');
  source += ';Object.assign(exports,{offlineQueue,retryDelayMs});';
  const storage = new Map();
  const localStorage = { getItem: k => storage.get(k) || null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  const context = {
    exports: {}, console, Date, JSON, Math, Number, Error,
    localStorage, sessionStorage: localStorage,
    navigator: { onLine: true },
    window: { addEventListener() {}, removeEventListener() {} },
    require: name => name === './driverSecurity' ? { driverSecurity: { read: async () => null, save: async () => {} }, nativeSecureAccess: () => false } : (() => { throw new Error('unexpected require ' + name); })(),
  };
  vm.runInNewContext(source, context, { filename: 'offlineQueue.ts' });
  return { offlineQueue: context.exports.offlineQueue, retryDelayMs: context.exports.retryDelayMs, localStorage };
}

test('retryDelayMs cresce exponencialmente com teto de 60s', () => {
  const { retryDelayMs } = loadOfflineQueue();
  assert.equal(retryDelayMs(0), 1000);
  assert.equal(retryDelayMs(1), 2000);
  assert.equal(retryDelayMs(2), 4000);
  assert.equal(retryDelayMs(3), 8000);
  assert.equal(retryDelayMs(4), 16000);
  assert.equal(retryDelayMs(5), 32000);
  assert.equal(retryDelayMs(6), 60000);
  assert.equal(retryDelayMs(20), 60000);
});

test('markFailed aguarda o próximo horário antes de reenviar (backoff)', () => {
  const { offlineQueue, retryDelayMs } = loadOfflineQueue();
  offlineQueue.setContext('account-A', 'account-token', 'shift-token');
  const cmd = offlineQueue.enqueue('delivery_confirm', { driverId: 'd1', storeId: 's1' });
  assert.equal(cmd.retryCount, 0);

  offlineQueue.markFailed(cmd.id, 'Sem conexão', true);
  const queued = offlineQueue.getQueue()[0];
  assert.equal(queued.retryCount, 1);
  const expectedAt = Date.now() + retryDelayMs(1);
  assert.ok(typeof queued.retryAt === 'number' && queued.retryAt > Date.now());
  assert.ok(queued.retryAt >= expectedAt - 50 && queued.retryAt <= expectedAt + 50);

  // Dentro do atraso, o envio fica impedido.
  assert.equal(offlineQueue.isRetryGated(queued, Date.now()), true);
  // Após o atraso, libera.
  assert.equal(offlineQueue.isRetryGated(queued, queued.retryAt + 1), false);
});

test('falha definitiva remove o agendamento de reenvio', () => {
  const { offlineQueue } = loadOfflineQueue();
  offlineQueue.setContext('account-A', 'account-token', 'shift-token');
  const cmd = offlineQueue.enqueue('delivery_confirm', { driverId: 'd1', storeId: 's1' });
  offlineQueue.markFailed(cmd.id, 'Erro permanente', false);
  const queued = offlineQueue.getQueue()[0];
  assert.equal(queued.status, 'failed');
  assert.equal('retryAt' in queued, false);
});
