const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function harness(name, respondOffer, refreshAssignments = async () => {}) {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const start = app.indexOf(`  const ${name} = async`);
  const end = app.indexOf('\n  };', start) + '\n  };'.length;
  assert.ok(start > 0 && end > start);
  const handled = new Set(), messages = [];
  const context = { handledOfferIdsRef: { current: handled }, api: { respondOffer },
    audioAlert: { stopOfferAlert() {} }, removeNotice() {}, setCurrentOffer() {},
    setAssignments() {}, refreshAssignments, publishNotice() {}, setActiveTab() {},
    showToast: (...args) => messages.push(args) };
  vm.createContext(context);
  vm.runInContext(stripTypeScriptTypes(app.slice(start, end)) + `;this.run = ${name};`, context);
  return { run: context.run, handled, messages };
}

for (const name of ['handleAcceptOffer', 'handleRejectOffer']) {
  test(`${name}: falha temporária permite tentar novamente e sucesso impede duplicação`, async () => {
    let calls = 0;
    const h = harness(name, async () => { if (++calls === 1) throw new Error('Sem conexão'); return {}; });
    await h.run('offer-1');
    assert.equal(h.handled.has('offer-1'), false);
    assert.equal(h.messages[0][1], 'error');
    await h.run('offer-1');
    assert.equal(h.handled.has('offer-1'), true);
    await h.run('offer-1');
    assert.equal(calls, 2);
  });
}
test('aceite confirmado não é reenviado quando a atualização de pedidos falha', async () => {
  let calls = 0;
  const h = harness('handleAcceptOffer', async () => { calls++; return {}; }, async () => { throw new Error('Sem conexão'); });
  await h.run('offer-1'); await h.run('offer-1');
  assert.equal(h.handled.has('offer-1'), true);
  assert.equal(calls, 1);
});
