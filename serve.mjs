import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res)=>{let p;try{p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}if(!p.startsWith(root+path.sep)&&p!==root){res.writeHead(403).end();return;}if(p===root)p=path.join(root,'index.html');fs.readFile(p,(e,b)=>{if(e){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(b);});}).listen(5173,'0.0.0.0',()=>console.log('Local: http://localhost:5173'));
