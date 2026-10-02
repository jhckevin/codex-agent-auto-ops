import test from 'node:test';
import assert from 'node:assert/strict';
import {Harness} from '../server/harness.mjs';
import {Simulator} from '../server/simulator.mjs';
import {toHid,validateAction,geometry} from '../server/contracts.mjs';
import {keyStroke,asciiStrokes} from '../server/keys.mjs';
function fixture(config={}) {const b=new Simulator();return {b,h:new Harness(b,{target_id:'fixture',settle_ms:0,...config})};}
const click={kind:'click',x:100,y:300};
test('observe -> click -> inspect fresh frame, exactly one execution on retry',async()=>{
 const {b,h}=fixture(),o=await h.observe(),r={observation_id:o.meta.observation_id,operation_id:'operation-0001',action:click};
 const first=await h.act(r),again=await h.act(r);
 assert.equal(first.status,'awaiting_visual_verification');assert.equal(again.replayed,true);assert.equal(again.observation,undefined);
 assert.notEqual(first.observation.meta.sha256,o.meta.sha256);assert.equal(b.events.length,1);assert.equal(b.checked,true);
 await assert.rejects(h.act({...r,action:{...click,x:101}}),{code:'OPERATION_CONFLICT'});
});
test('old and consumed observations cannot drive another input',async()=>{
 const {b,h}=fixture(),a=await h.observe();await h.observe();
 await assert.rejects(h.act({observation_id:a.meta.observation_id,operation_id:'stale-id-001',action:click}),{code:'OBSOLETE_OBSERVATION'});
 assert.equal(b.events.length,0);
});
test('unknown input outcome is never automatically repeated',async()=>{
 const {b,h}=fixture(); b.perform=async a=>{b.events.push(a);throw Error('link lost after send');};
 const o=await h.observe(),q={observation_id:o.meta.observation_id,operation_id:'unknown-0001',action:click};
 const r=await h.act(q);assert.equal(r.status,'unknown');assert.equal(h.latest,null);
 assert.equal((await h.act(q)).replayed,true);assert.equal(b.events.length,1);
});
test('input cannot be authorized by unmeasured or stale frames',async()=>{
 const {b,h}=fixture();const capture=b.capture.bind(b);
 b.capture=async()=>({...await capture(),age_ms:null});
 const o=await h.observe();assert.equal(o.meta.actionable,false);
 await assert.rejects(h.act({observation_id:o.meta.observation_id,operation_id:'unverified-01',action:click}),{code:'UNVERIFIED_FRAME'});
 b.capture=async()=>({...await capture(),age_ms:2000});
 await assert.rejects(h.observe(),{code:'STALE_FRAME'});assert.equal(b.events.length,0);
});
test('resolution change detected before dispatch',async()=>{
 const {b,h}=fixture(),o=await h.observe();b.width=800;
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'resize-0001',action:click});
 assert.equal(r.error_code,'MODE_CHANGED');assert.equal(b.events.length,0);
});
test('failed post-action screenshot invalidates the observation',async()=>{
 const {b,h}=fixture(),o=await h.observe();let calls=0;const capture=b.capture.bind(b);
 b.capture=async()=>{if(++calls>1)throw Error('signal lost');return capture();};
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'signal-0001',action:click});
 assert.equal(r.status,'unknown');assert.equal(b.events.length,1);assert.equal(h.latest,null);
});
test('same pixels with a newer capture timestamp remain fresh',async()=>{
 const {h}=fixture(),o=await h.observe();
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'wait-0001',action:{kind:'wait',duration_ms:0}});
 assert.equal(r.status,'awaiting_visual_verification');assert.equal(o.meta.sha256,r.observation.meta.sha256);
});
test('serialized calls reject concurrent control instead of queuing',async()=>{
 const {b,h}=fixture();const original=b.capture.bind(b);let release;
 b.capture=()=>new Promise(resolve=>{release=()=>original().then(resolve);});
 const first=h.observe();await assert.rejects(h.observe(),{code:'BUSY'});release();await first;
});
test('letterbox coordinates and rotation are mapped deterministically',()=>{
 const v={x:20,y:10,width:101,height:201};
 assert.deepEqual(toHid(20,10,v),{x:0,y:0});assert.deepEqual(toHid(120,210,v),{x:32767,y:32767});
 assert.deepEqual(toHid(20,10,v,32767,90),{x:0,y:32767});
 assert.throws(()=>toHid(19,10,v),{code:'OUTSIDE_VIEWPORT'});
 assert.throws(()=>geometry({width:100,height:100},{x:0,y:0,width:101,height:100}),{code:'INVALID_ARGUMENT'});
});
test('reject malformed actions and Unicode before any backend effect',()=>{
 for(const a of [{kind:'click',x:NaN,y:1},{kind:'drag',path:[{x:1,y:1}]},{kind:'type_text',text:'中文'},{kind:'click',x:1,y:2,shell:'oops'}])assert.throws(()=>validateAction(a));
 assert.deepEqual(keyStroke('a',['Ctrl']),{usage:4,mod:1});
 assert.deepEqual(asciiStrokes('A! '),[{usage:4,mod:2},{usage:30,mod:2},{usage:44,mod:0}]);
 assert.equal(asciiStrokes(Array.from({length:95},(_,i)=>String.fromCharCode(i+32)).join('')).length,95);
});
test('stop permanently revokes observations',async()=>{
 const {b,h}=fixture(),o=await h.observe();await h.stop();
 await assert.rejects(h.act({observation_id:o.meta.observation_id,operation_id:'stop-0001',action:click}),{code:'STOPPED'});
 assert.equal(b.events.length,0);assert.equal((await h.observe()).meta.actionable,false);
});
test('text is entered only after a separate focus action in simulator',async()=>{
 const {h,b}=fixture(),o=await h.observe();
 const focus=await h.act({observation_id:o.meta.observation_id,operation_id:'focus-0001',action:{kind:'click',x:80,y:160}});
 await h.act({observation_id:focus.observation.meta.observation_id,operation_id:'typing-0001',action:{kind:'type_text',text:'hello'}});
 assert.equal(b.text,'hello');
});

