const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const { stripTypeScriptTypes } = require('node:module');

function loadSnapshotHelper() {
  const storage = new Map();
  const localStorage = {
    get length() {
      return storage.size;
    },
    key(index) {
      return Array.from(storage.keys())[index] ?? null;
    },
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(String(key), String(value));
    },
    removeItem(key) {
      storage.delete(String(key));
    },
  };
  const source = stripTypeScriptTypes(
    fs.readFileSync('src/services/driverDataSnapshot.ts', 'utf8').replace(/import[\s\S]*?from '[^']+';/g, '')
  ).replaceAll('export function ', 'function ');
  const context = { exports: {}, localStorage, JSON, Date, Set, Array, Number, Boolean, String };
  vm.runInNewContext(
    source +
      ';Object.assign(exports,{readDriverSnapshot,readCachedAssignments,saveCachedAssignments,reconcileAssignmentsWithServer,readCachedHistory,saveCachedHistory,readCachedLedger,saveCachedLedger,clearDriverSnapshotOnLogout});',
    context
  );
  return { api: context.exports, storage };
}

test('snapshot preserva entregas, histórico e faturamento após reinício/atualização e não mistura contas', () => {
  const { api, storage } = loadSnapshotHelper();
  const sampleAsg = { assignmentId: 'a-1', orderId: 'o-1', orderNumber: '#2497', storeId: 'store_bella_pizza', status: 'picked_up' };
  const sampleHistory = { items: [{ id: 'h-1', orderNumber: '#3733', deliveryFee: 12 }], totalEarnings: 12, hasUninformedFees: false };
  const sampleLedger = [{ storeId: 'store_bella_pizza', storeName: 'Bella Pizza', totalToReceive: 12, completedCount: 1, canceledCount: 0 }];

  api.saveCachedAssignments('acc-1', 'store_bella_pizza', [sampleAsg]);
  api.saveCachedHistory('acc-1', 'store_bella_pizza', sampleHistory);
  api.saveCachedLedger('acc-1', sampleLedger);

  assert.equal(api.readCachedAssignments('acc-1', 'store_bella_pizza').length, 1);
  assert.equal(api.readCachedHistory('acc-1', 'store_bella_pizza').totalEarnings, 12);
  assert.equal(api.readCachedLedger('acc-1')[0].totalToReceive, 12);

  // Conta diferente nunca lê dados da acc-1
  assert.equal(api.readCachedAssignments('acc-2', 'store_bella_pizza').length, 0);
  assert.equal(api.readCachedHistory('acc-2', 'store_bella_pizza'), null);
  assert.equal(api.readCachedLedger('acc-2').length, 0);

  // Pendência offline não desaparece quando o servidor ainda não sincronizou aquele item
  const offlinePending = { ...sampleAsg, assignmentId: 'a-off', orderNumber: '#9999', isPendingSync: true };
  const reconciled = api.reconcileAssignmentsWithServer([offlinePending], [sampleAsg]);
  assert.equal(reconciled.length, 2);
  assert.ok(reconciled.some((x) => x.assignmentId === 'a-off'));

  // Apenas logout explícito remove o snapshot
  api.clearDriverSnapshotOnLogout('acc-1');
  assert.equal(storage.size, 0);
});

