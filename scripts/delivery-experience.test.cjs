const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function walk(node, predicate, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (predicate(node)) result.push(node);
  for (const child of [node.props?.children].flat(Infinity)) walk(child, predicate, result);
  return result;
}
function text(node) { return node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node) : [node.props?.children].flat(Infinity).map(text).join(' '); }
async function screen(extra = {}) {
  const { transformSync } = await import('rolldown/utils');
  let slots = [], index = 0, pending = [], tree;
  const calls = { pin: [], problem: [], external: [], wait: [] }, stored = new Map();
  const assignment = { assignmentId: 'A', orderId: 'order-A', orderNumber: '101', storeName: 'Loja Real', customerName: 'Cliente', customerPhone: '5511999999999', address: 'Rua Teste', addressNumber: '10', neighborhood: 'Centro', city: 'Canoas', itemsSummary: 'Um lanche', deliveryFee: 8, status: 'picked_up', ...extra };
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) { const key = index++; if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial; return [slots[key], value => { slots[key] = typeof value === 'function' ? value(slots[key]) : value; }]; },
    useEffect(effect, deps) { const key = index++, old = slots[key]; if (!old || deps.some((dep, i) => !Object.is(dep, old[i]))) { slots[key] = deps; pending.push(effect); } } };
  const source = fs.readFileSync('src/components/ScreenActiveDelivery.tsx', 'utf8').replace(/import[\s\S]*?from '[^']+';/g, '').replace(/import '[^']+';/g, '').replace('export const', 'const');
  const transformed = transformSync('ScreenActiveDelivery.tsx', source, { jsx: { runtime: 'classic' }, tsconfig: false });
  assert.equal(transformed.errors.length, 0);
  const context = { React: react, ...react, Date, console, setInterval: () => 0, clearInterval() {}, exports: {},
    useExperiencePreferences: () => ({ preferences: { focus: false } }), DeliveryBottomSheet: () => null,
    audioAlert: { playClickSound() {} }, api: { setGateWait: async (...args) => { calls.wait.push(args); } },
    localStorage: { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) },
    window: { open: (...args) => calls.external.push(args), location: { href: '' } } };
  for (const icon of ['MapPin', 'Phone', 'Navigation', 'KeyRound', 'AlertTriangle', 'ArrowLeft', 'Clock', 'Compass', 'MessageCircle', 'Focus', 'ChevronDown', 'FileText']) context[icon] = () => null;
  vm.runInNewContext(transformed.code + ';exports.Screen=ScreenActiveDelivery;', context);
  const props = { assignment, onBack() {}, onOpenPinConfirmation: item => calls.pin.push(item), onRequestWithdraw: item => calls.problem.push(item) };
  const render = () => { index = 0; pending = []; tree = context.exports.Screen(props); for (const effect of pending) effect(); return tree; };
  render();
  return { calls, stored, assignment, render, find: predicate => walk(tree, predicate), button: label => walk(tree, node => node.type === 'button' && text(node).includes(label))[0], text: () => text(tree) };
}

test('dock abre confirmação PIN sem concluir a entrega e foco mantém ações essenciais', async () => {
  const view = await screen();
  view.button('Confirmar com PIN').props.onClick();
  assert.equal(view.calls.pin.length, 1);
  assert.equal(view.calls.pin[0].assignmentId, 'A');
  view.button('Modo entrega').props.onClick(); view.render();
  assert.ok(view.find(node => node.props?.className === 'de-screen de-focus').length);
  assert.ok(view.button('Confirmar com PIN'));
  assert.ok(view.button('Iniciar espera'));
  assert.ok(view.button('Relatar problema'));
});
test('contato usa a loja real e preserva DDI sem enviar mensagem automaticamente', async () => {
  const view = await screen();
  assert.equal(view.calls.external.length, 0);
  view.find(node => node.props?.['aria-label'] === 'Abrir contato do cliente')[0].props.onClick(); view.render();
  view.button('Abrir WhatsApp').props.onClick();
  const url = new URL(view.calls.external[0][0]);
  assert.equal(url.pathname, '/5511999999999');
  assert.match(url.searchParams.get('text'), /Loja Real/);
  assert.doesNotMatch(url.searchParams.get('text'), /Bella Pizza/);
});
test('dados ausentes orientam o entregador e não abrem navegador sem endereço', async () => {
  const view = await screen({ address: '', addressNumber: '', customerPhone: '' });
  assert.match(view.text(), /Endereço não informado/);
  view.find(node => node.props?.['aria-label'] === 'Escolher navegador para esta entrega')[0].props.onClick(); view.render();
  assert.equal(view.button('Abrir no Waze').props.disabled, true);
  view.button('Abrir no Waze').props.onClick();
  assert.equal(view.calls.external.length, 0);
  view.find(node => node.props?.['aria-label'] === 'Abrir contato do cliente')[0].props.onClick(); view.render();
  assert.match(view.text(), /telefone do cliente não foi informado/);
  assert.equal(view.button('Abrir WhatsApp'), undefined);
});
test('espera no portão mantém integração, persistência local e extensão de três minutos', async () => {
  const view = await screen();
  view.button('Iniciar espera').props.onClick(); view.render();
  assert.equal(view.calls.wait.length, 1);
  assert.equal(view.calls.wait[0][0], 'A');
  assert.ok(view.stored.get('nw:gate-wait:A'));
  assert.match(view.text(), /05:00/);
  view.button('Dar +3 min').props.onClick(); view.render();
  assert.match(view.text(), /08:00/);
});
