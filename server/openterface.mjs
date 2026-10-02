import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {requireThat} from './contracts.mjs';
export class Openterface {
  constructor(config) {
    this.config=config;this.name='openterface-qt';this.coordinateMax=4096;
    this.capabilities={actions:['click','move','move_relative','scroll','press_key','type_text','wait'],unicode:false,release:false};
  }
  async connect() {
    requireThat(this.config.command && Array.isArray(this.config.args),'CONFIG','openterface command and args required');
    this.client=new Client({name:'agent-auto-ops',version:'0.3.0'});
    this.transport=new StdioClientTransport({command:this.config.command,args:this.config.args,stderr:'inherit'});
    await this.client.connect(this.transport);
  }
  async call(name,args) {
    const r=await this.client.callTool({name,arguments:args},undefined,{timeout:15000});
    requireThat(!r.isError,'OPENTERFACE_ERROR',(r.content??[]).filter(x=>x.type==='text').map(x=>x.text).join('\n'));
    return r;
  }
  async capture() {
    const start=performance.now();
    const r=await this.call('capture_screen',{quality:90});
    const image=r.content?.find(x=>x.type==='image');
    requireThat(image,'NO_FRAME','Openterface did not return an MCP image');
    let meta=r.structuredContent?.frame;
    for(const c of r.content??[])if(c.type==='text'){try{meta=JSON.parse(c.text).frame??meta;}catch{}}
    requireThat(meta?.width&&meta?.height,'FRAME_METADATA_REQUIRED','Install the supplied Openterface frame metadata patch before hardware control');
    return {bytes:Buffer.from(image.data,'base64'),mime:image.mimeType,width:meta.width,height:meta.height,
      source_id:meta.sequence===undefined?null:String(meta.sequence),
      age_ms:typeof meta.age_ms==='number'?meta.age_ms+performance.now()-start:null};
  }
  validateKey(a) {
    requireThat(/^(?:[A-Za-z0-9]|F(?:[1-9]|1[0-2])|Enter|Return|Escape|Tab|Backspace|Delete|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert)$/.test(a.key),'UNSUPPORTED_KEY','unsupported key name');
  }
  async perform(a) {
    switch(a.kind) {
      case 'click': await this.call('mouse_click',{x:a.x,y:a.y,button:a.button??'left',count:a.count??1});break;
      case 'move': await this.call('mouse_move_absolute',{x:a.x,y:a.y});break;
      case 'move_relative': await this.call('mouse_move_relative',{dx:a.dx,dy:a.dy});break;
      case 'scroll':
        await this.call('mouse_move_absolute',{x:a.x,y:a.y});
        if(a.ticks)await this.call('mouse_scroll',{direction:a.ticks>0?'up':'down',lines:Math.abs(a.ticks)});break;
      case 'press_key': await this.call('keyboard_press_key',{key:a.key,modifiers:(a.modifiers??[]).reduce((v,m)=>v|({Ctrl:0x04000000,Shift:0x02000000,Alt:0x08000000,Meta:0x10000000,Command:0x10000000,Option:0x08000000,Control:0x04000000}[m]),0),autoRelease:true});break;
      case 'type_text': await this.call('keyboard_type_text',{text:a.text});break;
      default: throw new Error('Unsupported Openterface action');
    }
    return {delivery:'queued_by_openterface'};
  }
  async release() {return 'not_supported_by_upstream_mcp';}
  async close() {await this.client?.close();}
}
