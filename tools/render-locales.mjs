import fs from 'node:fs';
import {messages} from '../ui/i18n.mjs';
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
for(const [name,locale] of [['agent-auto-ops','en'],['agent-auto-ops-zh','zh-CN']]){
 const file='plugins/'+name+'/web/index.html',m=messages[locale];
 let html=fs.readFileSync(file,'utf8');
 html=html.replace(/(<[^>]+data-i18n="([^"]+)"[^>]*>)[^<]*/g,(_,tag,key)=>{if(!(key in m))throw new Error(key);return tag+escape(m[key]);});
 html=html.replace(/<title>[^<]*<\/title>/,'<title>'+escape(m.pageTitle)+'</title>');
 html=html.replace(/(<select id="language" aria-label=")[^"]*/,'$1'+escape(m.language));
 html=html.replace(/(<div class="stage" id="stage" aria-label=")[^"]*/,'$1'+escape(m.imageAlt));
 html=html.replace(/(<img id="image" alt=")[^"]*/,'$1'+escape(m.imageAlt));
 html=html.replace(/<option value="(en|zh-CN)"(?: selected)?>/g,(_,value)=>'<option value="'+value+'"'+(value===locale?' selected':'')+'>');
 fs.writeFileSync(file,html);
}
