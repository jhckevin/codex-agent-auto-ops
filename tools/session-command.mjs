import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
async function main(){
const [root,verb,...argv]=process.argv.slice(2);
if(!root||!verb)throw Error('Usage: session-command.cjs SESSION_DIRECTORY observe|status|move|click|key|type|fill|scroll|context|stop [arguments]');
const dir=path.resolve(root),flag=name=>{const i=argv.indexOf(name);return i<0?undefined:argv[i+1];};
const num=(v,name)=>{const n=Number(v);if(!Number.isInteger(n))throw Error('Integer required: '+name);return n;};
let action,name,args={};
const texts=()=>flag('--text-file')?fs.readFileSync(path.resolve(flag('--text-file')),'utf8'):argv[0];
if(verb==='move')action={kind:'move_relative',dx:num(argv[0],'dx'),dy:num(argv[1],'dy')};
else if(verb==='click')action={kind:'click_current',button:argv[0]??'left',count:1};
else if(verb==='key')action={kind:'press_key',key:argv[0],modifiers:flag('--mods')?.split(',')??[]};
else if(verb==='type'||verb==='fill')action={kind:verb==='fill'?'fill_text':'type_text',text:texts(),...(verb==='fill'?{submit:argv.includes('--submit')}:{})};
else if(verb==='scroll')action={kind:'scroll_current',ticks:num(argv[0],'ticks')};
else if(verb==='context'){name='kvm_set_view_context';args={display_mode:argv[0],observation_id:flag('--observation')};}
else if(['observe','status','stop'].includes(verb)){name='kvm_'+verb;if(verb==='observe'&&argv.includes('--wait'))args={wait_for_change:true,timeout_ms:1800};}
else throw Error('Unknown command');
if(action){name='kvm_act';args={action,observation_id:flag('--observation'),operation_id:flag('--operation')??randomUUID()};}
if((action||verb==='context')&&!args.observation_id)throw Error('Pass --observation from the image you inspected; latest is never selected implicitly');
const id=randomUUID(),lock=path.join(dir,'command.lock'),request=path.join(dir,'request.json');
if(fs.existsSync(lock)){
  const prior=JSON.parse(fs.readFileSync(lock,'utf8'));let alive=true;try{process.kill(prior.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;}
  let reply;try{reply=JSON.parse(fs.readFileSync(path.join(dir,'response.json'),'utf8'));}catch{}
  if(!alive&&!fs.existsSync(request)&&reply?.id===prior.id)fs.unlinkSync(lock);
  else throw Error('BUSY or unresolved outcome: the earlier command still owns this session');
}
const fd=fs.openSync(lock,'wx');fs.writeFileSync(fd,JSON.stringify({pid:process.pid,id}));fs.closeSync(fd);
const temp=path.join(dir,'request-'+id+'.tmp');
let watcher,timer,wake,completed=false,submitted=false;
try {
  if(fs.existsSync(request))throw Error('BUSY: a command is already pending');
  const response=path.join(dir,'response.json');
  const result=await new Promise((resolve,reject)=>{
    const check=()=>{try{const r=JSON.parse(fs.readFileSync(response,'utf8'));if(r.id===id)resolve(r);}catch{}};
    watcher=fs.watch(dir,(_event,file)=>{if(String(file)==='response.json')check();});
    // Short fallback handles filesystem event coalescing, without a model-side sleep.
    wake=setInterval(check,100);timer=setTimeout(()=>reject(Error('Outcome unknown: command timed out; observe before any retry')),22000);
    submitted=true;fs.writeFileSync(temp,JSON.stringify({id,name,arguments:args}));fs.renameSync(temp,request);check();
  });
  completed=true;
  const output={...result,text:result.isError?result.text:undefined};
  process.stdout.write(JSON.stringify(output)+'\n');
  if(result.isError)process.exitCode=1;
} finally {
  watcher?.close();clearTimeout(timer);clearInterval(wake);
  if(fs.existsSync(temp))fs.unlinkSync(temp);
  // On timeout keep the lock until the user inspects the pending outcome; never
  // overwrite an in-flight action with a second mutation.
  if(completed||!submitted)fs.unlinkSync(lock);
}

}
main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
