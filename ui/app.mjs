import {validLocale,translator,actionLabel,videoError} from './i18n.mjs';
const $=id=>document.getElementById(id);
const base=location.pathname.replace(/\/$/,'');
const localeKey='agent-auto-ops.language';
let saved=null;
try{saved=localStorage.getItem(localeKey);}catch{}
let locale=validLocale(new URLSearchParams(location.search).get('lang'))||validLocale(saved)||validLocale(document.documentElement.lang)||'en';
let t=translator(locale),lastState=null,failed=false,source=null,imageURL=null,markerEvent=null,eventSignature='',lastMarker=null,motionEvent=null,markerTimer;
const format=value=>new Intl.NumberFormat(locale).format(value);
function applyLanguage(){
 t=translator(locale);document.documentElement.lang=locale;document.title=t('pageTitle');
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n);});
 $('language').value=locale;$('language').setAttribute('aria-label',t('language'));
 $('image').alt=t('imageAlt');$('stage').setAttribute('aria-label',t('imageAlt'));
 eventSignature='';if(lastState)renderState(lastState);if(failed)renderDisconnected();
 if(motionEvent)renderMotion(motionEvent);
}
$('language').addEventListener('change',()=>{
 locale=validLocale($('language').value)||'en';
 try{localStorage.setItem(localeKey,locale);}catch{}
 // An explicit choice replaces a URL override, so reload preserves the choice.
 try{const url=new URL(location.href);if(url.searchParams.has('lang')){url.searchParams.set('lang',locale);history.replaceState(null,'',url);}}catch{}
 applyLanguage();
});
async function showImage(id){
 if(source===id||document.hidden)return;
 const r=await fetch(base+'/frame'+(source?'?after='+encodeURIComponent(source):''));
 if(r.status===204||!r.ok)return;
 const url=URL.createObjectURL(await r.blob()),old=imageURL;imageURL=url;
 $('image').onload=()=>{if(old)URL.revokeObjectURL(old);};
 $('image').src=url;$('image').hidden=false;$('placeholder').hidden=true;source=r.headers.get('X-Source-Id');
}
function renderMotion(event){
 $('motionLabel').textContent=actionLabel(event,t);
 const delta=event.delta;$('motionDelta').textContent=delta?'X '+(delta.x>=0?'+':'')+delta.x+' / Y '+(delta.y>=0?'+':'')+delta.y:'';
 const arrow=$('motionArrow');arrow.hidden=!delta;
 if(delta)arrow.style.transform='rotate('+Math.atan2(delta.y,delta.x)*180/Math.PI+'deg)';
}
function renderEvents(entries){
 const actions=entries.filter(e=>e.kind==='action'),signature=locale+JSON.stringify(actions);
 if(signature===eventSignature)return;eventSignature=signature;
 $('count').textContent=format(actions.length);$('empty').hidden=actions.length>0;
 $('events').replaceChildren(...actions.slice().reverse().map(e=>{
  const li=document.createElement('li');if(e.status==='unknown')li.className='warn';
  const row=document.createElement('div');row.className='event-head';
  const title=document.createElement('strong');title.textContent=actionLabel(e,t);
  const time=document.createElement('time');time.dateTime=e.time;time.textContent=new Date(e.time).toLocaleTimeString(locale,{hour12:false});
  row.append(title,time);const detail=document.createElement('p');
  detail.textContent=t(['started','awaiting_visual_verification','unknown'].includes(e.status)?e.status:'unknown')+(e.frame?' · '+t('frame',{value:String(e.frame).split(':').at(-1)}):'');
  li.append(row,detail);return li;
 }));
 const latest=actions.at(-1);
 if(latest&&latest.operation_id!==markerEvent&&Date.now()-Date.parse(latest.time)<5000){
  markerEvent=latest.operation_id;clearTimeout(markerTimer);
  $('marker').hidden=true;$('motion').hidden=true;lastMarker=null;motionEvent=null;
  if(latest.point){lastMarker=latest;placeMarker();}
  else{motionEvent=latest;renderMotion(latest);$('motion').hidden=false;}
  markerTimer=setTimeout(()=>{$('marker').hidden=true;$('motion').hidden=true;lastMarker=null;motionEvent=null;},5000);
 }
}
function placeMarker(){
 if(!lastMarker)return;
 const e=lastMarker,stage=$('stage'),w=e.width,h=e.height;
 if(!(w>0&&h>0))return;
 const scale=Math.min(stage.clientWidth/w,stage.clientHeight/h),marker=$('marker');
 marker.style.left=((stage.clientWidth-w*scale)/2+e.point.x*scale)+'px';
 marker.style.top=((stage.clientHeight-h*scale)/2+e.point.y*scale)+'px';marker.hidden=false;
}
new ResizeObserver(placeMarker).observe($('stage'));
function renderState(state){
 const v=state.video,tgt=state.target,live=v.connected;
 $('target').textContent=tgt.target_id||t('defaultTarget');
 $('connection').textContent=t(live?(tgt.stopped?'stopped':'connected'):'waitingVideo');
 $('connection').className='pill'+(live&&!tgt.stopped?' good':'');
 $('videoStatus').textContent=t(live?'live':'noSignal');$('videoStatus').parentElement.className='live'+(live?' good':'');
 $('dimensions').textContent=v.width?v.width+' × '+v.height+' · '+v.fps+' fps':'— × —';
 $('frameAge').textContent=v.age_ms!==null&&v.age_ms!==undefined?t('age',{value:format(Math.round(v.age_ms))}):t('waitingFrame');
 $('sequence').textContent=t('frame',{value:format(v.frames??0)});
 $('memory').textContent=t('memory',{value:format(state.memory_mib??0)});
 $('hidState').textContent=t(tgt.hardware?.mounted?(tgt.hardware?.ready?'inputReady':'usbConnected'):'usbWaiting');
 $('deviceLabel').textContent=v.device||t('notConfigured');
 $('error').hidden=live;$('errorText').textContent=live?'':videoError(v.error,t);
 $('demoBadge').hidden=!tgt.simulation;
 if(!live){$('image').hidden=true;$('placeholder').hidden=false;source=null;}
 renderEvents(state.events||[]);
}
function renderDisconnected(){
 $('connection').textContent=t('disconnected');$('connection').className='pill';
 $('videoStatus').textContent=t('disconnected');$('videoStatus').parentElement.className='live';
 $('image').hidden=true;$('placeholder').hidden=false;$('error').hidden=false;$('errorText').textContent=t('serviceOffline');source=null;
}
async function poll(){
 if(document.hidden){setTimeout(poll,1000);return;}
 try{
  const r=await fetch(base+'/state');if(!r.ok)throw Error('offline');
  lastState=await r.json();failed=false;renderState(lastState);
  if(lastState.video.connected)await showImage(lastState.video.source_id);
 }catch{failed=true;renderDisconnected();}
 finally{setTimeout(poll,200);}
}
applyLanguage();poll();
