import {spawn} from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import {requireThat} from './contracts.mjs';
export function serialCommand(config, platform=process.platform, base=path.resolve(typeof __dirname==='string'?__dirname:process.cwd(),'../scripts')) {
  if(platform==='win32'){
    requireThat(/^COM[1-9][0-9]*$/.test(config.port),'CONFIG','explicit COM port required');
    return {command:'powershell.exe',args:['-NoLogo','-NoProfile','-NonInteractive','-File',config.bridge_script??path.join(base,'serial-bridge.ps1'),'-Port',config.port]};
  }
  requireThat(['darwin','linux'].includes(platform),'PLATFORM','Supported hosts: Windows, macOS and Linux');
  requireThat(platform==='darwin'?/^\/dev\/cu\.[A-Za-z0-9._-]+$/.test(config.port):/^\/dev\/(?:tty(?:USB|ACM)[0-9]+|serial\/by-id\/[A-Za-z0-9._:-]+)$/.test(config.port),'CONFIG','explicit serial device required (macOS: /dev/cu.*)');
  return {command:config.python??'python3',args:['-u',config.bridge_script??path.join(base,'serial-bridge-posix.py'),'--port',config.port]};
}
export class SerialBridge {
  constructor(config) {this.config=config;this.pending=null;this.fault=false;}
  async connect() {
    const spec=serialCommand(this.config);
    this.child=spawn(spec.command,spec.args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
    this.child.stderr.on('data',d=>process.stderr.write(d));
    this.child.on('error',e=>this.fail(e));
    this.child.on('exit',()=>this.fail(new Error('Serial bridge exited; outcome unknown')));
    readline.createInterface({input:this.child.stdout}).on('line',line=>{
      let r;try{r=JSON.parse(line);}catch{return;}
      if(this.pending){const p=this.pending;this.pending=null;clearTimeout(p.timer);r.bridge_error?p.reject(new Error(r.bridge_error)):p.resolve(r);}
    });
  }
  fail(e){this.fault=true;if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(e);this.pending=null;}}
  async request(message) {
    requireThat(!this.fault&&!this.pending,'SERIAL_FAULT','Serial unavailable or busy; restart after inspection');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.fail(new Error('Serial timeout; outcome unknown'));this.child.kill();},6000);
      this.pending={resolve,reject,timer};
      this.child.stdin.write(JSON.stringify(message)+'\n',e=>{if(e)this.fail(e);});
    });
  }
  async close(){this.child?.stdin.end();this.child?.kill();}
}
