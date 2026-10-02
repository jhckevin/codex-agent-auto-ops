import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {requireThat} from './contracts.mjs';
export class Preview {
 constructor(video,config={}){this.video=video;this.config=config;this.events=[];this.eventId=0;this.sockets=new Set();this.started=performance.now();}
 publish(event){if(event.operation_id){const previous=this.events.find(e=>e.operation_id===event.operation_id);if(previous){Object.assign(previous,event);return;}}this.events.push({id:++this.eventId,time:new Date().toISOString(),...event});while(this.events.length>40)this.events.shift();}
 async start(){
  const port=this.config.port??0;requireThat(Number.isInteger(port)&&port>=0&&port<=65535,'CONFIG','preview port invalid');
  this.prefix='/session/'+randomBytes(24).toString('hex');
  this.server=http.createServer((req,res)=>this.handle(req,res).catch(e=>{if(!res.headersSent)this.json(res,{error:e.message},400);else res.destroy();}));
  this.server.maxRequestsPerSocket=32;this.inflight=new WeakMap();this.server.requestTimeout=3000;this.server.headersTimeout=4000;this.server.keepAliveTimeout=1000;this.server.maxConnections=12;
  this.server.on('connection',s=>{this.sockets.add(s);s.on('close',()=>this.sockets.delete(s));});
  await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(port,'127.0.0.1',resolve);});
  this.origin='http://127.0.0.1:'+this.server.address().port;this.url=this.origin+this.prefix+'/';
  this.publish({kind:'session',label:'后台采集已启动'});return this.url;
 }
 json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 async handle(req,res){
  const count=(this.inflight.get(req.socket)??0)+1;this.inflight.set(req.socket,count);
  if(count>2){req.socket.destroy();return;}
  res.once('close',()=>this.inflight.set(req.socket,Math.max(0,(this.inflight.get(req.socket)??1)-1)));
  res.setTimeout(2000,()=>res.destroy());
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('Permissions-Policy','camera=(), microphone=()');
  if(req.headers.host!==this.origin.slice(7))return this.json(res,{error:'Invalid host'},403);
  if(req.headers.origin&&req.headers.origin!==this.origin||req.headers['sec-fetch-site']==='cross-site')return this.json(res,{error:'Cross-site access denied'},403);
  if(req.method!=='GET')return this.json(res,{error:'Viewer is read-only'},405);
  const url=new URL(req.url,this.origin);
  if(!url.pathname.startsWith(this.prefix+'/'))return this.json(res,{error:'Not found'},404);
  const route=url.pathname.slice(this.prefix.length);
  if(['/','/app.js','/style.css'].includes(route)){
   const name=route==='/'?'index.html':route.slice(1);
   let bytes=fs.readFileSync(path.join(this.config.assets??path.resolve(__dirname,'../web'),name));
   if(name==='index.html'&&['zh-CN','en'].includes(this.config.locale))bytes=Buffer.from(bytes.toString('utf8').replace(/<html lang="[^"]+"/, '<html lang="'+this.config.locale+'"'));
   res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});res.end(bytes);return;
  }
  if(route==='/state')return this.json(res,{target:this.target?.()??{},video:this.video.status(),events:this.events,memory_mib:Math.round(process.memoryUsage().rss/1048576),uptime_s:Math.round((performance.now()-this.started)/1000)});
  if(route==='/frame'){
   const frame=this.video.current();if(!frame||frame.age_ms>1000)return this.json(res,{error:'Video offline'},503);
   if(url.searchParams.get('after')===frame.source_id){res.writeHead(204);res.end();return;}
   res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':frame.bytes.length,'X-Source-Id':frame.source_id,'X-Frame-Age-Ms':String(Math.round(frame.age_ms))});res.end(frame.bytes);return;
  }
  return this.json(res,{error:'Not found'},404);
 }
 async close(){for(const s of this.sockets)s.destroy();if(this.server)await new Promise(r=>this.server.close(r));}
}
