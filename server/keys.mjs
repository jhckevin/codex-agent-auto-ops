import {requireThat} from './contracts.mjs';
const special={Enter:40,Return:40,Escape:41,Backspace:42,Tab:43,Space:44,Insert:73,Home:74,PageUp:75,Delete:76,End:77,PageDown:78,Right:79,Left:80,Down:81,Up:82};
export function keyStroke(key,modifiers=[]) {
  let usage=special[key];
  if(/^[a-z]$/i.test(key))usage=key.toLowerCase().charCodeAt(0)-97+4;
  if(/^[1-9]$/.test(key))usage=Number(key)+29;
  if(key==='0')usage=39;
  if(/^F(?:[1-9]|1[0-2])$/.test(key))usage=57+Number(key.slice(1));
  requireThat(usage!==undefined,'UNSUPPORTED_KEY','unsupported key: '+key);
  const mod=modifiers.reduce((a,k)=>a|({Ctrl:1,Shift:2,Alt:4,Meta:8,Command:8,Option:4,Control:1}[k]??0),0);
  return {usage,mod};
}
export function asciiStrokes(text) {
  const punct=String.fromCharCode(32,45,61,91,93,92,59,39,96,44,46,47);
  const codes=[44,45,46,47,48,49,51,52,53,54,55,56];
  const shifted="!@#$%^&*()_+{}|:\"~<>?";
  const shiftCodes=[30,31,32,33,34,35,36,37,38,39,45,46,47,48,49,51,52,53,54,55,56];
  return [...text].map(c=>{
    if(/[a-z0-9]/.test(c))return keyStroke(c);
    if(/[A-Z]/.test(c))return keyStroke(c,['Shift']);
    const i=punct.indexOf(c);if(i>=0)return {usage:codes[i],mod:0};
    const j=shifted.indexOf(c);requireThat(j>=0,'UNSUPPORTED_TEXT','unsupported ASCII');return {usage:shiftCodes[j],mod:2};
  });
}
