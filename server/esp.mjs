import {randomBytes} from 'node:crypto';
import {SerialBridge} from './serial.mjs';
import {Openterface} from './openterface.mjs';
import {keyStroke,asciiStrokes} from './keys.mjs';
import {requireThat} from './contracts.mjs';

export function cursorPolicy(config, firmware, pointerMode) {
  const mode=config.cursor_keepalive??'auto';
  requireThat(['auto','off'].includes(mode),'CONFIG','cursor_keepalive must be auto or off');
  const display=config.display_mode??'unknown';
  requireThat(['unknown','mirror','dex','extended','desktop'].includes(display),'CONFIG','Invalid display_mode');
  const mobile=['android','ipados'].includes(config.target_os);
  const reason=mode==='off'?'disabled':!mobile?'not_mobile':display!=='mirror'?'mirror_not_confirmed':pointerMode!=='relative'?'not_relative':firmware!=='agent-auto-ops-0.3.4'?'firmware_update_required':null;
  return {enabled:reason===null,reason,interval_ms:1000,step_hid_counts:1,display_mode:display};
}
export function splitRelative(dx,dy,limit=127) {
  const n=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/limit)), out=[];
  for(let i=1;i<=n;i++)out.push({kind:'move_relative',dx:Math.round(dx*i/n)-Math.round(dx*(i-1)/n),dy:Math.round(dy*i/n)-Math.round(dy*(i-1)/n)});
  return out;
}
export class EspBackend {
  constructor(config, deps={}) {
    this.config=config;this.name='waveshare-esp32s3';this.coordinateMax=32767;
    this.makeSerial=deps.makeSerial??(c=>new SerialBridge(c));
    this.makeVideo=deps.makeVideo??(c=>new Openterface(c));
    this.videoOverride=deps.video;this.health={};
    this.epoch=0;this.closed=false;this.io=Promise.resolve();this.lastVideoAt=-Infinity;
    this.foreground=0;this.lastPulseAt=-Infinity;this.lastDiagnostics=-Infinity;this.pulseDirection=1;
    this.maintenance={enabled:false,reason:'not_connected',pulses:0,last_error:null};
    this.capabilities={actions:['click','move','move_relative','scroll','press_key','type_text','fill_text','drag','wait'],unicode:false,release:true,boot_relative:true,max_relative_delta:8192};
  }
  queue(fn) {const next=this.io.catch(()=>{}).then(fn);this.io=next;return next;}
  holdMaintenance() {
    this.foreground++;clearTimeout(this.pointerTimer);
    let released=false;
    return ()=>{if(released)return;released=true;this.foreground--;this.schedulePointer();};
  }
  async idle(){await this.io.catch(()=>{});}
  stopMaintenance(){this.maintenanceStopped=true;clearTimeout(this.pointerTimer);}
  schedulePointer() {
    clearTimeout(this.pointerTimer);
    if(this.closed||this.maintenanceStopped||this.foreground||!this.maintenance.enabled||this.maintenance.last_error)return;
    const due=Math.max(20,1000-(performance.now()-this.lastPulseAt));
    this.pointerTimer=setTimeout(async()=>{
      try{await this.maintenanceTick();}catch(e){this.maintenance.last_error=String(e.message);}
      finally{this.schedulePointer();}
    },due);
    this.pointerTimer.unref?.();
  }
  async openAdapter() {
    await this.serial?.close();
    this.serial=this.makeSerial(this.config.serial);await this.serial.connect();
    this.lastVideoAt=-Infinity;this.lastDiagnostics=-Infinity;
    try {
      const hello=await this.serial.request({v:1,op:'hello',seq:0});
      requireThat(/^agent-auto-ops-0\.3\.[0-4]$/.test(hello.firmware),'DEVICE_IDENTITY','Supported Agent Auto Ops firmware 0.3.x required; no input sent');
      // Verify physical identity before changing even the USB profile.
      requireThat(hello.ok&&hello.mac===this.config.serial.expected_mac,'DEVICE_IDENTITY','Adapter MAC differs from configured board');
      this.firmware=hello.firmware;
      this.capabilities.actions=['click','move','move_relative','scroll','press_key','type_text','fill_text','drag','wait'];
      if(this.firmware!=='agent-auto-ops-0.3.0')this.capabilities.actions.push('click_current','scroll_current');
      const relative=this.config.pointer_mode==='relative'||(this.config.pointer_mode!=='absolute'&&['android','ipados'].includes(this.config.target_os));
      if(relative)this.capabilities.actions=this.capabilities.actions.filter(x=>!['click','move','scroll','drag'].includes(x));
      this.capabilities.pointer_mode=relative?'relative':'absolute';
      this.capabilities.relative_units='HID counts, not pixels';
      this.capabilities.native_large_move=this.firmware==='agent-auto-ops-0.3.4';
      this.maintenance={...this.maintenance,...cursorPolicy(this.config,this.firmware,this.capabilities.pointer_mode)};
      if(!['agent-auto-ops-0.3.0','agent-auto-ops-0.3.1'].includes(this.firmware)){
        const profile=await this.serial.request({v:1,op:'hid_profile',seq:0,boot_id:hello.boot_id,profile:this.capabilities.pointer_mode});
        requireThat(profile.ok&&profile.boot_id===hello.boot_id&&profile.profile===this.capabilities.pointer_mode,'DEVICE_PROFILE','USB profile could not be selected');
      }
      this.boot=hello.boot_id;this.epoch++;this.health=hello;
    } catch(error) {this.serial.fault=true;await this.serial.close();throw error;}
  }
  setViewContext(display_mode) {
    const next={...this.config,display_mode};
    const policy=cursorPolicy(next,this.firmware,this.capabilities.pointer_mode);
    this.config=next;this.maintenance={...this.maintenance,...policy};this.schedulePointer();
  }
  async connect() {
    requireThat(this.videoOverride||this.config.openterface,'CONFIG','esp32 requires a video source');
    this.video=this.videoOverride??this.makeVideo(this.config.openterface);await this.video.connect();
    await this.openAdapter();await this.pulse(true);
    this.timer=setInterval(()=>{this.refresh().catch(e=>{this.lastHeartbeatError=String(e.message);});},1000);
    this.timer.unref?.();this.schedulePointer();
  }
  videoFresh() {
    const s=this.video.status?.();
    if(s&&Number.isFinite(s.age_ms))this.lastVideoAt=s.connected?performance.now()-s.age_ms:-Infinity;
    return performance.now()-this.lastVideoAt<=1000;
  }
  async pulse(diagnostics=false) {
    const r=await this.serial.request({v:1,op:'heartbeat',seq:0,boot_id:this.boot,video_ready:this.videoFresh()});
    requireThat(r.ok&&r.boot_id===this.boot,'DEVICE_SESSION','Adapter reset; refresh connection and observe again');
    if(diagnostics||performance.now()-this.lastDiagnostics>=5000){
      const hello=await this.serial.request({v:1,op:'hello',seq:0});
      requireThat(hello.ok&&hello.boot_id===this.boot&&hello.mac===this.config.serial.expected_mac,'DEVICE_SESSION','Adapter identity changed');
      this.health=hello;
      if(this.firmware!=='agent-auto-ops-0.3.0')this.health.hid=await this.serial.request({v:1,op:'hid_status',seq:0});
      this.lastDiagnostics=performance.now();
    }
    this.lastHeartbeatError=null;return r;
  }
  async refresh() {
    if(this.closed||this.refreshing)return;
    this.refreshing=true;
    try {
      try{await this.capture();}catch{this.lastVideoAt=-Infinity;}
      await this.queue(async()=>{
        if(this.closed)return;
        if(this.serial?.fault)await this.openAdapter();
        try{await this.pulse();}catch(e){this.serial.fault=true;throw e;}
      });
    }finally{this.refreshing=false;}
  }
  async capture(options) {
    const f=await this.video.capture(options);
    this.lastVideoAt=Number.isFinite(f.age_ms)&&f.age_ms>=0&&f.age_ms<=1000&&f.source_id?performance.now()-f.age_ms:-Infinity;
    return {...f,link_epoch:this.epoch};
  }
  validateKey(a){keyStroke(a.key,a.modifiers);}
  wireAction(a) {
    if(a.kind==='press_key')return {kind:'press_key',strokes:[keyStroke(a.key,a.modifiers)]};
    if(a.kind==='type_text')return {kind:'type_text',strokes:asciiStrokes(a.text)};
    if(a.kind==='fill_text')return {kind:'type_text',strokes:[keyStroke('a',['Ctrl']),...asciiStrokes(a.text),...(a.submit?[keyStroke('Enter')]:[])]};
    return {...a};
  }
  async dispatch(actions) {
    const session=randomBytes(16).toString('hex');
    const b=await this.serial.request({v:1,op:'begin',seq:0,boot_id:this.boot,session});
    requireThat(b.ok&&b.boot_id===this.boot,'DEVICE_SESSION','Adapter reset, unavailable or stopped');
    let seq=0,r;
    for(const action of actions){
      requireThat(!this.closed,'DEVICE_OFFLINE','Session closed during input');
      r=await this.serial.request({v:1,op:'act',session,seq:++seq,action:this.wireAction(action)});
      requireThat(r.ok&&r.seq===seq&&r.boot_id===this.boot,'DEVICE_ACTION','Adapter input failed; outcome may be partial');
    }
    return {delivery:r.delivery,wire_actions:seq};
  }
  async perform(a, context={}) {
    return this.queue(async()=>{
      requireThat(!this.closed&&!this.serial?.fault,'DEVICE_OFFLINE','Adapter disconnected; observe again after reconnection');
      requireThat(context.link_epoch===this.epoch,'TARGET_LINK_CHANGED','Adapter reconnected; acquire a new observation before input');
      await this.pulse();
      const actions=a.kind==='move_relative'&&!this.capabilities.native_large_move?splitRelative(a.dx,a.dy):[a];
      return this.dispatch(actions);
    });
  }
  async ensurePointerVisible({force=false,foreground=true}={}) {
    if(!this.maintenance.enabled||this.maintenance.last_error||this.maintenanceStopped||this.closed)return false;
    if(!force&&performance.now()-this.lastPulseAt<950)return false;
    return this.queue(async()=>{
      if(this.closed||this.maintenanceStopped||(!foreground&&this.foreground)||this.serial?.fault||!this.videoFresh())return false;
      if(!force&&performance.now()-this.lastPulseAt<950)return false;
      if(this.health.mounted===false||this.health.hid?.suspended)return false;
      try {
        await this.pulse();
        await this.dispatch([{kind:'pointer_keepalive',direction:this.pulseDirection}]);
        this.pulseDirection=-this.pulseDirection;this.lastPulseAt=performance.now();
        this.maintenance.pulses++;this.maintenance.last_pulse_at=new Date().toISOString();return true;
      }catch(e){
        if(e.code==='DEVICE_SESSION'){this.lastPulseAt=performance.now();this.maintenance.last_skip='device_not_ready';return false;}
        this.maintenance.last_error=String(e.message);
        // An incomplete pair is not retried: position may have shifted by one count.
        try{await this.serial.request({v:1,op:'release',seq:0});}catch{}
        throw e;
      }
    });
  }
  async maintenanceTick() {
    if(this.foreground)return false;
    const moved=await this.ensurePointerVisible({foreground:false});
    if(!moved)this.lastPulseAt=performance.now();
    return moved;
  }
  async release() {
    return this.queue(async()=>{if(!this.serial||this.serial.fault)return 'unavailable';
      const r=await this.serial.request({v:1,op:'release',seq:0});return r.ok?'usb_release_sent':'release_unknown';});
  }
  async close() {
    this.closed=true;clearInterval(this.timer);this.stopMaintenance();
    await this.io.catch(()=>{});await this.serial?.close();await this.video?.close();
  }
}
