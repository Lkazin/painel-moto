const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const compiled = (async () => {
  const { transformSync } = await import('rolldown/utils');
  const source = fs.readFileSync('src/components/GlassBottomNav.tsx', 'utf8')
    .replace(/import[\s\S]*?from '[^']+';/g, '').replace(/import '[^']+';/g, '')
    .replace('export type GlassNavTab', 'type GlassNavTab').replace('export function ', 'function ');
  const result = transformSync('GlassBottomNav.tsx', source, { jsx: { runtime: 'classic' }, tsconfig: false });
  assert.equal(result.errors.length, 0);
  return result.code + ';exports.GlassBottomNav=GlassBottomNav;';
})();
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const text = node => node == null || typeof node === 'boolean' ? '' : Array.isArray(node) ? node.map(text).join('') : typeof node === 'object' ? text(node.props?.children) : String(node);
async function render(props = {}) {
  const context = { exports: {}, Home() {}, Package() {}, Navigation() {}, History() {}, React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) } };
  vm.runInNewContext(await compiled, context);
  return context.exports.GlassBottomNav({ active: 'dashboard', waitingCount: 0, routeCount: 0, onNavigate() {}, ...props });
}

test('glass navigation preserves four labeled destinations and navigation callbacks', async () => {
  const calls = [];
  const tree = await render({ onNavigate: tab => calls.push(tab) });
  assert.equal(tree.type, 'nav');
  assert.equal(tree.props['aria-label'], 'Navegação principal');
  const buttons = nodes(tree).filter(node => node.type === 'button');
  assert.deepEqual(buttons.map(text), ['Início', 'Pedidos', 'Minha Rota', 'Histórico']);
  for (const button of buttons) button.props.onClick();
  assert.deepEqual(calls, ['dashboard', 'orders', 'route', 'history']);
});

test('active destination has one current page and still supports returning from delivery details', async () => {
  let last;
  for (const active of ['dashboard', 'orders', 'route', 'history']) {
    const tree = await render({ active, onNavigate: tab => { last = tab; } });
    const selected = nodes(tree).filter(node => node.type === 'button' && node.props['aria-current'] === 'page');
    assert.equal(selected.length, 1);
    selected[0].props.onClick();
    assert.equal(last, active);
  }
});

test('real badge counts remain accessible when compact display is capped and invalid counts are hidden', async () => {
  const tree = await render({ waitingCount: 137, routeCount: 1 });
  const buttons = nodes(tree).filter(node => node.type === 'button');
  assert.equal(buttons[1].props['aria-label'], 'Pedidos, 137 pedidos aguardando retirada');
  assert.match(text(buttons[1]), /99\+/);
  assert.equal(buttons[2].props['aria-label'], 'Minha Rota, 1 entrega na rota');
  const empty = await render({ waitingCount: -4, routeCount: NaN });
  const emptyButtons = nodes(empty).filter(node => node.type === 'button');
  assert.equal(text(emptyButtons[1]), 'Pedidos');
  assert.equal(text(emptyButtons[2]), 'Minha Rota');
});
