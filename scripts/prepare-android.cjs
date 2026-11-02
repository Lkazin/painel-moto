const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { androidApiUrl } = require('./android-build-config.cjs');
const root = path.resolve(__dirname, '..');
const api = androidApiUrl(process.env.ANDROID_LOGISTICS_API_URL || undefined);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Execute npm run android:sync para preparar o aplicativo.');
const env = { ...process.env, VITE_LOGISTICS_API_URL: api };
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log(`Preparando Android com backend ${new URL(api).origin}`);
run([npmCli, 'run', 'build']);
const bundle = fs.readdirSync(path.join(root, 'dist/assets')).filter(name => name.endsWith('.js'))
  .map(name => fs.readFileSync(path.join(root, 'dist/assets', name), 'utf8')).join('\n');
if (!bundle.includes(new URL(api).hostname) || bundle.includes('http://localhost:3000')) {
  throw new Error('O build Android não contém o backend público esperado. Sincronização interrompida.');
}
run([path.join(root, 'node_modules/@capacitor/cli/bin/capacitor'), 'sync', 'android']);
