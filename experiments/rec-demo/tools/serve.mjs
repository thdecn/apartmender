import http from 'node:http';
import https from 'node:https';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../../../docs/', import.meta.url)));
const mount = '/apartmender';
const host = process.env.PIANO_HOST || '127.0.0.1';
const port = Number(process.env.PIANO_PORT || 4178);
const cert = process.env.PIANO_TLS_CERT;
const key = process.env.PIANO_TLS_KEY;
if (!!cert !== !!key) throw new Error('Set both PIANO_TLS_CERT and PIANO_TLS_KEY for HTTPS.');
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css',
  '.txt': 'text/plain', '.md': 'text/plain', '.bin': 'application/octet-stream', '.gz': 'application/gzip' };
async function handler(request, response) {
  // A static-only preview: no upload endpoint and no request bodies are read.
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const url = new URL(request.url, 'http://preview.invalid');
    if (!url.pathname.startsWith(mount + '/')) throw new Error('outside mount');
    const pathname = decodeURIComponent(url.pathname.slice(mount.length));
    let file = path.resolve(root, '.' + pathname);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('outside root');
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(302, { Location: url.pathname + '/' }); response.end(); return; }
      file = path.join(file, 'index.html');
    }
    file = await realpath(file);
    if (!file.startsWith(root + path.sep)) throw new Error('outside root');
    const bytes = await readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'microphone=(self)' });
    response.end(request.method === 'HEAD' ? undefined : bytes);
  } catch { response.writeHead(404); response.end('Not found'); }
}
const server = cert ? https.createServer({ cert: await readFile(cert), key: await readFile(key) }, handler) : http.createServer(handler);
server.listen(port, host, () => console.log(`Piano check: ${cert ? 'https' : 'http'}://${host}:${port}${mount}/rec-demo/ (local verification; public delivery uses Apartmender Pages)`));
