const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
const REPO = 'Lkazin/painel-moto';
(async () => {
  // pega SHA completo do HEAD
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  console.log('HEAD local:', head);
  // verifica commit no remote
  const r = await fetch(`https://api.github.com/repos/${REPO}/commits/${head}`, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  console.log('commit no remote:', r.status, r.ok ? r.json ? (await r.json()).sha : '' : '');
  if (r.status === 200) { const j = await r.json(); console.log('  sha completo:', j.sha); }
  else { const j = await r.json(); console.log('  erro:', j.message); }
})().catch(e => console.error(e));