test('video restart invalidates an old decision even when USB is unchanged',async()=>{
 const {b,h}=fixture();const capture=b.capture.bind(b);let epoch='one';
 b.capture=async()=>({...await capture(),capture_epoch:epoch});
 const o=await h.observe();epoch='two';
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'new-camera-001',action:click});
 assert.equal(r.error_code,'CAPTURE_CHANGED');assert.equal(b.events.length,0);
});
test('a new sequence captured before input completion cannot verify the action',async()=>{
 const {b,h}=fixture();const capture=b.capture.bind(b);let calls=0;
 b.capture=async()=>({...await capture(),age_ms:++calls>=3?500:0});
 const o=await h.observe();
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'pre-input-001',action:click});
 assert.equal(r.error_code,'PRE_ACTION_FRAME');assert.equal(b.events.length,1);assert.equal(h.latest,null);
});

test('bounded local wait returns a delayed UI update with one model action',async()=>{
 let content='before',seq=0;
 const b={name:'delayed-ui',capabilities:{actions:['click']},capture:async()=>({bytes:Buffer.from(content),mime:'image/png',width:480,height:800,age_ms:0,source_id:String(++seq)}),perform:async()=>{setTimeout(()=>{content='after';},800);return {delivery:'test',wire_actions:1};},release:async()=> 'released'};
 const h=new Harness(b,{settle_ms:0,adaptive_wait:true,post_action_timeout_ms:1300,post_action_quiet_ms:120});
 const o=await h.observe(),r=await h.act({observation_id:o.meta.observation_id,operation_id:'delayed-ui-one',action:click});
 assert.equal(r.observation.frame.bytes.toString(),'after');assert.equal(r.settling.reason,'image_quiet');
 assert.equal(r.settling.semantic_success_verified,false);assert(r.timings.total_ms>=800);assert.equal(r.timings.wire_actions,1);
});
test('an unchanged interface is reported without replaying the action',async()=>{
 let seq=0,actions=0;
 const b={name:'unchanged',capabilities:{actions:['click']},capture:async()=>({bytes:Buffer.from('same'),mime:'image/png',width:480,height:800,age_ms:0,source_id:String(++seq)}),perform:async()=>{actions++;return {};},release:async()=> 'released'};
 const h=new Harness(b,{settle_ms:0,adaptive_wait:true,post_action_timeout_ms:750});
 const o=await h.observe(),r=await h.act({observation_id:o.meta.observation_id,operation_id:'unchanged-ui-one',action:click});
 assert.equal(r.settling.reason,'no_visible_change');assert.equal(actions,1);assert(r.observation);
});
test('fill_text replaces the focused field and can submit in one action',async()=>{
 const {b,h}=fixture();b.focus=true;b.text='old';const o=await h.observe();
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'fill-focused-once',action:{kind:'fill_text',text:'query',submit:true}});
 assert.equal(b.text,'query');assert.equal(b.submitted,true);assert.equal(r.status,'awaiting_visual_verification');
 assert.throws(()=>validateAction({kind:'fill_text',text:'x',submit:'true'}));
 assert.throws(()=>validateAction({kind:'fill_text',text:'x'.repeat(121)}));
});
test('maintenance is reserved across capture, action, settle and failure cleanup',async()=>{
 const {b,h}=fixture();let held=0;const trace=[];
 b.holdMaintenance=()=>{held++;return ()=>held--;};b.ensurePointerVisible=async()=>{assert.equal(held,1);trace.push('cursor');};
 const capture=b.capture.bind(b);b.capture=async()=>{assert.equal(held,1);return capture();};
 const perform=b.perform.bind(b);b.perform=async a=>{assert.equal(held,1);trace.push('input');return perform(a);};
 const o=await h.observe();await h.act({observation_id:o.meta.observation_id,operation_id:'reserved-action',action:click});
 assert.equal(held,0);assert(trace.indexOf('input')>trace.indexOf('cursor'));assert.equal(trace.at(-1),'cursor');
});
