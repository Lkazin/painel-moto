const { execFileSync } = require('node:child_process');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
(async () => {
  // 1. Estado da release/asset
  const r = await fetch('https://api.github.com/repos/Lkazin/painel-moto/releases/tags/android-v1.1.16', {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  const rel = await r.json();
  console.log('Release estado:', rel.tag_name, '| assets:', (rel.assets||[]).map(a => `${a.name} [${a.state}, ${a.size}B]`).join(' | '));

  // 2. Tenta baixar o APK via browser_download_url (segue redirect) e mede.
  const apkUrl = 'https://github.com/Lkazin/painel-moto/releases/download/android-v1.1.16/NovaesWeb-Entregador-v1.1.16-code18.apk';
  const t0 = Date.now();
  try {
    const d = await fetch(apkUrl, { headers: { Accept: 'application/octet-stream' }, redirect: 'follow' });
    const buf = await d.arrayBuffer();
    console.log('\nDownload APK:', d.status, '| bytes:', buf.byteLength, '| em', Date.now()-t0, 'ms', '| final URL:', d.url);
    console.log('Tamanho esperado:', 14847159, '|', buf.byteLength === 14847159 ? 'OK' : 'DIVERGENTE');
  } catch (e) {
    console.log('\nDownload APK FALHOU:', e.message);
  }
})().catch(e => console.error(e));
