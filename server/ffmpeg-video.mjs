import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {requireThat} from './contracts.mjs';
import {jpegSize,MultipartFrames} from './frame-parser.mjs';
export function captureArgs(c,platform=process.platform){
 requireThat(typeof c.device==='string'&&c.device.length>0&&c.device.length<512,'CONFIG','Explicit video device required');
 requireThat(c.audio===undefined||c.audio===false,'CONFIG','This plugin supports video only; audio input is forbidden');
 requireThat(!/[\r\n]/.test(c.device)&&!/:audio\s*=/i.test(c.device),'CONFIG','Audio device selection is forbidden');
 if(platform==='darwin')requireThat(!c.device.includes(':'),'CONFIG','Select a video device only; AVFoundation audio is always none');
 const width=c.width??1280,height=c.height??720,inputFPS=c.input_fps??10,fps=c.fps??5;
 requireThat(Number.isInteger(width)&&width>=160&&width<=1920&&Number.isInteger(height)&&height>=120&&height<=1080,'CONFIG','Capture size must be within 1920x1080');
 requireThat(Number.isInteger(inputFPS)&&inputFPS>=1&&inputFPS<=60&&Number.isInteger(fps)&&fps>=1&&fps<=inputFPS&&fps<=15,'CONFIG','Invalid frame rate');
 const driver=c.input_format??({win32:'dshow',darwin:'avfoundation',linux:'v4l2'}[platform]);
 requireThat(['dshow','avfoundation','v4l2'].includes(driver),'CONFIG','Unsupported capture driver');
 const input=['-f',driver,'-video_size',width+'x'+height,'-framerate',String(inputFPS)];
 if(driver==='dshow')input.push(...(c.pixel_format?['-pixel_format',c.pixel_format]:['-vcodec','mjpeg']),'-rtbufsize','4M','-i','video='+c.device);
 if(driver==='avfoundation')input.push('-pixel_format',c.pixel_format??'uyvy422','-i',c.device+':none');
 if(driver==='v4l2')input.push('-input_format',c.pixel_format??'mjpeg','-i',c.device);
 const every=Math.ceil(inputFPS/fps);
 return ['-hide_banner','-nostdin','-nostats','-loglevel','info','-copyts','-thread_queue_size','2','-use_wallclock_as_timestamps','1',...input,
 '-map','0:v:0','-an','-sn','-dn','-filter_threads','1','-vf','select=not(mod(n\\,'+every+')),showinfo=checksum=0',
 '-c:v','mjpeg','-threads','1','-q:v','5','-fps_mode','passthrough','-f','mpjpeg','-flush_packets','1','pipe:1'];
}
export class FFmpegVideo {
 constructor(config={},deps={}){
  this.config=config;this.name='ffmpeg-uvc';this.spawn=deps.spawn??spawn;this.platform=deps.platform??process.platform;
  this.latest=null;this.sequence=0;this.waiters=new Set();this.closed=false;this.restarts=0;
  this.args=captureArgs(config,this.platform);this.error=null;
 }
 async connect(){this.start();}
 start(){
  if(this.closed)return;
  this.generation=randomUUID();this.latest=null;this.meta=[];this.images=[];this.timebase=null;this.line='';this.tail='';this.expected=0;this.failure=false;
  const child=this.child=this.spawn(this.config.command??'ffmpeg',this.args,{windowsHide:true,stdio:['ignore','pipe','pipe']});
  const parser=new MultipartFrames(bytes=>{this.images.push(bytes);this.pair();});
  child.stdout.on('data',d=>{try{if(!this.failure)parser.push(d);}catch(e){this.fail(e.message);}});
  child.stderr.on('data',d=>{
   if(this.failure)return;
   this.line+=d.toString();if(this.line.length>65536){this.fail('FFmpeg diagnostics overflow');return;}
   let at;while((at=this.line.indexOf('\n'))>=0){
    const line=this.line.slice(0,at);this.line=this.line.slice(at+1);this.tail=(this.tail+line+'\n').slice(-2048);
    try{this.metadata(line);}catch(e){this.fail(e.message);break;}
   }
  });
  child.on('error',e=>this.fail(e.message));
  child.on('exit',()=>{if(this.child!==child)return;this.latest=null;this.error=this.error??'Video process exited';this.schedule();});
 }
 schedule(){if(this.closed||this.retry)return;this.restarts++;this.retry=setTimeout(()=>{this.retry=null;this.start();},Math.min(10000,1000*this.restarts));this.retry.unref?.();}
 fail(message){if(this.failure)return;this.failure=true;this.error=message;this.latest=null;this.child?.kill();this.schedule();}
 metadata(line){
  const tb=/config in time_base:\s*(\d+)\/(\d+)/.exec(line);if(tb){this.timebase=[BigInt(tb[1]),BigInt(tb[2])];return;}
  const frame=/\bn:\s*(\d+)\s+pts:\s*(-?\d+).*?\bs:(\d+)x(\d+)/.exec(line);
  if(!frame)return;
  requireThat(this.timebase?.[1]>0n&&Number(frame[1])===this.expected++,'FRAME_ORDER','Capture timestamp sequence mismatch');
  const timestamp=Number(BigInt(frame[2])*this.timebase[0]*1000n/this.timebase[1]);
  const age=Date.now()-timestamp;
  requireThat(age>=-100&&age<2000,'CAPTURE_CLOCK','Camera timestamps are not current wall-clock time');
  this.meta.push({timestamp,width:Number(frame[3]),height:Number(frame[4])});this.pair();
 }
 pair(){
  requireThat(this.images.length<=4&&this.meta.length<=4,'VIDEO_BACKPRESSURE','Capture pipes fell behind');
  while(this.images.length&&this.meta.length){
   const bytes=this.images.shift(),meta=this.meta.shift(),size=jpegSize(bytes);
   requireThat(size.width===meta.width&&size.height===meta.height,'FRAME_ORDER','Image and metadata differ');
   const age=Date.now()-meta.timestamp;
   requireThat(age>=-100&&age<2000,'STALE_FRAME','Capture pipeline is behind');
   this.latest={bytes,mime:'image/jpeg',...size,source_id:this.generation+':'+(++this.sequence),capture_epoch:this.generation,
     at:performance.now(),base_age:Math.max(0,age)};
   this.error=null;this.restarts=0;
   for(const wake of this.waiters)wake();
  }
 }
 current(){if(!this.latest)return null;return {...this.latest,age_ms:this.latest.base_age+performance.now()-this.latest.at};}
 async capture(options={}){
  const ready=()=>{const f=this.current();return f&&f.age_ms<=1000&&f.source_id!==options.after&&(options.after_mono===undefined||f.at-f.base_age>=options.after_mono)?f:null;};
  const f=ready();if(f)return f;
  return new Promise((resolve,reject)=>{
   const done=()=>{const frame=ready();if(frame){cleanup();resolve(frame);}};
   const timer=setTimeout(()=>{cleanup();reject(Object.assign(new Error(this.error??'No fresh USB video frame'),{code:'VIDEO_OFFLINE'}));},1500);
   const cleanup=()=>{clearTimeout(timer);this.waiters.delete(done);};this.waiters.add(done);
  });
 }
 status(){const f=this.current();return {device:this.config.device,audio:false,connected:!!f&&f.age_ms<=1000,source_id:f?.source_id??null,width:f?.width,height:f?.height,age_ms:f?Math.round(f.age_ms):null,frame_bytes:f?.bytes.length??0,frames:this.sequence,error:this.error,capture_pid:this.child?.pid??null,fps:(this.config.input_fps??10)/Math.ceil((this.config.input_fps??10)/(this.config.fps??5))};}
 async close(){this.closed=true;clearTimeout(this.retry);this.latest=null;this.child?.kill();}
}
