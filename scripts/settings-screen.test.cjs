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

test('o extrato mostra a forma de pagamento só para leitura', () => {
  assert.ok(ledger.includes('Forma de pagamento'), 'linha de leitura');
  assert.equal(ledger.includes('PAYMENT_METHODS'), false, 'sem seletor no extrato');
  assert.equal(ledger.includes('setPaymentMethod'), false, 'extrato não altera a preferência');
  assert.ok(ledger.includes('Não definida'), 'estado vazio sem botão');
  assert.ok(ledger.includes('totalToReceive'), 'valor a receber no extrato');
  assert.ok(ledger.includes('Enviar Fechamento no WhatsApp da Loja'));
  assert.ok(ledger.includes('Tentar de novo'), 'erro permite tentar de novo');
  assert.ok(ledger.includes('Total:'), 'total no detalhamento por loja');
});

test('a forma de pagamento é escolhida só nas configurações', () => {
  assert.ok(settings.includes('PAYMENT_METHODS'), 'opções nas configurações');
  assert.ok(settings.includes('setPaymentMethod'), 'escolha guardada nas configurações');
  assert.ok(settings.includes('salvo neste aparelho'));
  const conta = settings.slice(settings.indexOf('<SectionTitle>Conta</SectionTitle>'), settings.indexOf('<SectionTitle>Plantão</SectionTitle>'));
  assert.ok(conta.includes('Forma de pagamento'), 'item dentro do grupo Conta');
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
  for (const group of ['Conta', 'Plantão', 'Notificações', 'Aplicativo', 'Aparência', 'Suporte']) {
    assert.ok(settings.includes(`<SectionTitle>${group}</SectionTitle>`), `grupo ${group}`);
  }
  assert.ok(settings.includes('confirmLogout'), 'sair pede confirmação');
  assert.ok(settings.includes('Sair da conta agora?'));
  assert.ok(settings.includes('Como o app trata seus dados'), 'termos de dados');
});

test('o extrato não tem nada de configuração', () => {
  assert.equal(ledger.includes('onOpenSettings'), false, 'extrato sem caminho para configurações');
  assert.equal(ledger.includes('Abrir configurações'), false, 'sem engrenagem no extrato');
  assert.equal(ledger.includes('Settings'), false, 'sem ícone de configuração no extrato');
});

test('a engrenagem da tela de início abre as configurações', () => {
  const headerButton = app.slice(app.indexOf('{/* Botão de Menu / Configurações */}'), app.indexOf('{/* Botão de Menu / Configurações */}') + 400);
  assert.ok(headerButton.includes('setIsSettingsOpen(true)'), 'engrenagem abre configurações');
  assert.equal(headerButton.includes('setIsStoreModalOpen(true)'), false, 'engrenagem não abre mais o modal da loja');
  assert.ok(app.includes('<ScreenSettings'));
});

test('cada item de configuração tem nome', () => {
  for (const item of ['Meu perfil', 'Plantão atual', 'Baixar o aplicativo', 'Preferências do app', 'Atualizações', 'Novidades', 'Sair da conta', 'Falar com a loja']) {
    assert.ok(settings.includes(`<ItemTitle>${item}</ItemTitle>`), `item ${item}`);
  }
  assert.equal((settings.match(/<SectionTitle>Conta<\/SectionTitle>/g) || []).length, 1, 'grupo Conta aparece uma vez só');
});
