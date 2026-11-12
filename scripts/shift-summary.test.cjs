const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = stripTypeScriptTypes(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'shiftSummary.ts'), 'utf8'),
  { mode: 'strip' },
)
  .replace(/^import[^;]+;$/gm, '')
  .replace(/^export\s+/gm, '');

const context = { exports: {} };
vm.runInNewContext(`${source}\nexports.buildShiftSummary = buildShiftSummary;`, context);
const { buildShiftSummary } = context.exports;

const base = {
  driverName: 'Carlos Souza',
  vehicleModel: 'Honda CG 160',
  vehiclePlate: 'ABC1D23',
  storeName: 'Pizzaria Novaes',
  completed: 12,
  total: 96.5,
  at: new Date('2026-11-03T18:30:00Z'),
};

test('monta o fechamento com nome, veículo, loja, entregas e total', () => {
  const text = buildShiftSummary(base);
  assert.ok(text.includes('FECHAMENTO DE PLANTÃO - CARLOS SOUZA'));
  assert.ok(text.includes('Honda CG 160 (Placa ABC1D23)'));
  assert.ok(text.includes('Estabelecimento: Pizzaria Novaes'));
  assert.ok(text.includes('Entregas concluídas com PIN:* 12'));
  assert.ok(text.includes('R$ 96,50'), 'vírgula decimal');
  assert.ok(text.includes('_Enviado pelo App do Entregador_'));
});

test('usa padrões quando veículo e loja não vêm preenchidos', () => {
  const text = buildShiftSummary({ ...base, vehicleModel: null, storeName: '' });
  assert.ok(text.includes('Moto (Placa ABC1D23)'));
  assert.ok(text.includes('Estabelecimento: Pizzaria'));
});

test('data entra por parâmetro e sai formatada em pt-BR', () => {
  const text = buildShiftSummary({ ...base, at: new Date('2026-03-09T12:05:00Z') });
  assert.ok(/Data\/Hora: \d{2}\/\d{2}\/2026/.test(text));
  assert.equal(text.includes('Invalid Date'), false);
});

test('total zero sai como 0,00', () => {
  assert.ok(buildShiftSummary({ ...base, completed: 0, total: 0 }).includes('R$ 0,00'));
});