test('ScreenSettings não duplica OfferSoundSettings, DriverSecuritySettings, Tema ou links de download', () => {
  const settings = fs.readFileSync('src/components/ScreenSettings.tsx', 'utf8');
  assert.equal((settings.match(/<ExperienceSettings\s*\/>/g) || []).length, 1, 'ExperienceSettings único');
  assert.equal((settings.match(/OfferSoundSettings/g) || []).length, 0, 'som vem apenas dentro de ExperienceSettings');
  assert.equal((settings.match(/DriverSecuritySettings/g) || []).length, 0, 'biometria vem apenas dentro de ExperienceSettings');
  assert.equal((settings.match(/Tema do aplicativo/g) || []).length, 0, 'tema inline duplicado removido');
  assert.equal((settings.match(/downloads\//g) || []).length, 1, 'link de download único');
});

test('ScreenRoute exige clique em Iniciar rota para pedidos picked_up e salva ordem pendente antes', async () => {
  const { transformSync } = await import('rolldown/utils');
  const source = fs
    .readFileSync('src/components/ScreenRoute.tsx', 'utf8')
    .replace(/import[\s\S]*?from '[^']+';/g, '')
    .replaceAll('export const', 'const');
  const transformed = transformSync('ScreenRoute.tsx', source, { jsx: { runtime: 'classic' }, tsconfig: false });
  assert.equal(transformed.errors.length, 0);

  let slots = [];
  let index = 0;
  let dirty = false;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const key = index++;
      if (!(key in slots)) slots[key] = typeof initial === 'function' ? initial() : initial;
      return [slots[key], (v) => { slots[key] = typeof v === 'function' ? v(slots[key]) : v; dirty = true; }];
    },
    useRef(initial) {
      const key = index++;
      return slots[key] || (slots[key] = { current: initial });
    },
    useEffect() {},
  };
  const walk = (n, p, r = []) => {
    if (!n || typeof n !== 'object') return r;
    if (p(n)) r.push(n);
    for (const c of [n.props?.children].flat(Infinity)) walk(c, p, r);
    return r;
  };
  const textOf = (n) => (n == null || typeof n === 'boolean' ? '' : typeof n !== 'object' ? String(n) : [n.props?.children].flat(Infinity).map(textOf).join(' '));
  const icons = new Proxy({}, { get: () => () => null });
  const ctx = {
    React: react,
    ...react,
    exports: {},
    assignmentKey: (a) => a.assignmentId || a.id || '',
    activeRouteAssignments: (list) => list.filter((a) => ['picked_up', 'in_transit', 'em_rota'].includes(a.status)),
    reconcileRouteStops: (_, list) => list.filter((a) => ['picked_up', 'in_transit', 'em_rota'].includes(a.status)),
    mapOptimizedStops: (r) => r.stops,
    recentRouteOrigin: () => undefined,
    routeStaleReason: () => null,
    calculateDeliveryWait: () => ({ waitMinutes: 1, targetMinutes: 30, percent: 3, barPercent: 3, level: 'ok', label: '1 min parada', isAtGate: false }),
    RoutePreview: () => null,
    RouteSwipeCard: ({ children }) => ({ type: 'div', props: { children } }),
    TrackingBadge: () => null,
    api: {},
    audioAlert: { playClickSound() {} },
    trackingService: { getState: () => ({ isActive: false, lastLocation: null }), subscribe: () => () => {} },
    Date,
    console,
    window: { open() {} },
    setInterval: () => 0,
    clearInterval() {},
  };
  for (const name of ['Navigation', 'ArrowUp', 'ArrowDown', 'GripVertical', 'CheckCircle', 'MapPin', 'Clock', 'ArrowRight', 'ShieldAlert', 'AlertCircle', 'Sparkles', 'Compass', 'MessageCircle', 'Map']) {
    ctx[name] = icons[name];
  }
  vm.runInNewContext(transformed.code + ';exports.Component=ScreenRoute;', ctx);

  const startedCalls = [];
  const stops = [
    { assignmentId: 'a-1', orderId: 'o-1', orderNumber: '#2497', storeId: 'store_bella_pizza', storeName: 'Bella Pizza', customerName: 'João', address: 'Rua 1', addressNumber: '10', neighborhood: 'Centro', city: 'Canoas', itemsSummary: '1x Pizza', status: 'picked_up', sequence: 1, acceptedAt: '2026-11-15T00:00:00Z', deliveryFee: 5 },
    { assignmentId: 'a-2', orderId: 'o-2', orderNumber: '#2486', storeId: 'store_bella_pizza', storeName: 'Bella Pizza', customerName: 'Maria', address: 'Rua 2', addressNumber: '20', neighborhood: 'Centro', city: 'Canoas', itemsSummary: '1x Pizza', status: 'picked_up', sequence: 2, acceptedAt: '2026-11-15T00:00:00Z', deliveryFee: 5 },
  ];
  function render(currentStops) {
    let rounds = 0;
    let tree;
    do {
      dirty = false;
      index = 0;
      tree = ctx.exports.Component({
        assignments: currentStops,
        onReorder: async () => {},
        onStartRoute: async (s) => { startedCalls.push(s.map((x) => x.assignmentId)); },
        onSelectDelivery() {},
        onNavigateToOrders() {},
      });
      rounds++;
    } while (dirty && rounds < 10);
    return tree;
  }

  const treeBeforeStart = render(stops);
  const startButtons = walk(treeBeforeStart, (n) => n.type === 'button' && textOf(n).includes('Iniciar rota'));
  assert.equal(startButtons.length, 1);
  await startButtons[0].props.onClick();
  assert.deepEqual(startedCalls, [['a-1', 'a-2']]);

  slots = [];
  const treeAfterStart = render(stops.map((s) => ({ ...s, status: 'in_transit', routeStartedAt: '2026-11-15T01:00:00Z' })));
  assert.equal(walk(treeAfterStart, (n) => n.type === 'button' && textOf(n).includes('Iniciar rota')).length, 0);
  assert.match(textOf(treeAfterStart), /Rota iniciada · Mapa ao vivo liberado/);
});


test('App.tsx usa handleCloseStoreShift e handleLogoutAccount em todas as instâncias de ScreenSettings', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  const settingsMatches = app.match(/<ScreenSettings[\s\S]*?\/>/g) || [];
  assert.ok(settingsMatches.length >= 1);
  for (const block of settingsMatches) {
    assert.match(block, /onCloseShift=\{handleCloseStoreShift\}/);
    assert.match(block, /onLogoutAccount=\{handleLogoutAccount\}/);
  }
  assert.match(app, /handleTogglePresence[\s\S]*?try\s*\{[\s\S]*?await api\.setPresence\(newStatus\)[\s\S]*?\}\s*catch/);
});

