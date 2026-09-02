// Tiny static server for the card sorter UI + built data.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = 8799;
const TYPES = { html: 'text/html', json: 'application/json', js: 'text/javascript', css: 'text/css' };

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  let file;
  if (path === '/' || path === '/index.html') file = 'public/index.html';
  else if (path === '/data/cards.json') file = 'data/build/cards.json';
  else if (path === '/data/meta.json') file = 'data/build/meta.json';
  if (!file) { res.writeHead(404); return res.end('not found'); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[file.split('.').pop()] });
    res.end(body);
  } catch {
    res.writeHead(503, { 'content-type': 'text/plain' });
    res.end('Data not built yet - run: node refresh.mjs');
  }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.log(`Already running on http://localhost:${PORT}`); process.exit(0); }
  throw e;
});
server.listen(PORT, () => console.log(`Card sorter: http://localhost:${PORT}`));
