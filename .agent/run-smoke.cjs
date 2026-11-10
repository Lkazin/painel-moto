const { spawn } = require('node:child_process');
const server = spawn(process.execPath, ['.agent/serve-dist.cjs'], { stdio: ['ignore', 'pipe', 'inherit'] });
server.stdout.on('data', d => process.stdout.write(d));
setTimeout(() => {
  const test = spawn(process.execPath, ['.agent/smoke-test.cjs'], { stdio: 'inherit' });
  test.on('close', code => { server.kill(); process.exit(code || 0); });
}, 1200);
