import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {messages,validLocale,translator,actionLabel,videoError} from '../ui/i18n.mjs';
import {pluginLocale,localizeTools} from '../server/localization.mjs';
import {Preview} from '../server/preview.mjs';
test('Chinese and English cover the same copy and parameter placeholders',()=>{
 assert.deepEqual(Object.keys(messages.en).sort(),Object.keys(messages['zh-CN']).sort());
 for(const key of Object.keys(messages.en)){
  const placeholders=s=>[...s.matchAll(/\{\w+\}/g)].map(x=>x[0]).sort();
  assert.deepEqual(placeholders(messages.en[key]),placeholders(messages['zh-CN'][key]));
 }
 assert.equal(validLocale('invalid'),null);
 assert.equal(translator('en')('age',{value:'125'}),'Frame age 125 ms');
});
test('historical and structured events translate without showing typed content',()=>{
 const en=translator('en'),zh=translator('zh-CN');
 assert.equal(actionLabel({label:'输入 12 个字符'},en),'Type 12 characters');
 assert.equal(actionLabel({label:'点击'},en),'Click');
 assert.equal(actionLabel({action_kind:'fill_text',character_count:12,label:'输入 12 个字符',text:'private'},en),'Fill 12 characters');
 assert.equal(actionLabel({action_kind:'press_key',key_chord:'Command + Enter'},zh),'Command + Enter');
 assert.equal(videoError('Video process exited',zh),'采集已暂停，请检查采集卡连接。');
});
test('package locale defaults and explicit override remain isolated',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ops-locale-'));
 try{
  fs.mkdirSync(path.join(root,'dist'));assert.equal(pluginLocale(path.join(root,'dist'),{}),'en');fs.writeFileSync(path.join(root,'locale.json'),'{"locale":"en"}');
  assert.equal(pluginLocale(path.join(root,'dist'),{}),'en');
  assert.equal(pluginLocale(path.join(root,'dist'),{AGENT_AUTO_OPS_LOCALE:'zh-CN'}),'zh-CN');
  assert.equal(pluginLocale(path.join(root,'dist'),{AGENT_AUTO_OPS_LOCALE:'invalid'}),'en');
  const tool={name:'kvm_status',description:'Inspect',inputSchema:{type:'object'}};
  assert.match(localizeTools([tool],'zh-CN')[0].description,/查看/);
  assert.equal(localizeTools([tool],'en')[0].description,'Inspect');
  assert.deepEqual(tool.description,'Inspect');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('English preview serves packaged assets under the original read-only boundary',async()=>{
 const video={status:()=>({connected:false,error:'Video process exited'}),current:()=>null};
 const p=new Preview(video,{assets:path.resolve('plugins/agent-auto-ops/web'),locale:'en'});
 await p.start();
 try{
  const page=await fetch(p.url);assert.equal(page.status,200);
  assert.match(page.headers.get('content-security-policy'),/script-src 'self'/);
  const html=await page.text();assert.match(html,/<html lang="en">/);assert.match(html,/id="language"/);assert.doesNotMatch(html,/>A<span>↗/);
  const js=await fetch(p.url+'app.js');assert.equal(js.status,200);
  assert.equal((await fetch(p.url+'state',{method:'POST'})).status,405);
  assert.equal((await fetch(p.url+'state',{headers:{Origin:'https://example.com'}})).status,403);
  assert.equal((await fetch(p.origin+'/state')).status,404);
 }finally{await p.close();}
});
