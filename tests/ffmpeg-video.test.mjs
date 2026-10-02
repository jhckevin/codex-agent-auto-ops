import test from 'node:test';
import assert from 'node:assert/strict';
import {FFmpegVideo,captureArgs} from '../server/ffmpeg-video.mjs';
import {jpegSize,MultipartFrames} from '../server/frame-parser.mjs';
import {Preview} from '../server/preview.mjs';
import {serialCommand} from '../server/serial.mjs';
import {keyStroke} from '../server/keys.mjs';
import path from 'node:path';
const jpeg=Buffer.from([255,216,255,192,0,11,8,2,208,5,0,1,1,0x11,0,255,217]);
test('bounded multipart parser handles bytewise fragmentation and embedded marker bytes',()=>{
 const frames=[],p=new MultipartFrames(b=>frames.push(b));
 const wire=Buffer.concat([Buffer.from('--ffmpeg\r\nContent-type: image/jpeg\r\nContent-length: '+jpeg.length+'\r\n\r\n'),jpeg,Buffer.from('\r\n')]);
 for(const byte of wire)p.push(Buffer.from([byte]));
 assert.deepEqual(frames,[jpeg]);assert.deepEqual(jpegSize(frames[0]),{width:1280,height:720});
 assert.throws(()=>new MultipartFrames(()=>{}).push(Buffer.alloc(4*1024*1024+1)),{code:'VIDEO_OVERFLOW'});
});
test('Windows and macOS use explicit devices, bounded queues, wall-clock timestamps and no audio',()=>{
 const win=captureArgs({device:'UGREEN HDMI Capture'},'win32'),mac=captureArgs({device:'UGREEN HDMI Capture'},'darwin');
 assert(win.includes('dshow'));assert(win.includes('video=UGREEN HDMI Capture'));assert(mac.includes('avfoundation'));assert(mac.includes('UGREEN HDMI Capture:none'));
 for(const a of [win,mac]){assert(a.includes('-an'));assert(a.includes('-copyts'));assert(a.includes('-use_wallclock_as_timestamps'));assert(a.includes('select=not(mod(n\\,2)),showinfo=checksum=0'));}
 assert.throws(()=>captureArgs({device:'x',fps:20}),{code:'CONFIG'});
 assert.equal(serialCommand({port:'/dev/cu.usbserial-123'},'darwin','/plugin/scripts').command,'python3');
 assert.throws(()=>serialCommand({port:'/dev/tty.bad'},'darwin','/plugin'),{code:'CONFIG'});
 assert.deepEqual(keyStroke('a',['Command','Option']),{usage:4,mod:12});
 assert.equal(keyStroke('c',['Control']).mod,1);
});
test('timestamps retain millisecond precision and a new post-action frame is required',async()=>{
 const v=new FFmpegVideo({device:'fixture'},{platform:'win32'});v.meta=[];v.images=[];v.expected=0;v.generation='g';
 v.metadata('[showinfo] config in time_base: 1/10000000, frame_rate: 10/1');
 const stamp=BigInt(Date.now())*10000n;
 v.images.push(jpeg);v.metadata('[showinfo] n: 0 pts:'+stamp+' pts_time:1 s:1280x720');
 const first=await v.capture();assert(first.age_ms<200);assert.equal(first.capture_epoch,'g');
 const pending=v.capture({after:first.source_id});v.images.push(jpeg);
 v.metadata('[showinfo] n: 1 pts:'+(stamp+10000n)+' pts_time:1 s:1280x720');
 assert.notEqual((await pending).source_id,first.source_id);
 v.latest.at-=3000;assert.equal(v.status().connected,false);
 assert.throws(()=>v.metadata('[showinfo] n: 2 pts:0 pts_time:0 s:1280x720'),{code:'CAPTURE_CLOCK'});
});
test('viewer is read-only, disallows camera, checks origin and keeps bounded history',async()=>{
 const video={status:()=>({connected:true}),current:()=>({bytes:jpeg,source_id:'f1',age_ms:2})};
 const p=new Preview(video,{port:0,assets:path.resolve('plugins/agent-auto-ops/web')});await p.start();
 try{
 const url=p.url.slice(0,-1);
 const html=await fetch(p.url);assert.equal(html.status,200);assert.match(await html.text(),/Closing this page keeps the session running/);assert.equal(html.headers.get('Permissions-Policy'),'camera=(), microphone=()');
 assert.equal((await fetch(url+'/state',{headers:{Origin:'https://example.com'}})).status,403);
 assert.equal((await fetch(url+'/frame',{method:'POST'})).status,405);
 assert.equal((await fetch(url+'/frame?after=f1')).status,204);
 assert.equal((await fetch(url+'/frame')).status,200);
 for(let i=0;i<100;i++)p.publish({kind:'action',operation_id:String(i),status:'started'});
 p.publish({operation_id:'99',status:'unknown'});assert.equal(p.events.length,40);assert.equal(p.events.at(-1).status,'unknown');
 }finally{await p.close();}
});

test('audio cannot be selected through config or embedded device syntax',()=>{
 for(const platform of ['win32','darwin','linux']){
  assert.throws(()=>captureArgs({device:'camera',audio:true},platform),{code:'CONFIG'});
  const args=captureArgs({device:'camera',audio:false},platform);assert.equal(args[args.indexOf('-map')+1],'0:v:0');
  assert.throws(()=>captureArgs({device:'camera:audio=microphone'},platform),{code:'CONFIG'});
 }
 assert.throws(()=>captureArgs({device:'0:1'},'darwin'),{code:'CONFIG'});
});
