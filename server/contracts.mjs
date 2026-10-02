export class CuaError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function requireThat(test, code, text) { if (!test) throw new CuaError(code, text); }
export function integer(value, lo, hi, name) {
  requireThat(Number.isInteger(value) && value >= lo && value <= hi, 'INVALID_ARGUMENT', name + ' out of range');
  return value;
}
export function exact(obj, keys) {
  requireThat(obj && typeof obj === 'object' && !Array.isArray(obj), 'INVALID_ARGUMENT', 'object required');
  for (const key of Object.keys(obj)) requireThat(keys.includes(key), 'INVALID_ARGUMENT', 'unknown field: ' + key);
}
export function validateAction(a) {
  const fields = {click:['kind','x','y','button','count'],move:['kind','x','y'],
    click_current:['kind','button','count'],scroll_current:['kind','ticks'],move_relative:['kind','dx','dy'],scroll:['kind','x','y','ticks'],
    press_key:['kind','key','modifiers'],type_text:['kind','text'],fill_text:['kind','text','submit'],
    drag:['kind','path','duration_ms'],wait:['kind','duration_ms']};
  requireThat(a && Object.hasOwn(fields, a.kind), 'INVALID_ARGUMENT','unsupported action');
  exact(a, fields[a.kind]);
  const point = p => { exact(p,['x','y']); integer(p.x,0,16383,'x'); integer(p.y,0,16383,'y'); };
  if (['click','move','scroll'].includes(a.kind)) point({x:a.x,y:a.y});
  if (['click','click_current'].includes(a.kind)) {
    requireThat(['left','right','middle'].includes(a.button ?? 'left'),'INVALID_ARGUMENT','button');
    integer(a.count ?? 1,1,2,'count');
  }
  if (a.kind === 'move_relative') { integer(a.dx,-8192,8192,'dx'); integer(a.dy,-8192,8192,'dy'); }
  if (['scroll','scroll_current'].includes(a.kind)) integer(a.ticks,-10,10,'ticks');
  if (a.kind === 'press_key') {
    requireThat(typeof a.key === 'string' && /^[A-Za-z0-9_]{1,20}$/.test(a.key),'INVALID_ARGUMENT','key name');
    const mods=a.modifiers ?? [];
    requireThat(Array.isArray(mods)&&mods.length<=4&&new Set(mods).size===mods.length&&mods.every(m=>['Ctrl','Alt','Shift','Meta','Command','Option','Control'].includes(m)),'INVALID_ARGUMENT','modifiers');
  }
  if (a.kind === 'fill_text') { requireThat(a.submit===undefined||typeof a.submit==='boolean','INVALID_ARGUMENT','submit must be boolean'); requireThat(typeof a.text==='string'&&a.text.length<=120,'INVALID_ARGUMENT','fill_text supports at most 120 characters'); }
  if (['type_text','fill_text'].includes(a.kind)) requireThat(typeof a.text==='string' && /^[\x20-\x7e]{1,128}$/.test(a.text),'UNSUPPORTED_TEXT','US ASCII text only; controls use press_key');
  if (a.kind === 'drag') {
    requireThat(Array.isArray(a.path)&&a.path.length>=2&&a.path.length<=32,'INVALID_ARGUMENT','drag path needs 2..32 points');
    a.path.forEach(point); integer(a.duration_ms ?? 300,50,1500,'duration_ms');
  }
  if (a.kind === 'wait') integer(a.duration_ms,0,2000,'duration_ms');
  return a;
}
export function geometry(frame, viewport) {
  const v=viewport ?? {x:0,y:0,width:frame.width,height:frame.height};
  exact(v,['x','y','width','height']);
  integer(frame.width,2,16384,'frame width'); integer(frame.height,2,16384,'frame height');
  integer(v.x,0,frame.width-2,'viewport x'); integer(v.y,0,frame.height-2,'viewport y');
  integer(v.width,2,frame.width-v.x,'viewport width'); integer(v.height,2,frame.height-v.y,'viewport height');
  return v;
}
export function toHid(x,y,v,max=32767,rotation=0) {
  requireThat(x>=v.x&&x<v.x+v.width&&y>=v.y&&y<v.y+v.height,'OUTSIDE_VIEWPORT','coordinate outside active picture');
  let u=(x-v.x)/(v.width-1), w=(y-v.y)/(v.height-1);
  requireThat([0,90,180,270].includes(rotation),'INVALID_ARGUMENT','rotation');
  if(rotation===90) [u,w]=[w,1-u]; else if(rotation===180) [u,w]=[1-u,1-w]; else if(rotation===270) [u,w]=[1-w,u];
  return {x:Math.round(u*max),y:Math.round(w*max)};
}
export function mapAction(a,v,max,rotation) {
  if(a.kind==='drag') return {...a,path:a.path.map(p=>toHid(p.x,p.y,v,max,rotation))};
  return Object.hasOwn(a,'x')?{...a,...toHid(a.x,a.y,v,max,rotation)}:{...a};
}
export const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
