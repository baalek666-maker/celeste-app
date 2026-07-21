// Celeste frontend + API proxy on :5174
// Static files from /home/ubuntu/celeste-app/dist + /api/* proxy to :3001
import http from 'http';
import fs from 'fs';
import path from 'path';

const DIST = '/home/ubuntu/celeste-app/dist';
const BACKEND = 'http://127.0.0.1:3001';
const MIME = {
  '.html':'text/html','.js':'application/javascript','.css':'text/css',
  '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.json':'application/json',
  '.woff2':'font/woff2','.ico':'image/x-icon','.webp':'image/webp',
};

async function proxyApi(req, res) {
  // Forward to backend (raw TCP passthrough)
  const url = req.url;
  const opts = {
    hostname: '127.0.0.1',
    port: 3001,
    path: url,
    method: req.method,
    headers: { ...req.headers, host: 'localhost:3001' },
  };
  const proxyReq = http.request(opts, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (err) => {
    console.error('[proxy err]', err.message);
    res.writeHead(502); res.end('Bad Gateway');
  });
  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  const filePath = path.normalize(path.join(DIST, urlPath));
  if (!filePath.startsWith(DIST)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(DIST, 'index.html'), (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not Found'); }
        res.writeHead(200, {'Content-Type':'text/html','Cache-Control':'no-store'});
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/') || req.url.startsWith('/auth/')) {
    return proxyApi(req, res);
  }
  serveStatic(req, res);
});

server.listen(5174, '0.0.0.0', () => {
  console.log('Celeste proxy on 5174 (IPv4 only)');
});
