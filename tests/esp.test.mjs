import test from 'node:test';
import assert from 'node:assert/strict';
import {EspBackend,cursorPolicy,splitRelative} from '../server/esp.mjs';
function fixture({firmware='agent-auto-ops-0.3.0',target_os='windows',display_mode='unknown'}={}){
 const sent=[];let boot=21,pending=0,mac="02:00:00:00:00:01";const transports=[];
 const b=new EspBackend({openterface:{},target_os,display_mode,serial:{expected_mac:'02:00:00:00:00:01'}},{
  makeSerial:()=>{const s={fault:false,connect:async()=>{},close:async()=>{},request:async r=>{
   assert.equal(pending++,0,'serial requests must never overlap');sent.push(r);
   await new Promise(resolve=>setTimeout(resolve,2));pending--;
   return {ok:true,firmware,profile:r.profile,mac,boot_id:boot,seq:r.seq,delivery:'usb_reports_completed'};
  }};transports.push(s);return s;},
  makeVideo:()=>({connect:async()=>{},close:async()=>{},capture:async()=>({age_ms:10,source_id:'f',bytes:Buffer.from('image'),mime:'image/png',width:480,height:480})})
 });
 return {b,sent,transports,wrongBoard:()=>{mac="00:11:22:33:44:55";transports.at(-1).fault=true;},reboot:()=>{boot++;transports.at(-1).fault=true;}};
}
test('UI heartbeat reports freshness and serializes with input',async()=>{
 const{b,sent}=fixture();await b.connect();clearInterval(b.timer);
 assert.equal(sent.find(x=>x.op==='heartbeat').video_ready,false);
 const f=await b.capture();
 await Promise.all([b.perform({kind:'move',x:10,y:20},{link_epoch:f.link_epoch}),b.refresh()]);
 assert.equal(sent.filter(x=>x.op==='act').length,1);
 assert(sent.some(x=>x.op==='heartbeat'&&x.video_ready));await b.close();
});
test('replug recovers status but cannot replay an observation from the old connection',async()=>{
 const{b,sent,reboot}=fixture();await b.connect();clearInterval(b.timer);const old=await b.capture();
 reboot();await b.refresh();
 await assert.rejects(b.perform({kind:'move',x:10,y:20},{link_epoch:old.link_epoch}),{code:'TARGET_LINK_CHANGED'});
 assert.equal(sent.filter(x=>x.op==='act').length,0);
 const fresh=await b.capture();await b.perform({kind:'move',x:1,y:2},{link_epoch:fresh.link_epoch});
 assert.equal(sent.filter(x=>x.op==='act').length,1);await b.close();
});

test('reconnect rejects a different physical adapter without exposing an input path',async()=>{
 const{b,sent,wrongBoard}=fixture();await b.connect();clearInterval(b.timer);const f=await b.capture();
 wrongBoard();await assert.rejects(b.refresh(),{code:'DEVICE_IDENTITY'});
 assert.equal(b.serial.fault,true);
 await assert.rejects(b.perform({kind:'move',x:1,y:2},{link_epoch:f.link_epoch}),{code:'DEVICE_OFFLINE'});
 assert.equal(sent.filter(x=>x.op==='act').length,0);await b.close();
});

test('Android selects standard USB profile only after identity verification',async()=>{
 const{b,sent}=fixture({firmware:'agent-auto-ops-0.3.3',target_os:'android'});
 await b.connect();clearInterval(b.timer);
 assert.equal(b.capabilities.pointer_mode,'relative');
 assert(b.capabilities.actions.includes('click_current'));
 assert(!b.capabilities.actions.includes('click'));
 const profile=sent.find(x=>x.op==='hid_profile');
 assert.equal(profile.profile,'relative');assert.equal(profile.boot_id,21);
 assert(sent.findIndex(x=>x.op==='hello')<sent.findIndex(x=>x.op==='hid_profile'));
 await b.close();
});

