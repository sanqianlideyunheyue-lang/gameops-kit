const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = __dirname;
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const port = Number(process.env.PORT || 4173);
const url = `http://127.0.0.1:${port}/`;

function openBrowser() {
  if (!process.argv.includes('--open')) return;
  let command; let args;
  if (process.platform === 'win32') {
    command = 'cmd.exe'; args = ['/d', '/s', '/c', `start "" "${url}"`];
  } else if (process.platform === 'darwin') {
    command = 'open'; args = [url];
  } else {
    command = 'xdg-open'; args = [url];
  }
  const browser = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  browser.on('error', error => console.error(`无法自动打开浏览器：${error.message}\n请手动访问 ${url}`));
  browser.unref();
}

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const full = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  if (full !== root && !full.startsWith(root + path.sep)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

server.on('error', error => {
  if (error.code !== 'EADDRINUSE') { console.error(error.message); process.exitCode = 1; return; }
  http.get(url, response => {
    let html = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { if (html.length < 2048) html += chunk; });
    response.on('end', () => {
      if (response.statusCode === 200 && html.includes('<title>GameOps Kit')) {
        console.log(`GameOps Kit 已在运行：${url}`);
        openBrowser();
      } else {
        console.error(`端口 ${port} 已被其他程序占用。`);
        process.exitCode = 1;
      }
    });
  }).on('error', error => { console.error(`端口 ${port} 已被占用：${error.message}`); process.exitCode = 1; });
});
server.listen(port, '127.0.0.1', () => {
  console.log(`GameOps Kit: ${url}`);
  openBrowser();
});
