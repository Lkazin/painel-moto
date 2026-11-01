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
