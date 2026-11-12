const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'release-downloads');
const metadata = JSON.parse(fs.readFileSync(path.join(source, 'release.json'), 'utf8'));
const expectedName = `NovaesWeb-Entregador-v${metadata.version}-code${metadata.build}.apk`;
if (!/^\d+\.\d+\.\d+$/.test(metadata.version) || !Number.isSafeInteger(metadata.build) || metadata.build < 1 || metadata.file !== expectedName || !/^[a-f0-9]{64}$/.test(metadata.sha256)) throw new Error('Metadados de distribuição inválidos.');
const target = path.join(root, 'dist', 'downloads');
fs.mkdirSync(target, { recursive: true });
let latestSize = 0;
for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
  if (!entry.isFile() || !/^NovaesWeb-Entregador-v\d+\.\d+\.\d+-code[1-9]\d*\.apk$/.test(entry.name)) continue;
  const apk = fs.readFileSync(path.join(source, entry.name));
  const sha256 = crypto.createHash('sha256').update(apk).digest('hex');
  if (apk.length < 4 || apk.length > 100 * 1024 * 1024 || apk.readUInt32LE(0) !== 0x04034b50) throw new Error('Arquivo de distribuição inválido.');
  if (entry.name === expectedName) {
    if (sha256 !== metadata.sha256) throw new Error('APK diferente do arquivo oficial verificado.');
    latestSize = apk.length;
  }
  fs.writeFileSync(path.join(target, entry.name), apk);
  fs.writeFileSync(path.join(target, entry.name + '.sha256'), `${sha256}  ${entry.name}\n`);
}
if (!latestSize) throw new Error('O APK anunciado no manifesto não está disponível.');
fs.writeFileSync(path.join(target, 'latest.json'), JSON.stringify({ version: metadata.version, build: metadata.build, file: expectedName, sha256: metadata.sha256, size: latestSize, notes: typeof metadata.notes === 'string' ? metadata.notes.slice(0, 1000) : '' }, null, 2));
console.log(`Download e manifesto preparados: ${expectedName} (${latestSize} bytes, SHA256 verificado).`);
const { buildDownloadPage } = require('./build-download-page.cjs');
const page = buildDownloadPage({ root, source });
console.log(`Página de download gerada: ${page.file} (versão ${page.release.version}, build ${page.release.build}).`);
