/* ===========================================================
   スマホ確認用の簡易サーバー
     node serve.js
   同じWi-Fiにつないだスマホから、表示されたURLを開けば見られる。
   （PCで見るだけなら index.html を直接ダブルクリックすればよい）
   =========================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = Number(process.argv[2] || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);

  // フォルダの外へ出るリクエストは拒否する
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end('403');
    return;
  }

  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('見つかりません: ' + rel);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      // 編集した内容がスマホ側にすぐ反映されるようキャッシュさせない
      'Cache-Control': 'no-store, must-revalidate',
    });
    res.end(buf);
  });
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`ポート ${PORT} は使用中です。別のポートで:  node serve.js ${PORT + 1}`);
  } else {
    console.error(e.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);

  console.log('');
  console.log('  KODAIRA祭 WEBパンフレット を配信中');
  console.log('');
  console.log(`  このPC     http://localhost:${PORT}/`);
  ips.forEach((ip) => console.log(`  スマホから http://${ip}:${PORT}/`));
  console.log('');
  console.log('  ※ スマホはPCと同じWi-Fiにつないでください');
  console.log('  ※ 止めるときは Ctrl + C');
  console.log('');
});
