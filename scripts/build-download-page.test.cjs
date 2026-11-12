const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { readRelease, renderPage, buildDownloadPage, formatBytes } = require('./build-download-page.cjs');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-download-page-'));
  t.after(() => {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep + 'nw-download-page-')) throw new Error('Pasta temporária inválida.');
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function writeRelease(root, { version = '1.1.20', build = 23, apk = null, sha256 = null, name = null } = {}) {
  const source = path.join(root, 'release-downloads');
  fs.mkdirSync(source, { recursive: true });
  const bytes = apk || Buffer.concat([Buffer.from('504b0304', 'hex'), Buffer.alloc(2048, 7)]);
  const hash = sha256 || crypto.createHash('sha256').update(bytes).digest('hex');
  const file = name || `NovaesWeb-Entregador-v${version}-code${build}.apk`;
  fs.writeFileSync(path.join(source, file), bytes);
  fs.writeFileSync(path.join(source, 'release.json'), JSON.stringify({ version, build, file, sha256: hash, notes: 'Correções desta versão.' }, null, 2));
  return { source, file, hash };
}

test('gera a página de download com versão, build, tamanho e link do APK', (t) => {
  const root = tempRoot(t);
  const { source } = writeRelease(root);
  const { file, release } = buildDownloadPage({ root, source });
  assert.equal(release.build, 23);
  assert.equal(release.version, '1.1.20');
  const html = fs.readFileSync(file, 'utf8');
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('Baixar APK (2,0 kB)'), 'mostra o tamanho real');
  assert.ok(html.includes('Versão 1.1.20 · build 23'));
  assert.ok(html.includes('href="/downloads/NovaesWeb-Entregador-v1.1.20-code23.apk"'), 'link aponta para o APK');
  assert.ok(html.includes(release.sha256), 'SHA256 publicado para conferência');
  assert.ok(html.includes('Como instalar'), 'traz o passo a passo');
  assert.ok(html.includes('Conclua as entregas'), 'aviso de segurança');
  assert.equal(html.includes('<script src'), false, 'página sem dependência externa');
});

test('escapa conteúdo vindo do manifesto', (t) => {
  const root = tempRoot(t);
  const { source } = writeRelease(root);
  const release = readRelease(source);
  const html = renderPage({ ...release, notes: '<img src=x onerror=alert(1)>' });
  assert.equal(html.includes('<img src=x'), false);
  assert.ok(html.includes('&lt;img src=x'));
});

test('falha quando o manifesto falta, o APK não existe ou o SHA diverge', (t) => {
  const empty = tempRoot(t);
  fs.mkdirSync(path.join(empty, 'release-downloads'), { recursive: true });
  assert.throws(() => readRelease(path.join(empty, 'release-downloads')), /Manifesto de distribuição ausente/);

  const missing = tempRoot(t);
  const a = writeRelease(missing);
  fs.rmSync(path.join(a.source, a.file));
  assert.throws(() => readRelease(a.source), /não está disponível/);

  const diverged = tempRoot(t);
  const b = writeRelease(diverged, { sha256: 'a'.repeat(64) });
  assert.throws(() => readRelease(b.source), /SHA256 do APK não confere/);

  const wrongName = tempRoot(t);
  const c = writeRelease(wrongName, { name: 'outro.apk' });
  assert.throws(() => readRelease(c.source), /nome do APK|Nome do APK/i);
});

test('formata tamanho em kB e MB no padrão brasileiro', () => {
  assert.equal(formatBytes(14851955), '14,2 MB');
  assert.equal(formatBytes(2048), '2,0 kB');
  assert.throws(() => formatBytes(0), /Tamanho do APK inválido/);
});
