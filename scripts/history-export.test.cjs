const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = stripTypeScriptTypes(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'historyExport.ts'), 'utf8'),
  { mode: 'strip' },
)
  .replace(/^import[^;]+;$/gm, '')
  .replace(/^export\s+/gm, '');

const context = { exports: {} };
vm.runInNewContext(`${source}\nexports.buildHistoryCsv = buildHistoryCsv; exports.historyCsvFileName = historyCsvFileName;`, context);
const { buildHistoryCsv, historyCsvFileName } = context.exports;

const item = (overrides = {}) => ({
  id: 'a1', orderNumber: '1042', storeId: 's1', storeName: 'Pizzaria Novaes', address: 'Rua A, 100',
  neighborhood: 'Centro', deliveryFee: 8.5, status: 'delivered', completedAt: '2026-11-03T18:30:00.000Z',
  confirmedVia: 'pin_online', ...overrides,
});

test('gera CSV com cabeçalho, uma linha por entrega e total', () => {
  const csv = buildHistoryCsv([item(), item({ id: 'a2', orderNumber: '1043', deliveryFee: 6 })], new Date('2026-11-30T12:00:00Z'));
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'Pedido;Loja;Endereço;Bairro;Status;Confirmado por;Concluída em;Taxa (R$)');
  assert.equal(lines.length, 5, 'cabeçalho + 2 entregas + total + gerado');
  assert.ok(lines[1].startsWith('1042;Pizzaria Novaes;Rua A, 100;Centro;Entregue;PIN online;'));
  assert.ok(lines[1].endsWith(';8,50'), 'vírgula decimal para o Excel em português');
  assert.equal(lines[3], 'Total;2 entrega(s);;;;;;14,50');
  assert.ok(lines[4].startsWith('Gerado em;'));
});

test('protege valores com ponto e vírgula, aspas e quebra de linha', () => {
  const csv = buildHistoryCsv([item({ storeName: 'Loja; "Central"', address: 'Rua A\ncasa 2' })]);
  assert.ok(csv.includes('"Loja; ""Central"""'));
  assert.ok(csv.includes('Rua A casa 2'), 'quebra de linha vira espaço');
  assert.equal(csv.includes('Rua A\ncasa'), false);
});

test('taxa ausente fica vazia e não soma no total', () => {
  const csv = buildHistoryCsv([item({ deliveryFee: null })]);
  const lines = csv.trim().split('\r\n');
  assert.ok(lines[1].endsWith(';'), 'coluna de taxa vazia');
  assert.equal(lines[2], 'Total;1 entrega(s);;;;;;0,00');
});

test('lista vazia gera só cabeçalho e total zerado', () => {
  const lines = buildHistoryCsv([]).trim().split('\r\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[1], 'Total;0 entrega(s);;;;;;0,00');
});

test('nome do arquivo segue ano e mês', () => {
  assert.equal(historyCsvFileName(new Date('2026-03-15T10:00:00Z')), 'entregas-2026-03.csv');
  assert.equal(historyCsvFileName(new Date('2026-12-01T10:00:00Z')), 'entregas-2026-12.csv');
});
