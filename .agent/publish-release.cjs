// Uso: node .agent/publish-release.cjs  (lê versão do build.gradle; token via git credential helper)
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [, ''])[1].trim();
const gradle = fs.readFileSync('android/app/build.gradle', 'utf8');
const version = gradle.match(/versionName\s+"([^"]+)"/)[1];
const code = gradle.match(/versionCode\s+(\d+)/)[1];
const REPO = 'Lkazin/painel-moto';
const TAG = `android-v${version}`;
const dir = path.resolve(`.android-tools/releases/${TAG}`);
const apk = path.join(dir, `NovaesWeb-Entregador-v${version}-code${code}.apk`);
const sha = apk + '.sha256';
const notes = fs.readFileSync(path.join(dir, 'release-notes.md'), 'utf8');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

async function api(method, url, body, contentType) {
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(contentType ? { 'Content-Type': contentType } : {}) }, body });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) { console.error('ERRO', method, url, res.status, text.slice(0, 1000)); process.exit(1); }
  return json;
}
(async () => {
  const release = await api('POST', `https://api.github.com/repos/${REPO}/releases`, JSON.stringify({ tag_name: TAG, target_commitish: head, name: `NovaesWeb Entregador ${version}`, body: notes, draft: false, prerelease: false }));
  console.log('Release criada:', release.html_url);
  const uploadUrl = release.upload_url.split('{')[0];
  const a = await api('POST', `${uploadUrl}?name=${encodeURIComponent(path.basename(apk))}`, fs.readFileSync(apk), 'application/vnd.android.package-archive');
  console.log('APK enviado:', a.browser_download_url);
  const s = await api('POST', `${uploadUrl}?name=${encodeURIComponent(path.basename(sha))}`, fs.readFileSync(sha), 'application/octet-stream');
  console.log('SHA256 enviado:', s.browser_download_url, '\nCONCLUIDO');
})().catch(e => { console.error(e); process.exit(1); });
