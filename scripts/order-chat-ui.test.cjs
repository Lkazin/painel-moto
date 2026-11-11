const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('o app do entregador tem chat do pedido ligado ao pedido ativo', () => {
  const screen = fs.readFileSync('src/components/ScreenActiveDelivery.tsx', 'utf8');
  assert.ok(screen.includes('Falar com a loja'), 'botão visível na entrega ativa');
  assert.ok(screen.includes('<OrderChatSheet'), 'sheet do chat renderizado');
  assert.ok(screen.includes('orderId={assignment.orderId}'), 'chat preso ao pedido');
});

test('o chat usa a API do entregador e o tempo real, sem polling agressivo', () => {
  const sheet = fs.readFileSync('src/components/OrderChatSheet.tsx', 'utf8');
  assert.ok(sheet.includes('api.getOrderChat'));
  assert.ok(sheet.includes('api.sendOrderChatMessage'));
  assert.ok(sheet.includes('realtimeWatcher.onUpdate'), 'atualiza quando a loja escreve');
  assert.ok(sheet.includes('30_000'), 'rede de segurança de 30s');
  assert.equal(sheet.includes('1500'), false);
});

test('o cliente da API expõe os dois métodos do chat', () => {
  const api = fs.readFileSync('src/services/api.ts', 'utf8');
  assert.ok(api.includes("getOrderChat(orderId: string"));
  assert.ok(api.includes("sendOrderChatMessage(orderId: string"));
  assert.ok(api.includes("'order-chat'"));
  assert.ok(api.includes("'order-chat-send'"));
});
