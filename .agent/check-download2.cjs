const { execFileSync } = require('node:child_process');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
const H = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };

(async () => {
  const r = await fetch('https://api.github.com/repos/Lkazin/painel-moto/releases/tags/android-v1.1.16', { headers: H });
  const rel = await r.json();
  const apk = (rel.assets||[]).find(a => a.name.endsWith('.apk'));
  console.log('Asset id:', apk.id, '| state:', apk.state, '| size:', apk.size);

  // A) endpoint da API (asset id)
  for (let i = 1; i <= 2; i++) {
    try {
      const d = await fetch(`https://api.github.com/repos/Lkazin/painel-moto/releases/assets/${apk.id}`, {
        headers: { ...H, Accept: 'application/octet-stream' }, redirect: 'follow'
      });
      const buf = await d.arrayBuffer();
      console.log(`API tentativa ${i}: status ${d.status} | bytes ${buf.byteLength}`);
      if (buf.byteLength === apk.size) { console.log('  OK'); break; }
    } catch (e) { console.log(`API tentativa ${i} erro:`, e.message); }
  }

  // B) browser_download_url, 3 tentativas
  for (let i = 1; i <= 3; i++) {
    try {
      const d = await fetch(apk.browser_download_url, { redirect: 'follow', headers: { Accept: 'application/octet-stream' } });
      const buf = await d.arrayBuffer();
      console.log(`CDN tentativa ${i}: status ${d.status} | bytes ${buf.byteLength} | final: ${new URL(d.url).host}`);
      if (d.status === 200 && buf.byteLength === apk.size) { console.log('  OK'); break; }
      if (i < 3) await new Promise(r => setTimeout(r, 3000));
    } catch (e) { console.log(`CDN tentativa ${i} erro:`, e.message); }
  }
})().catch(e => console.error(e));
