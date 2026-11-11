const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

function loadWatcher(options = { withKey: true }) {
  const source = stripTypeScriptTypes(fs.readFileSync('src/services/realtimeWatcher.ts', 'utf8'), { mode: 'strip' })
    .replace(/^import .*$/gm, '')
    .replace(/import\.meta\.env\?\.VITE_SUPABASE_ANON_KEY\s*/g, 'globalThis.__VITE_SUPABASE_ANON_KEY')
    .replace(/export (class|function|const)/g, '$1')
    + '\nexports.RealtimeWatcher = RealtimeWatcher;\nexports.createSocketTransport = createSocketTransport;';

  const channels = [];
  const createClient = () => ({
    channel(name, opts) {
      const record = { name, opts, handlers: {}, status: null, unsubscribed: false };
      const channel = {
        on(type, filter, callback) { record.handlers[`${type}:${filter.event}`] = callback; return channel; },
        subscribe(callback) { if (callback) { record.status = 'SUBSCRIBED'; callback('SUBSCRIBED'); } return channel; },
        unsubscribe() { record.unsubscribed = true; return Promise.resolve('ok'); },
      };
      channels.push(record);
      return channel;
    },
  });

  const context = {
    exports: {},
    require: (name) => {
      if (name === './logisticsConfig') return { logisticsApiUrl: () => 'https://loja.test/api/v1/logistics' };
      return require(name);
    },
    process: { env: {} },
    console,
    URL,
    setInterval,
    clearInterval,
    setTimeout,
    fetch: async () => ({ ok: true, json: async () => ({ success: true, topic: 'logistics:abc' }) }),
    // Substitui import.meta.env?.VITE_SUPABASE_ANON_KEY no código transpilado.
    ...(options.withKey === false ? {} : { __VITE_SUPABASE_ANON_KEY: 'anon-key' }),
  };
  vm.runInNewContext(source, context);
  const mod = context.exports;
  const watcher = new mod.RealtimeWatcher(async () => ({ success: true, topic: 'logistics:abc' }), {
    slowPollMs: options.slowPollMs,
    createClient,
  });
  return { mod, watcher, channels };
}

function withEnv(env, fn) {
  const previous = globalThis.import_meta_env;
  globalThis.import_meta_env = env;
  try {
    return fn();
  } finally {
    globalThis.import_meta_env = previous;
  }
}

test('assina o tópico da loja e avisa apenas quando o broadcast chega', async () => {
  const { watcher, channels } = loadWatcher();
  let updates = 0;
  watcher.onUpdate(() => { updates += 1; });

  // import.meta.env é injetado pelo Vite; aqui simulamos a chave anônima.
  // a chave já vem no contexto do vm (globalThis de dentro do sandbox)
  await watcher.connect('shift-token');

  assert.equal(channels.length, 1, 'um único canal, sem polling por requisição');
  assert.equal(channels[0].name, 'logistics:abc');
  assert.equal(watcher.getStatus(), 'live');
  assert.equal(updates, 0, 'nada é buscado antes do aviso');

  channels[0].handlers['broadcast:updated']();
  assert.equal(updates, 1);

  channels[0].handlers['broadcast:updated']();
  assert.equal(updates, 2);
});

test('sem chave anônima fica offline e não quebra a consulta lenta', async () => {
  const { watcher, channels } = loadWatcher({ withKey: false });
  await watcher.connect('shift-token');
  assert.equal(channels.length, 0);
  assert.equal(watcher.getStatus(), 'offline');
});

test('desconectar encerra o canal e limpa o status', async () => {
  const { watcher, channels } = loadWatcher();
  // a chave já vem no contexto do vm (globalThis de dentro do sandbox)
  await watcher.connect('shift-token');
  await watcher.disconnect();
  assert.equal(channels[0].unsubscribed, true);
  assert.equal(watcher.getStatus(), 'idle');
});

test('token vazio não abre conexão', async () => {
  const { watcher, channels } = loadWatcher();
  await watcher.connect('');
  assert.equal(channels.length, 0);
  assert.equal(watcher.getStatus(), 'idle');
});

test('o App não usa mais polling de 2,5s nem de 3,5s', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8');
  assert.equal(app.includes('}, 2500)'), false, 'polling de ofertas removido');
  assert.equal(app.includes('}, 3500)'), false, 'polling de atribuições removido');
  assert.ok(app.includes('realtimeWatcher.onUpdate'), 'App assina o tempo real');
  assert.ok(app.includes('60_000'), 'consulta lenta de segurança presente');
});
