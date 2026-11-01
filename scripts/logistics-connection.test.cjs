const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const test = require('node:test');
function config(env = {}) {
  const source = fs.readFileSync('src/services/logisticsConfig.ts', 'utf8').replaceAll('import.meta.env', 'testEnv');
  const context = { exports: {}, URL, testEnv: env };
  vm.runInNewContext(stripTypeScriptTypes(source).replaceAll('export function', 'function') + ';exports.normalizeLogisticsUrl=normalizeLogisticsUrl;exports.logisticsApiUrl=logisticsApiUrl;', context);
  return context.exports;
}
test('produção usa a loja informada, desenvolvimento usa servidor local e configuração tem prioridade', () => {
  assert.equal(config().logisticsApiUrl(), 'https://entregado001-oe6y.vercel.app/api/v1/logistics');
  assert.equal(config({DEV: true}).logisticsApiUrl(), 'http://localhost:3000/api/v1/logistics');
  assert.equal(config({VITE_LOGISTICS_API_URL: 'https://example.com/admin/'}).logisticsApiUrl(), 'https://example.com/api/v1/logistics');
  assert.throws(() => config().normalizeLogisticsUrl('http://example.com'));
});
test('código é enviado à loja e sessão confirmada persiste; rejeição não cria sessão', async () => {
  const calls = []; const memory = new Map(); let reject = true;
  const storage = { getItem: k => memory.get(k) || null, setItem: (k,v) => memory.set(k,v), removeItem: k => memory.delete(k) };
  const source = fs.readFileSync('src/services/api.ts','utf8').replace(/import \{[\s\S]*?\} from '..\/types';/, '').replaceAll('import.meta', '({env:{}})');
  const context = {exports: {}, console, Date, localStorage: storage, window: {},
    fetch: async (url, options) => { calls.push({url, body: JSON.parse(options.body)}); return {ok: !reject, json: async () => reject ? {success:false,error:'Código inválido'} : {success:true,sessionToken:'test-session',membershipId:'test-membership',store:{id:'test-store',name:'Test'},driver:{id:'test-driver'}}}; },
    require: name => name === './logisticsConfig' ? config() : name === './offlineQueue' ? {offlineQueue:{getIsOnline:()=>true}} : {} };
  vm.runInNewContext(stripTypeScriptTypes(source).replace(/import \{ offlineQueue \} from '[^']+';/, "const {offlineQueue}=require('./offlineQueue');").replace(/import \{ logisticsApiUrl \} from '[^']+';/, "const {logisticsApiUrl}=require('./logisticsConfig');").replace('export const api', 'const api') + ';exports.api=api;',context);
  const api = context.exports.api;
  await api.registerDriver('Teste Local', '11999999999', 'TEST123', 'Moto', '1234');
  await assert.rejects(api.activateStoreShift('nw-123456'), /Código inválido/);
  assert.equal(api.getSession(), null);
  reject = false; await api.activateStoreShift(' nw-123456 ');
  assert.equal(calls[1].url, 'https://entregado001-oe6y.vercel.app/api/v1/logistics/invite-activate');
  assert.equal(calls[1].body.inviteCode, 'NW-123456');
  assert.equal(JSON.parse(memory.get('novaesweb_driver_session_v2')).token, 'test-session');
});
