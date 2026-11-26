import http from 'node:http';
import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {localDB} from './local-db.mjs';
execFileSync(process.execPath,['scripts/build.mjs']);
const app=(await import('../dist/server/index.js')).default;
mkdirSync('.local',{recursive:true});
const env={DB:localDB('.local/preview.sqlite'),KEY_ENCRYPTION_SECRET:process.env.KEY_ENCRYPTION_SECRET||Buffer.alloc(32,47).toString('base64'),GEMINI_API_KEY:process.env.GEMINI_API_KEY,GEMINI_MODEL:process.env.GEMINI_MODEL};
const arg=process.argv.indexOf('--port'),port=Number(process.env.PORT||(arg>=0?process.argv[arg+1]:5173));
http.createServer(async(req,res)=>{
 try{if(req.url==='/qa/mobile'){res.writeHead(200,{'content-type':'text/html'});res.end('<html><title>Folio mobile QA</title><body style="margin:0"><iframe title="390 pixel mobile viewport" src="/" style="width:390px;height:820px;border:0"></iframe></body></html>');return;}const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
 headers.set('oai-authenticated-user-id','local-preview-user');
 const origin=headers.get('origin')||'http://'+req.headers.host;
 const request=new Request(new URL(req.url,origin),{method:req.method,headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
 const answer=await app.fetch(request,env);res.writeHead(answer.status,Object.fromEntries(answer.headers));res.end(Buffer.from(await answer.arrayBuffer()));}
 catch{res.writeHead(500);res.end('Preview unavailable.');}
}).listen(port,'0.0.0.0',()=>console.log('Preview listening on '+port));
