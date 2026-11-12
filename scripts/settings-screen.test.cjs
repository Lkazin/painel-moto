const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ledger = fs.readFileSync('src/components/ScreenProfileLedger.tsx', 'utf8');
const settings = fs.readFileSync('src/components/ScreenSettings.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

test('o extrato mostra somente coisas do extrato', () => {
  assert.equal(ledger.includes('SectionPushNotifications'), false, 'notificações saíram do extrato');
  assert.equal(ledger.includes('ExperienceSettings'), false, 'preferências saíram do extrato');
  assert.equal(ledger.includes('AppUpdateSettings'), false, 'atualização saiu do extrato');
  assert.equal(ledger.includes('Sair da Minha Conta'), false, 'logout saiu do extrato');
  assert.equal(ledger.includes('Encerrar Plantão'), false, 'encerrar plantão saiu do extrato');
  assert.ok(ledger.includes('Meu Extrato'));
  assert.ok(ledger.includes('Extrato Acumulado Geral'));
  assert.ok(ledger.includes('Detalhamento por Loja'));
});

test('a página de configurações reúne o que saiu do extrato', () => {
  assert.ok(settings.includes('Configurações'));
  assert.ok(settings.includes('SectionPushNotifications'));
  assert.ok(settings.includes('ExperienceSettings'));
  assert.ok(settings.includes('AppUpdateSettings'));
  assert.ok(settings.includes('Sair da Minha Conta de Entregador'));
  assert.ok(settings.includes('Encerrar Plantão nesta Loja'));
  assert.ok(settings.includes('account.vehiclePlate'), 'placa foi para configurações');
});

test('o extrato abre as configurações e o app renderiza a tela', () => {
  assert.ok(ledger.includes('onOpenSettings'));
  assert.ok(app.includes('<ScreenSettings'));
  assert.ok(app.includes('setIsSettingsOpen(true)'));
});
