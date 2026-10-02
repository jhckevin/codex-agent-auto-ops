import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const version=JSON.parse(fs.readFileSync('package.json','utf8')).version;
for(const [identifier,locale] of [['agent-auto-ops','en'],['agent-auto-ops-zh','zh-CN']]){
 test(identifier+' distribution runs without parent node_modules and selects its language',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agent-auto-ops-package-')),client=new Client({name:'zip-test',version:'1.0.0'});
  try{
   execFileSync('python3',['-m','zipfile','-e',path.resolve('artifacts/release-'+version+'/'+identifier+'-'+version+'.zip'),dir]);
   const spec=JSON.parse(fs.readFileSync(path.join(dir,'.mcp.json'),'utf8')).mcpServers[identifier];
   assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'locale.json'),'utf8')).locale,locale);
   assert.match(fs.readFileSync(path.join(dir,'web/index.html'),'utf8'),new RegExp('<html lang="'+locale+'">'));
   const manifest=JSON.parse(fs.readFileSync(path.join(dir,'.codex-plugin/plugin.json'),'utf8'));
   assert.equal(manifest.name,identifier);assert(fs.existsSync(path.join(dir,manifest.interface.logo)));
   const transport=new StdioClientTransport({command:process.execPath,args:spec.args,cwd:path.resolve(dir,spec.cwd),env:{PATH:process.env.PATH,AGENT_AUTO_OPS_CONFIG:'',OPENTERFACE_CUA_CONFIG:'',AGENT_AUTO_OPS_LOCALE:'',NODE_PATH:''}});
   await client.connect(transport);
   const tools=await client.listTools();
   assert.match(tools.tools[0].description,locale==='en'?/Inspect/:/查看/);
   const r=await client.callTool({name:'kvm_observe',arguments:{}});
   assert.equal(r.content[1].type,'image');assert.equal(r.structuredContent.observation.simulation,true);
  }finally{await client.close();fs.rmSync(dir,{recursive:true,force:true});}
 });
}
