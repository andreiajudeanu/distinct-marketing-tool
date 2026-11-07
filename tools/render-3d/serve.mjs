// Local tool: serves render.html and writes the rendered objects to extension/assets/3d.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(here, '..', '..', 'extension', 'assets', '3d');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

http.createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  const saving = pathname.match(/^\/save\/([a-z-]+\.webp)$/);
  if (saving && request.method === 'POST') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      fs.writeFileSync(path.join(output, saving[1]), Buffer.concat(chunks));
      response.writeHead(204);
      response.end();
    });
    return;
  }
  const file = path.normalize(path.join(here, pathname === '/' ? 'render.html' : pathname));
  if (!file.startsWith(here) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end();
    return;
  }
  response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(response);
}).listen(8791, '127.0.0.1', () => console.log('render tool on 8791'));