test('OfflineQueueManager filtra comandos de plantão antigo e expõe reenvio/descarte de falhas', () => {
  const storage = new Map();
  const mgrCtx = {
    exports: {},
    console,
    Date,
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: (k) => storage.delete(k),
    },
    navigator: { onLine: true },
    window: { addEventListener() {} },
    require: () => ({ nativeSecureAccess: () => false, driverSecurity: {} }),
  };
  const { stripTypeScriptTypes } = require('node:module');
  const qSrc = stripTypeScriptTypes(
    fs.readFileSync('src/services/offlineQueue.ts', 'utf8').replace(/import[\s\S]*?from '[^']+';/g, '')
  )
    .replaceAll('export function ', 'function ')
    .replaceAll('export const ', 'const ')
    .replace(/^\s*export\s+/gm, '') + ';Object.assign(exports,{offlineQueue});';
  vm.runInNewContext(qSrc, mgrCtx);
  const q = mgrCtx.exports.offlineQueue;
  q.setContext('acc-1', 'tok-1', 'shift-old');
  const cmd = q.enqueue('delivery_confirm', { assignmentId: 'a-1' });
  q.markFailed(cmd.id, 'Erro teste', false);
  assert.equal(q.getFailedCount(), 1);
  q.retryFailed();
  assert.equal(q.getFailedCount(), 0);
  q.setContext('acc-1', 'tok-1', 'shift-new');
  assert.equal(q.getQueue().length, 0);
});

test('ScreenRoute não usa mais marca fixa no WhatsApp e abre links com noopener,noreferrer', () => {
  const route = fs.readFileSync('src/components/ScreenRoute.tsx', 'utf8');
  assert.doesNotMatch(route, /Bella Pizza/);
  assert.match(route, /noopener,noreferrer/);
});
