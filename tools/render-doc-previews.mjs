// Render the shipped viewer with synthetic data; no hardware or HID is opened.
// Usage: node tools/render-doc-previews.mjs /absolute/path/to/playwright/index.mjs [chromium-path]
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Preview} from '../server/preview.mjs';
const {chromium}=await import(pathToFileURL(path.resolve(process.argv[2])).href);
const output=path.resolve('docs/images');fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.argv[3]?{executablePath:process.argv[3]}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
let frame;
try {
 await page.setViewportSize({width:480,height:480});
 await page.setContent('<style>body{margin:0}</style>'+fs.readFileSync(path.join(output,'device-screen-demo.svg'),'utf8'));
 await page.screenshot({path:path.join(output,'device-screen-demo.png')});
 await page.setViewportSize({width:1280,height:720});
 await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
 *{box-sizing:border-box}body{margin:0;background:#172d3a;font:18px Arial,sans-serif;color:#243840}
 .desktop{height:720px;padding:64px 120px;background:radial-gradient(ellipse at 80% 10%,#31545a,transparent 65%);}
 .window{height:592px;background:#f2f5f4;border:1px solid #99b2af;border-radius:16px;box-shadow:0 24px 70px #07172166;overflow:hidden}
 .bar{height:54px;background:#e5ece9;border-bottom:1px solid #d0dcd5;padding:18px 24px;font-size:15px;color:#536a65}
 .dots{color:#9ab2a9;letter-spacing:5px;margin-right:22px}
 .body{padding:52px 62px}.eyebrow{font-size:13px;font-weight:bold;letter-spacing:2px;color:#628078}
 h1{font-size:40px;letter-spacing:-1px;margin:14px 0 15px;font-weight:600}p{line-height:1.6;color:#5b716b;margin:0}
 .row{display:flex;gap:22px;margin:38px 0 32px}.card{flex:1;border:1px solid #d4dfda;border-radius:12px;padding:22px}
 .card strong{display:block;font-size:17px;margin-bottom:11px}.status{font-size:14px;color:#426c5d}
 .button{display:inline-block;padding:13px 25px;border-radius:8px;background:#244d43;color:#fff;font-size:16px}
 .note{margin-top:28px;font-size:13px;color:#7b8d86}.badge{float:right;font-size:11px;font-weight:bold;letter-spacing:1px;color:#496558}
 </style><div class="desktop"><div class="window"><div class="bar"><span class="dots">● ● ●</span>Demo computer<span class="badge">SIMULATED DESKTOP</span></div>
 <div class="body"><div class="eyebrow">AGENT AUTO OPS</div><h1>A screen to see. A device to control.</h1><p>A sample desktop for demonstrating the viewer.<br>No external device is connected in this preview.</p>
 <div class="row"><div class="card"><strong>Video</strong><span class="status">HDMI → capture card → Codex laptop</span></div><div class="card"><strong>Keyboard &amp; mouse</strong><span class="status">Codex laptop → ESP32 → target</span></div></div>
 <div class="button">Demo input field</div><div class="note">1280 × 720 · Documentation fixture · No real device data</div></div></div></div></html>`);
 frame=await page.screenshot({type:'jpeg',quality:90});
 let language='en';
 const video={current:()=>({bytes:frame,source_id:'documentation-demo-24',age_ms:80}),status:()=>({connected:true,device:'UGREEN HDMI to USB-C · DEMO',width:1280,height:720,fps:5,frames:24,age_ms:80,source_id:'documentation-demo-24',audio:false,error:null})};
 const preview=new Preview(video,{assets:path.resolve('plugins/agent-auto-ops/web'),locale:'en'});
 await preview.start();
 preview.target=()=>({target_id:language==='en'?'Demo computer · macOS / Windows':'演示电脑 · macOS / Windows',simulation:true,hardware:{mounted:true,ready:true}});
 const events=[{action_kind:'click',label:'Click'},{action_kind:'press_key',key_chord:'Enter',label:'Enter'},{action_kind:'type_text',character_count:12,label:'Type 12 characters'}];
 events.forEach((e,i)=>{preview.publish({kind:'action',operation_id:'documentation-'+i,status:'awaiting_visual_verification',...e});preview.events.at(-1).time=new Date(Date.now()-90000+i*15000).toISOString();});
 try {
  await page.setViewportSize({width:1440,height:1000});
  for(const locale of ['en','zh-CN']){
   language=locale;
   await page.goto(preview.url+'?lang='+locale,{waitUntil:'domcontentloaded'});
   await page.locator('#image').waitFor({state:'visible'});
   await page.locator('#demoBadge').waitFor({state:'visible'});
   await page.screenshot({path:path.join(output,'viewer-'+locale+'.png'),fullPage:true});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify({screenshots:['device-screen-demo.png','viewer-en.png','viewer-zh-CN.png'],hardware_access:false,browser_errors:errors}));
 } finally {await preview.close();}
} finally {await context.close();await browser.close();}
