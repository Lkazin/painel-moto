const { execFileSync } = require('node:child_process');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
const REPO = 'Lkazin/painel-moto';
(async () => {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/android-v1.1.16`, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  console.log('status release existente:', r.status);
  const b = await r.json();
  if (r.ok) console.log('JÁ EXISTE:', b.html_url, '| assets:', (b.assets||[]).map(a=>a.name));
  else console.log('mensagem:', b.message);
  // listar releases recentes
  const r2 = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=3`, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  const rels = await r2.json();
  console.log('\nÚltimas releases:');
  for (const x of rels) console.log(' ', x.tag_name, '->', x.name, '|', x.published_at);
})().catch(e => console.error(e));
