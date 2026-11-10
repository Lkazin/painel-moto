const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const csp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self' https://entregado001-oe6y.vercel.app https://api.github.com; worker-src 'self' blob:; manifest-src 'self'";
const root = path.resolve('dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost:4189');
  let p = decodeURIComponent(url.pathname); if (p === '/') p = '/index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp });
    res.end(data);
  });
}).listen(4189, () => console.log('dist + CSP em http://127.0.0.1:4189'));
