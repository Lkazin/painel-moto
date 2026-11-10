const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
const REPO = 'Lkazin/painel-moto';
const TAG = 'android-v1.1.16';
const TITLE = 'NovaesWeb Entregador 1.1.16';
const dir = path.resolve('.android-tools/releases/android-v1.1.16');
const apk = path.join(dir, 'NovaesWeb-Entregador-v1.1.16-code18.apk');
const sha = path.join(dir, 'NovaesWeb-Entregador-v1.1.16-code18.apk.sha256');
const notes = fs.readFileSync(path.join(dir, 'release-notes.md'), 'utf8');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

async function api(method, url, body, contentType) {
  const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(contentType ? { 'Content-Type': contentType } : {}) }, body });
  const text = await res.text(); let json = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) { console.error('ERRO', method, url, res.status); console.error(JSON.stringify(json, null, 2).slice(0, 2000)); process.exit(1); }
  return json;
}

(async () => {
  console.log('Usando target_commitish:', head);
  const release = await api('POST', `https://api.github.com/repos/${REPO}/releases`, JSON.stringify({
    tag_name: TAG, target_commitish: head, name: TITLE, body: notes, draft: false, prerelease: false,
  }));
  console.log('Release criada:', release.html_url);
  const uploadUrl = release.upload_url.split('{')[0];

  const apkUp = await api('POST', `${uploadUrl}?name=${encodeURIComponent(path.basename(apk))}`, fs.readFileSync(apk), 'application/vnd.android.package-archive');
  console.log('APK enviado:', apkUp.browser_download_url);

  const shaUp = await api('POST', `${uploadUrl}?name=${encodeURIComponent(path.basename(sha))}`, fs.readFileSync(sha), 'application/octet-stream');
  console.log('SHA256 enviado:', shaUp.browser_download_url);
  console.log('\nCONCLUÍDO');
})().catch(e => { console.error(e); process.exit(1); });
