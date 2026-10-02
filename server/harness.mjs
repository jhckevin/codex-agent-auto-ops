import {randomUUID,createHash} from 'node:crypto';
import {CuaError,requireThat,validateAction,geometry,mapAction,delay} from './contracts.mjs';
export class Harness {
  constructor(backend, config={}) {
    this.backend=backend; this.config={target_id:'unconfigured',observation_ttl_ms:30000,max_frame_age_ms:1000,settle_ms:120,post_action_timeout_ms:1800,post_action_quiet_ms:240,...config};
    this.session_id=randomUUID(); this.latest=null; this.busy=false; this.stopped=false; this.records=new Map();this.metrics={actions:0,last:null};
  }
  status() {
    return {session_id:this.session_id,target_id:this.config.target_id,backend:this.backend.name,
      simulation:!!this.backend.simulation,stopped:this.stopped,busy:this.busy,capabilities:this.backend.capabilities,
      display_mode:this.config.display_mode??'unknown',cursor_keepalive:this.backend.maintenance??{enabled:false,reason:'unsupported_backend'},metrics:this.metrics,
      hardware:this.backend.health??null,video:this.backend.video?.status?.()??null,target_os:this.config.target_os??'unspecified',preview_url:this.config.preview_url??null,
      observation_id:this.latest?.meta.observation_id ?? null};
  }
  async exclusive(fn) {
    requireThat(!this.busy,'BUSY','Another observation or action is running');
    this.busy=true; const resume=this.backend.holdMaintenance?.();
    try {if(this.backend.idle)await this.backend.idle();return await fn();} finally {resume?.();this.busy=false;}
  }
  async snapshot(options) {
    this.latest=null;
    const f=await this.backend.capture(options);
    requireThat(f && Buffer.isBuffer(f.bytes) && f.bytes.length>0 && f.bytes.length<=12*1024*1024,'NO_FRAME','missing or oversized frame');
    requireThat(['image/png','image/jpeg'].includes(f.mime),'NO_FRAME','unsupported frame encoding');
    const v=geometry(f,this.config.viewport);
    const age=typeof f.age_ms==='number'?f.age_ms:null;
    if(age!==null) requireThat(Number.isFinite(age)&&age>=0&&age<=this.config.max_frame_age_ms,'STALE_FRAME','capture source is stale');
    const verified=age!==null&&typeof f.source_id==='string'&&f.source_id.length>0;
    const meta={observation_id:randomUUID(),session_id:this.session_id,target_id:this.config.target_id,
      width:f.width,height:f.height,viewport:v,rotation:this.config.rotation??0,
      received_at:new Date().toISOString(),source_id:f.source_id??null,capture_epoch:f.capture_epoch??null,link_epoch:f.link_epoch??null,source_age_ms:age,
      freshness:verified?'source_measured':'unknown',simulation:!!this.backend.simulation,
      sha256:createHash('sha256').update(f.bytes).digest('hex'),actionable:verified&&!this.stopped,
      capabilities:this.backend.capabilities};
    const observation={meta,frame:f,received:performance.now()};
    if(!this.stopped) this.latest=observation;
    return observation;
  }
  observe(options={}) {
    return this.exclusive(async()=>{
      const before=this.latest;
      if(this.backend.ensurePointerVisible)await this.backend.ensurePointerVisible();
      if(!options.wait_for_change||!before)return this.snapshot();
      const deadline=performance.now()+(options.timeout_ms??1800);
      let next;
      do {
        next=await this.snapshot({after:next?.meta.source_id??before.meta.source_id});
        if(next.meta.sha256!==before.meta.sha256)return next;
        if(performance.now()+100<deadline)await delay(100);
      }while(performance.now()<deadline&&!this.stopped);
      return next;
    });
  }
  setViewContext({observation_id,display_mode}) {
    return this.exclusive(async()=>{
      requireThat(!this.stopped,'STOPPED','Session stopped');
      requireThat(this.latest?.meta.observation_id===observation_id&&performance.now()-this.latest.received<=this.config.observation_ttl_ms,'OBSOLETE_OBSERVATION','Use a fresh image to classify the display mode');
      requireThat(['mirror','dex','extended','desktop','unknown'].includes(display_mode),'INVALID_ARGUMENT','display_mode');
      this.backend.setViewContext?.(display_mode);this.config.display_mode=display_mode;this.latest=null;
      return this.status();
    });
  }
  async settleAfter(action,check,inputFinished,beforeHash) {
    const adaptive=this.config.adaptive_wait??this.config.settle_ms!==0;
    const motion=['move','move_relative','wait'].includes(action.kind);
    const min=adaptive?Math.max(this.config.settle_ms,motion?120:action.kind==='fill_text'&&action.submit?800:600):this.config.settle_ms;
    const deadline=inputFinished+Math.max(min,this.config.post_action_timeout_ms);
    await delay(min);
    let next,changed=false,lastHash=null,unchangedSince=performance.now(),samples=0,reason='fresh_frame';
    for(;;){
      requireThat(!this.stopped,'STOPPED','Session stopped during frame wait');
      if(this.backend.ensurePointerVisible)await this.backend.ensurePointerVisible();
      next=await this.snapshot({after:next?.meta.source_id??check.source_id,after_mono:inputFinished});
      samples++;
      requireThat(next.meta.capture_epoch===(check.capture_epoch??null),'CAPTURE_CHANGED','Video source changed during input');
      requireThat(next.meta.link_epoch===(check.link_epoch??null),'TARGET_LINK_CHANGED','Target connection changed during input');
      requireThat(next.meta.width===check.width&&next.meta.height===check.height,'MODE_CHANGED','Display mode changed during input');
      requireThat(next.meta.source_id!==check.source_id,'NO_NEW_FRAME','No new capture frame after the action');
      requireThat(next.received-next.meta.source_age_ms>=inputFinished,'PRE_ACTION_FRAME','Post-action image was captured before input completed');
      changed ||= next.meta.sha256!==beforeHash;
      const now=performance.now();
      if(lastHash!==next.meta.sha256){lastHash=next.meta.sha256;unchangedSince=now;}
      if(!adaptive||motion)break;
      if(changed&&now-unchangedSince>=this.config.post_action_quiet_ms){reason='image_quiet';break;}
      if(now+150>=deadline){reason=changed?'dynamic_or_timeout':'no_visible_change';break;}
      await delay(Math.min(80,deadline-now));
    }
    return {next,settling:{reason,image_hash_changed:changed,semantic_success_verified:false,samples,elapsed_ms:Math.round(performance.now()-inputFinished)}};
  }
  async act({observation_id,operation_id,action}) {
    requireThat(typeof operation_id==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(operation_id),'INVALID_ARGUMENT','operation_id must be 8..80 safe characters');
    validateAction(action);
    const signature=JSON.stringify({observation_id,action});
    const existing=this.records.get(operation_id);
    if(existing) {
      requireThat(existing.signature===signature,'OPERATION_CONFLICT','operation ID reused with different arguments');
      return {...existing.result,replayed:true};
    }
    const queuedAt=performance.now();
    return this.exclusive(async()=>{
      requireThat(!this.stopped,'STOPPED','Session stopped; restart the server explicitly');
      const o=this.latest;
      requireThat(o&&o.meta.observation_id===observation_id,'OBSOLETE_OBSERVATION','Observe before acting; only the latest observation can be consumed');
      requireThat(performance.now()-o.received<=this.config.observation_ttl_ms,'EXPIRED_OBSERVATION','Observation expired; observe again');
      requireThat(o.meta.actionable,'UNVERIFIED_FRAME','Source lacks frame freshness metadata; observe is read-only until source is instrumented');
      requireThat(this.backend.capabilities.actions.includes(action.kind),'UNSUPPORTED_ACTION','Backend does not support action');
      const mapped=mapAction(action,o.meta.viewport,this.backend.coordinateMax??32767,o.meta.rotation);
      if(action.kind==='press_key') this.backend.validateKey?.(mapped);
      this.latest=null;
      const record={signature,result:{operation_id,status:'unknown',retry:'observe_without_replaying'}};
      this.records.set(operation_id,record);
      while(this.records.size>128) this.records.delete(this.records.keys().next().value);
      const started=queuedAt,workStarted=performance.now(),timings={queue_ms:Math.round(workStarted-queuedAt)};let phase='capture_preflight';
      try {
        // Capture again without showing a new decision frame: catch disconnects and mode changes before dispatch.
        const check=await this.backend.capture();
        requireThat((check.link_epoch??null)===o.meta.link_epoch,'TARGET_LINK_CHANGED','Adapter reconnected; observe again');
        requireThat((check.capture_epoch??null)===o.meta.capture_epoch,'CAPTURE_CHANGED','Video source restarted; observe again');
        requireThat(check.width===o.meta.width&&check.height===o.meta.height,'MODE_CHANGED','Display mode changed; observe again');
        requireThat(Number.isFinite(check.age_ms)&&check.age_ms<=this.config.max_frame_age_ms&&check.age_ms>=0,'STALE_FRAME','No fresh source before input');
        requireThat(!this.stopped,'STOPPED','Session stopped');
        timings.preflight_ms=Math.round(performance.now()-workStarted);
        phase='pointer_prepare';const pointerStarted=performance.now();if(this.backend.ensurePointerVisible)await this.backend.ensurePointerVisible({force:true});timings.pointer_prepare_ms=Math.round(performance.now()-pointerStarted);
        const label=['type_text','fill_text'].includes(action.kind)?'输入 '+action.text.length+' 个字符':action.kind==='press_key'?[...(action.modifiers??[]),action.key].join(' + '):({click:'点击',move:'移动指针',move_relative:'相对移动',click_current:'当前位置点击',scroll_current:'当前位置滚动',scroll:'滚动',drag:'拖动',wait:'等待'}[action.kind]);
        const event={kind:'action',operation_id,label,action_kind:action.kind,character_count:['type_text','fill_text'].includes(action.kind)?action.text.length:undefined,key_chord:action.kind==='press_key'?label:undefined,delta:action.kind==='move_relative'?{x:action.dx,y:action.dy}:undefined,point:Object.hasOwn(action,'x')?{x:action.x,y:action.y}:action.path?.at(-1),width:o.meta.width,height:o.meta.height,frame:o.meta.source_id};
        record.event=event;this.config.onEvent?.({...event,status:'started'});
        phase='hid_dispatch';const dispatchStarted=performance.now();
        const ack=action.kind==='wait'?(await delay(action.duration_ms),{delivery:'none'}):await this.backend.perform(mapped,{link_epoch:o.meta.link_epoch});
        const inputFinished=performance.now();timings.hid_ms=Math.round(inputFinished-dispatchStarted);timings.wire_actions=ack.wire_actions??1;
        phase='pointer_restore';if(this.backend.ensurePointerVisible)await this.backend.ensurePointerVisible({force:true});
        phase='post_action_capture';
        const {next,settling}=await this.settleAfter(action,check,inputFinished,o.meta.sha256);
        timings.post_action_ms=Math.round(performance.now()-inputFinished);timings.total_ms=Math.round(performance.now()-started);
        this.metrics.actions++;this.metrics.last={...timings,settling};
        requireThat(!this.stopped,'STOPPED','Session stopped during action');
        record.result={operation_id,status:'awaiting_visual_verification',delivery:ack.delivery??'unknown',input_observation_id:observation_id,original_observation_id:next.meta.observation_id,timings,settling};
        this.config.onEvent?.({...record.event,status:record.result.status,frame:next.meta.source_id});
        return {...record.result,observation:next};
      } catch(error) {
        this.latest=null;
        let release='not_supported';
        try {release=await this.backend.release();} catch {release='unknown';}
        record.result={operation_id,status:'unknown',error_code:error.code??'BACKEND_ERROR',
          message:String(error.message),phase,timings:{...timings,total_ms:Math.round(performance.now()-started)},release,retry:'observe_without_replaying'};
      }
      if(record.event)this.config.onEvent?.({...record.event,status:record.result.status});
      return record.result;
    });
  }
  async stop() { this.stopped=true; this.latest=null;this.backend.stopMaintenance?.(); const release=await this.backend.release(); return {stopped:true,release}; }
}
