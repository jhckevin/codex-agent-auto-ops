import fs from 'node:fs';
import path from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
async function main(){
const [plugin,config,output]=process.argv.slice(2);
fs.mkdirSync(output,{recursive:true});
const client=new Client({name:'agent-auto-ops-hardware-check',version:'0.6.0'});
const transport=new StdioClientTransport({command:process.execPath,args:['dist/server.cjs'],cwd:plugin,env:{...process.env,AGENT_AUTO_OPS_CONFIG:config},stderr:'inherit'});
await client.connect(transport);
const status=await client.callTool({name:'kvm_status',arguments:{}});
fs.writeFileSync(path.join(output,'session.json'),JSON.stringify(status.structuredContent,null,2));
let closing=false;
let activeRequest=null;
async function close(){if(closing)return;closing=true;clearInterval(timer);watcher.close();await client.close();process.exit(0);}
let busy=false;
async function consume(){
 if(closing||busy)return;const input=path.join(output,'request.json');if(!fs.existsSync(input))return;
 busy=true;
 try{
 const q=activeRequest=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''));fs.unlinkSync(input);
 if(!/^kvm_(?:status|observe|act|stop|set_view_context)$/.test(q.name))throw Error('Unsupported tool');
 const r=await client.callTool({name:q.name,arguments:q.arguments??{}},undefined,{timeout:20000});
 const image=r.content?.find(c=>c.type==='image');
 const imagePath=image?path.join(output,'latest.'+(image.mimeType==='image/png'?'png':'jpg')):undefined;
 if(image)fs.writeFileSync(imagePath,Buffer.from(image.data,'base64'));
 const result={id:q.id,isError:r.isError??false,image_path:imagePath,...r.structuredContent,text:r.isError?r.content?.filter(c=>c.type==='text').map(c=>c.text):undefined};
 fs.writeFileSync(path.join(output,'response.json'),JSON.stringify(result,null,2));
 const log=path.join(output,'events.jsonl');if(fs.existsSync(log)&&fs.statSync(log).size>4*1024*1024){const previous=path.join(output,'events.1.jsonl');if(fs.existsSync(previous))fs.unlinkSync(previous);fs.renameSync(log,previous);}
 fs.appendFileSync(log,JSON.stringify({at:new Date().toISOString(),...result})+'\n');
 if(q.name==='kvm_stop')await close();
 }catch(e){fs.writeFileSync(path.join(output,'response.json'),JSON.stringify({id:activeRequest?.id,isError:true,error:e.message}));}
 finally{busy=false;activeRequest=null;}
}
const watcher=fs.watch(output,(_event,name)=>{if(String(name)==='request.json')consume();});
const timer=setInterval(consume,1000);consume();
process.on('SIGTERM',close);process.on('SIGINT',close);

}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
