import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  '.css':'text/css; charset=utf-8',
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.webmanifest':'application/manifest+json; charset=utf-8'
};

const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(root, requested);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    response.writeHead(403).end('Tiltott elérési út.');
    return;
  }
  fs.readFile(filePath, (error, body) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500, {'Content-Type':'text/plain; charset=utf-8'}).end('A fájl nem található.');
      return;
    }
    response.writeHead(200, {
      'Cache-Control':'no-store',
      'Content-Type':contentTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
    });
    response.end(body);
  });
});

server.listen(port, host, () => console.log(`Étkezési Napló: http://${host}:${port}`));
