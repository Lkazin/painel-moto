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
  assert.equal(ledger.includes('Placa:'), false, 'cartão com a placa saiu do extrato');
  assert.ok(ledger.includes('Meu Extrato'));
  assert.ok(ledger.includes('Você tem a receber'), 'valor em destaque');
  assert.ok(ledger.includes('Detalhamento por Loja'));
});

test('o extrato tem a forma de pagamento e quanto vai receber', () => {
  assert.ok(ledger.includes('Forma de pagamento'));
  assert.ok(ledger.includes('PAYMENT_METHODS'), 'opções de pagamento no extrato');
  assert.ok(ledger.includes('setPaymentMethod'), 'escolha fica guardada');
  assert.ok(ledger.includes('totalToReceive'), 'valor a receber no extrato');
  assert.ok(ledger.includes('Enviar Fechamento no WhatsApp da Loja'));
  assert.ok(ledger.includes('salvo neste aparelho'), 'confirma que a escolha fica guardada');
  assert.ok(ledger.includes('Tentar de novo'), 'erro permite tentar de novo');
  assert.ok(ledger.includes('Total:'), 'total no detalhamento por loja');
});

test('a página de configurações reúne tudo que não é extrato', () => {
  assert.ok(settings.includes('Configurações'));
  assert.ok(settings.includes('SectionPushNotifications'), 'ativar notificações');
  assert.ok(settings.includes('ExperienceSettings'), 'preferências do app');
  assert.ok(settings.includes('AppUpdateSettings'), 'atualização do app');
  assert.ok(settings.includes('Baixar o aplicativo'), 'baixar o app');
  assert.ok(settings.includes('downloads/'), 'aponta para a página de download');
  assert.ok(settings.includes('Sair da Minha Conta de Entregador'));
  assert.ok(settings.includes('Encerrar Plantão nesta Loja'));
  assert.ok(settings.includes('account.vehiclePlate'), 'placa foi para configurações');
});

test('configurações tem grupos, download, confirmação de saída e suporte', () => {
  for (const group of ['Conta', 'Plantão', 'Notificações', 'Aplicativo', 'Aparência', 'Atualizações', 'Suporte']) {
    assert.ok(settings.includes(`<SectionTitle>${group}</SectionTitle>`), `grupo ${group}`);
  }
  assert.ok(settings.includes('confirmLogout'), 'sair pede confirmação');
  assert.ok(settings.includes('Sair da conta agora?'));
  assert.ok(settings.includes('Como o app trata seus dados'), 'termos de dados');
});

test('o extrato abre as configurações e o app renderiza a tela', () => {
  assert.ok(ledger.includes('onOpenSettings'));
  assert.ok(ledger.includes('Abrir configurações'), 'engrenagem no cabeçalho');
  assert.equal(ledger.includes('Abrir Configurações</span>'), false, 'botão duplicado no rodapé saiu');
  assert.ok(app.includes('<ScreenSettings'));
  assert.ok(app.includes('setIsSettingsOpen(true)'));
});
