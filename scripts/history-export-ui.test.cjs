const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const screen = fs.readFileSync('src/components/ScreenHistory.tsx', 'utf8');

test('o histórico oferece baixar a planilha', () => {
  assert.ok(screen.includes('Baixar planilha (CSV)'));
  assert.ok(screen.includes('buildHistoryCsv'));
  assert.ok(screen.includes('historyCsvFileName'));
  assert.ok(screen.includes("type: 'text/csv;charset=utf-8'"));
  assert.ok(screen.includes('\\uFEFF'), 'BOM para o Excel abrir acentuação');
  assert.ok(screen.includes('URL.revokeObjectURL'), 'libera o blob depois do download');
});

test('o botão fica desativado sem entregas', () => {
  assert.ok(screen.includes('disabled={loading || historyItems.length === 0}'));
});
