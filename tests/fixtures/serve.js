// Optional manual browser harness: node tests/fixtures/serve.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.pdf': 'application/pdf'};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  try {
    let data = fs.readFileSync(file);
    if (url.pathname === '/options/options.html') data = data.toString().replace('<script src="options.js" defer>', '<script src="/tests/fixtures/options-bridge.js" defer></script><script src="../src/background.js" defer></script><script src="options.js" defer>');
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'}); res.end(data);
  } catch (_) { res.writeHead(404).end('Not found'); }
});
server.listen(4187, '127.0.0.1', () => console.log('Browser harness: http://127.0.0.1:4187/tests/fixtures/hostile-page.html'));
