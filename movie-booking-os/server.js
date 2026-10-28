// Simple local web server (only Node's built-in modules, no frameworks)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\/+/, '');
  const full = path.join(__dirname, path.basename(file));
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log('Movie Ticket Booking running at http://localhost:' + PORT));
