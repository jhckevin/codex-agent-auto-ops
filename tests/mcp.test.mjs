import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
test('real MCP stdio roundtrip and bundled image content',async()=>{
 const c=new Client({name:'contract-test',version:'1.0.0'});
 const dir=path.resolve('plugins/agent-auto-ops');
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,'.mcp.json'),'utf8')).mcpServers['agent-auto-ops'];
 const t=new StdioClientTransport({command:process.execPath,args:manifest.args,cwd:path.resolve(dir,manifest.cwd),env:{...process.env,AGENT_AUTO_OPS_CONFIG:'',OPENTERFACE_CUA_CONFIG:''}});
 await c.connect(t);
 try {
  const list=await c.listTools();assert.deepEqual(list.tools.map(t=>t.name),['kvm_status','kvm_observe','kvm_act','kvm_set_view_context','kvm_stop']);
  const status=await c.callTool({name:'kvm_status',arguments:{}});assert.equal(status.structuredContent.simulation,true);
  const o=await c.callTool({name:'kvm_observe',arguments:{}});
  assert.equal(o.content[1].type,'image');assert.equal(o.content[1].mimeType,'image/png');
  const r=await c.callTool({name:'kvm_act',arguments:{observation_id:o.structuredContent.observation.observation_id,operation_id:'mcp-click-0001',action:{kind:'click',x:100,y:300}}});
  assert.equal(r.structuredContent.status,'awaiting_visual_verification');assert.equal(r.content[1].type,'image');
 }finally{await c.close();}
});
