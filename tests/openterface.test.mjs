import test from 'node:test';
import assert from 'node:assert/strict';
import {Openterface} from '../server/openterface.mjs';
import {Harness} from '../server/harness.mjs';
import {Simulator} from '../server/simulator.mjs';
test('Openterface uses Qt modifier flags and explicit auto release',async()=>{
 const b=new Openterface({});const calls=[];
 b.call=async(name,args)=>{calls.push({name,args});return {};};
 await b.perform({kind:'press_key',key:'a',modifiers:['Ctrl','Shift']});
 assert.deepEqual(calls[0],{name:'keyboard_press_key',args:{key:'a',modifiers:0x06000000,autoRelease:true}});
});
test('upstream metadata required and reported age includes roundtrip',async()=>{
 const b=new Openterface({}),content=[{type:'image',mimeType:'image/jpeg',data:'YWJj'}];
 b.call=async()=>({content});
 await assert.rejects(b.capture(),{code:'FRAME_METADATA_REQUIRED'});
 b.call=async()=>({content:[{type:'text',text:JSON.stringify({frame:{width:1920,height:1080,sequence:'123',age_ms:10}})},...content]});
 const f=await b.capture();assert.equal(f.source_id,'123');assert.equal(f.width,1920);assert.ok(f.age_ms>=10);
});
test('frozen sequence fails after action despite zero reported age',async()=>{
 const b=new Simulator(),capture=b.capture.bind(b);b.capture=async()=>({...await capture(),source_id:'frozen'});
 const h=new Harness(b,{settle_ms:0}),o=await h.observe();
 const r=await h.act({observation_id:o.meta.observation_id,operation_id:'frozen-0001',action:{kind:'wait',duration_ms:0}});
 assert.equal(r.status,'unknown');assert.equal(r.error_code,'NO_NEW_FRAME');assert.equal(h.latest,null);
});
test('expired observation rejected without input',async()=>{
 const b=new Simulator(),h=new Harness(b),o=await h.observe();h.latest.received-=40000;
 await assert.rejects(h.act({observation_id:o.meta.observation_id,operation_id:'expired-0001',action:{kind:'click',x:1,y:2}}),{code:'EXPIRED_OBSERVATION'});
 assert.equal(b.events.length,0);
});