test('large relative motion uses one native action or bounded legacy packets in a single session',async()=>{
 for(const firmware of ['agent-auto-ops-0.3.3','agent-auto-ops-0.3.4']){
  const {b,sent}=fixture({firmware,target_os:'android'});await b.connect();clearInterval(b.timer);
  const f=await b.capture();sent.length=0;
  await b.perform({kind:'move_relative',dx:1750,dy:-911},{link_epoch:f.link_epoch});
  const acts=sent.filter(x=>x.op==='act');
  assert.equal(sent.filter(x=>x.op==='begin').length,1);
  assert.equal(acts.length,firmware.endsWith('.4')?1:14);
  assert.equal(acts.reduce((n,x)=>n+x.action.dx,0),1750);
  assert.equal(acts.reduce((n,x)=>n+x.action.dy,0),-911);
  if(firmware.endsWith('.3'))assert(acts.every(x=>Math.abs(x.action.dx)<=127&&Math.abs(x.action.dy)<=127));
  await b.close();
 }
});
test('motion splitting preserves both axes for signed and zero distances',()=>{
 for(const dx of [-8192,-128,-127,0,127,128,8192])for(const dy of [-8192,-1,0,1,8192]){
  const parts=splitRelative(dx,dy);
  assert.equal(parts.reduce((n,a)=>n+a.dx,0),dx);assert.equal(parts.reduce((n,a)=>n+a.dy,0),dy);
  assert(parts.every(a=>Math.abs(a.dx)<=127&&Math.abs(a.dy)<=127));
 }
});
test('mirror policy is explicit and automatic for Android and iPadOS only',()=>{
 for(const target_os of ['android','ipados'])assert(cursorPolicy({target_os,display_mode:'mirror'},'agent-auto-ops-0.3.4','relative').enabled);
 for(const display_mode of ['unknown','dex','extended','desktop'])assert(!cursorPolicy({target_os:'android',display_mode},'agent-auto-ops-0.3.4','relative').enabled);
 assert.equal(cursorPolicy({target_os:'android',display_mode:'mirror'},'agent-auto-ops-0.3.3','relative').reason,'firmware_update_required');
 assert(!cursorPolicy({target_os:'windows',display_mode:'mirror'},'agent-auto-ops-0.3.4','relative').enabled);
});
test('idle maintenance cannot interleave with foreground actions or run after stop',async()=>{
 const {b,sent}=fixture({firmware:'agent-auto-ops-0.3.4',target_os:'android',display_mode:'mirror'});
 await b.connect();clearInterval(b.timer);clearTimeout(b.pointerTimer);await b.capture();sent.length=0;
 const unhold=b.holdMaintenance();
 assert.equal(await b.maintenanceTick(),false);assert.equal(sent.filter(x=>x.op==='act').length,0);
 await b.ensurePointerVisible({force:true});
 await b.perform({kind:'click_current'},{link_epoch:b.epoch});
 await b.ensurePointerVisible({force:true});
 assert.deepEqual(sent.filter(x=>x.op==='act').map(x=>x.action.kind),['pointer_keepalive','click_current','pointer_keepalive']);
 const dirs=sent.filter(x=>x.action?.kind==='pointer_keepalive').map(x=>x.action.direction);assert.deepEqual(dirs,[1,-1]);
 unhold();b.stopMaintenance();assert.equal(await b.ensurePointerVisible({force:true}),false);await b.close();
});
test('stale video suppresses automatic maintenance without touching HID',async()=>{
 const {b,sent}=fixture({firmware:'agent-auto-ops-0.3.4',target_os:'android',display_mode:'mirror'});
 await b.connect();clearInterval(b.timer);clearTimeout(b.pointerTimer);sent.length=0;
 assert.equal(await b.maintenanceTick(),false);assert.equal(sent.length,0);await b.close();
});
test('unknown keepalive outcome disables further automatic pulses',async()=>{
 const {b,sent}=fixture({firmware:'agent-auto-ops-0.3.4',target_os:'ipados',display_mode:'mirror'});
 await b.connect();clearInterval(b.timer);clearTimeout(b.pointerTimer);await b.capture();
 const original=b.serial.request;b.serial.request=async r=>{const ack=await original(r);return r.action?.kind==='pointer_keepalive'?{...ack,ok:false}:ack;};
 await assert.rejects(b.ensurePointerVisible({force:true}),{code:'DEVICE_ACTION'});
 const count=sent.length;assert.equal(await b.ensurePointerVisible({force:true}),false);assert.equal(sent.length,count);await b.close();
});
test('ordinary heartbeat is one request; diagnostics are sampled separately',async()=>{
 const {b,sent}=fixture({firmware:'agent-auto-ops-0.3.4'});await b.connect();clearInterval(b.timer);sent.length=0;
 await b.refresh();assert.deepEqual(sent.map(x=>x.op),['heartbeat']);await b.close();
});
test('fill_text composes replace, ASCII and optional Enter once',async()=>{
 const {b,sent}=fixture();await b.connect();clearInterval(b.timer);const f=await b.capture();
 await b.perform({kind:'fill_text',text:'gpt6sol opus5.5',submit:true},{link_epoch:f.link_epoch});
 const a=sent.find(x=>x.op==='act').action;assert.equal(a.kind,'type_text');
 assert.deepEqual(a.strokes[0],{usage:4,mod:1});assert.deepEqual(a.strokes.at(-1),{usage:40,mod:0});assert.equal(a.strokes.length,17);await b.close();
});
test('wrong board cannot receive even a USB profile change',async()=>{
 const {b,sent,wrongBoard}=fixture({firmware:'agent-auto-ops-0.3.4',target_os:'android'});
 await b.connect();clearInterval(b.timer);wrongBoard();sent.length=0;
 await assert.rejects(b.refresh(),{code:'DEVICE_IDENTITY'});
 assert(!sent.some(x=>['hid_profile','begin','act'].includes(x.op)));await b.close();
});

test('mirror cursor maintenance runs on its own timer without model calls',async()=>{
 const {b,sent}=fixture({firmware:'agent-auto-ops-0.3.4',target_os:'android',display_mode:'mirror'});
 await b.connect();clearInterval(b.timer);
 b.video.status=()=>({connected:true,age_ms:0});await b.capture();
 await new Promise(resolve=>setTimeout(resolve,1150));
 assert(sent.filter(x=>x.action?.kind==='pointer_keepalive').length>=2);
 b.stopMaintenance();const count=sent.length;await new Promise(resolve=>setTimeout(resolve,40));assert.equal(sent.length,count);
 await b.close();
});
