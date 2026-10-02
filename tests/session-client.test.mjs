import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('packaged fallback correlates commands and returns one image without shell polling',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'agent-session-')),plugin=path.resolve('plugins/agent-auto-ops');
 const config=path.join(dir,'simulator.json');await fs.writeFile(config,JSON.stringify({backend:'simulator',settle_ms:0}));
 const worker=spawn(process.execPath,[path.join(plugin,'scripts/session-worker.cjs'),plugin,config,dir],{stdio:['ignore','ignore','pipe']});
 let errors='';worker.stderr.on('data',d=>{errors=(errors+d).slice(-4096);});
 const command=async(...args)=>JSON.parse((await run(process.execPath,[path.join(plugin,'scripts/session-command.cjs'),dir,...args],{timeout:8000})).stdout);
 try{
  let ready=false;for(let i=0;i<100;i++){try{await fs.access(path.join(dir,'session.json'));ready=true;break;}catch{await sleep(30);}}
  assert(ready,errors);
  const o=await command('observe');assert.equal(o.isError,false);assert(o.image_path.endsWith('latest.png'));assert((await fs.stat(o.image_path)).size>100);
  const key=await command('key','Tab','--observation',o.observation.observation_id);assert.equal(key.status,'awaiting_visual_verification');
  assert.equal(key.input_observation_id,o.observation.observation_id);assert(key.image_path);
  const stopped=await command('stop');assert.equal(stopped.stopped,true);
 }finally{worker.kill();await fs.rm(dir,{recursive:true,force:true});}
});
