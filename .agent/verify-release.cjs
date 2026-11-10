const { execFileSync } = require('node:child_process');
const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (cred.match(/^password=(.*)$/m) || [,''])[1].trim();
const REPO = 'Lkazin/painel-moto';
(async () => {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/android-v1.1.16`, {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  const rel = await r.json();
  console.log('Tag:', rel.tag_name);
  console.log('Nome:', rel.name);
  console.log('Draft:', rel.draft, '| Prerelease:', rel.prerelease, '| Publicada em:', rel.published_at);
  console.log('Target:', rel.target_commitish);
  for (const a of rel.assets || []) {
    console.log(`\nAsset: ${a.name}`);
    console.log('  size:', a.size, '| state:', a.state);
    console.log('  digest (sha256):', a.digest);
    console.log('  downloads:', a.download_count);
    console.log('  url:', a.browser_download_url);
  }
})().catch(e => console.error(e));
