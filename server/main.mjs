import fs from 'node:fs';
import {pluginLocale,localizeTools} from './localization.mjs';
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {Harness} from './harness.mjs';
import {Simulator} from './simulator.mjs';
import {Openterface} from './openterface.mjs';
import {EspBackend} from './esp.mjs';
import {FFmpegVideo} from './ffmpeg-video.mjs';
import {Preview} from './preview.mjs';
import {exact,requireThat} from './contracts.mjs';
const actionSchema={type:'object',properties:{kind:{type:'string',enum:['click','move','move_relative','click_current','scroll_current','scroll','press_key','type_text','fill_text','drag','wait']},x:{type:'integer'},y:{type:'integer'},dx:{type:'integer',minimum:-8192,maximum:8192},dy:{type:'integer',minimum:-8192,maximum:8192},ticks:{type:'integer'},button:{type:'string',enum:['left','right','middle']},count:{type:'integer'},key:{type:'string'},modifiers:{type:'array',items:{type:'string',enum:['Ctrl','Alt','Shift','Meta','Command','Option','Control']}},text:{type:'string',maxLength:128},submit:{type:'boolean'},path:{type:'array',minItems:2,maxItems:32,items:{type:'object',properties:{x:{type:'integer'},y:{type:'integer'}},required:['x','y'],additionalProperties:false}},duration_ms:{type:'integer'}},required:['kind'],additionalProperties:false};
const empty={type:'object',properties:{},additionalProperties:false};
const tools=[
 {name:'kvm_status',description:'Inspect the bound external target, backend, capabilities and simulation flag. No input.',inputSchema:empty,annotations:{readOnlyHint:true}},
 {name:'kvm_observe',description:'Get a fresh target image. Optional wait_for_change waits locally up to timeout_ms instead of model polling. In confirmed mobile mirror mode, automatic one-count cursor maintenance may run before capture.',inputSchema:{type:'object',properties:{wait_for_change:{type:'boolean'},timeout_ms:{type:'integer',minimum:0,maximum:5000}},additionalProperties:false},annotations:{readOnlyHint:false}},
 {name:'kvm_act',description:'Consume the latest observation and execute one intent, returning a settled image with phase timings and change diagnostics. move_relative accepts up to +/-8192 HID counts and is split automatically. fill_text replaces a focused field and optionally submits (submit=true, max120 ASCII). operation_id is unique and deduplicated. Coordinates are pixels of that observation. click_current/scroll_current use the standard relative mouse at its visible current cursor location; observe its cursor before using them. ticks > 0 scrolls up. Text is printable US ASCII. Never retry an unknown outcome; observe first.',inputSchema:{type:'object',properties:{observation_id:{type:'string'},operation_id:{type:'string',minLength:8,maxLength:80},action:actionSchema},required:['observation_id','operation_id','action'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:true}},
 {name:'kvm_set_view_context',description:'Classify the currently observed display as mirror, dex, extended, desktop or unknown. This labels the view; it does not change the target OS display settings. Confirmed Android/iPadOS mirror enables automatic cursor maintenance; other modes disable it.',inputSchema:{type:'object',properties:{observation_id:{type:'string'},display_mode:{type:'string',enum:['mirror','dex','extended','desktop','unknown']}},required:['observation_id','display_mode'],additionalProperties:false},annotations:{readOnlyHint:false}},
 {name:'kvm_stop',description:'Stop this session and release HID if supported. Reopening requires explicitly restarting the plugin process.',inputSchema:empty,annotations:{readOnlyHint:false,idempotentHint:true}}
];
function response(value) {
  const o=value?.frame?value:value?.observation;
  const metadata=o?{...(value.frame?{}:value),observation:o.meta}:value;
  if(metadata.observation?.frame)delete metadata.observation.frame;
  const content=[{type:'text',text:JSON.stringify(metadata)}];
  if(o)content.push({type:'image',data:o.frame.bytes.toString('base64'),mimeType:o.frame.mime});
  return {content,isError:value?.status==='unknown',structuredContent:metadata};
}
async function main() {
  const locale=pluginLocale(__dirname);
  let config={backend:'simulator',target_id:'android-simulator'};
  if((process.env.AGENT_AUTO_OPS_CONFIG||process.env.OPENTERFACE_CUA_CONFIG)) config=JSON.parse(fs.readFileSync((process.env.AGENT_AUTO_OPS_CONFIG||process.env.OPENTERFACE_CUA_CONFIG),'utf8'));
  requireThat(['simulator','openterface','esp32'].includes(config.backend),'CONFIG','backend');
  requireThat(!config.video||config.video.driver==='ffmpeg','CONFIG','Use the background ffmpeg capture driver');
  const captureVideo=config.video?new FFmpegVideo(config.video):null;
  const preview=captureVideo?new Preview(captureVideo,{...config.preview,locale}):null;
  if(preview){config.preview_url=await preview.start();config.onEvent=e=>preview.publish(e);console.error('Agent Auto Ops preview: '+config.preview_url);}
  const backend=config.backend==='simulator'?new Simulator(config.simulator):config.backend==='openterface'?new Openterface(config.openterface):new EspBackend(config,{video:captureVideo});
  try { await backend.connect?.(); } catch (error) { await Promise.allSettled([backend.close?.(),preview?.close()]); throw error; }
  const h=new Harness(backend,config);if(preview)preview.target=()=>h.status();
  const server=new Server({name:'agent-auto-ops',version:'0.7.0'},{capabilities:{tools:{}}});
  server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:localizeTools(tools,locale)}));
  server.setRequestHandler(CallToolRequestSchema,async({params})=>{
    try {
      const a=params.arguments??{};
      exact(a,params.name==='kvm_act'?['observation_id','operation_id','action']:params.name==='kvm_observe'?['wait_for_change','timeout_ms']:params.name==='kvm_set_view_context'?['observation_id','display_mode']:[]);
      if(params.name==='kvm_observe'){
        requireThat(a.wait_for_change===undefined||typeof a.wait_for_change==='boolean','INVALID_ARGUMENT','wait_for_change');
        requireThat(a.timeout_ms===undefined||(Number.isInteger(a.timeout_ms)&&a.timeout_ms>=0&&a.timeout_ms<=5000),'INVALID_ARGUMENT','timeout_ms');
      }
      if(params.name==='kvm_status')return response(h.status());
      if(params.name==='kvm_observe')return response(await h.observe(a));
      if(params.name==='kvm_act')return response(await h.act(a));
      if(params.name==='kvm_set_view_context')return response(await h.setViewContext(a));
      if(params.name==='kvm_stop')return response(await h.stop());
      throw new Error('Unknown tool');
    }catch(e){return {isError:true,content:[{type:'text',text:JSON.stringify({code:e.code??'ERROR',message:e.message})}]};}
  });
  let closing=false;
  async function close(){if(closing)return;closing=true;try{await h.stop();}catch(e){console.error(e.message);}finally{await Promise.allSettled([backend.close?.(),preview?.close()]);process.exit(0);}}
  process.on('SIGTERM',close);process.on('SIGINT',close);process.stdin.on('end',close);
  await server.connect(new StdioServerTransport());
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
