import {PNG} from 'pngjs';
export class Simulator {
  constructor({width=480,height=800}={}) {
    this.name='android-fixture'; this.simulation=true; this.width=width;this.height=height;this.seq=0;this.events=[];
    this.coordinateMax=32767; this.checked=false;this.focus=false;this.text='';
    this.capabilities={actions:['click','move','move_relative','scroll','press_key','type_text','fill_text','drag','wait'],unicode:false,boot_relative:true,release:true};
  }
  async capture() {
    const p=new PNG({width:this.width,height:this.height});
    const rect=(x,y,w,h,color)=>{for(let j=y;j<Math.min(y+h,p.height);j++)for(let i=x;i<Math.min(x+w,p.width);i++){const o=(j*p.width+i)*4;p.data[o]=color[0];p.data[o+1]=color[1];p.data[o+2]=color[2];p.data[o+3]=255;}};
    rect(0,0,p.width,p.height,[20,29,45]);rect(25,60,p.width-50,40,[64,87,123]);
    rect(35,140,p.width-70,60,this.focus?[35,126,150]:[70,81,100]);
    rect(40,260,p.width-80,90,this.checked?[45,180,115]:[75,105,210]);
    for(let i=0;i<Math.min(this.text.length,30);i++)rect(50+i*11,160,6,20,[225,235,245]);
    rect(80,p.height-30,p.width-160,5,[155,165,175]);
    return {bytes:PNG.sync.write(p),mime:'image/png',width:p.width,height:p.height,source_id:String(++this.seq),age_ms:0};
  }
  async perform(a) {
    this.events.push(a);
    if(a.kind==='click') {const y=a.y/32767*(this.height-1);this.focus=y>=140&&y<=200;if(y>=260&&y<=350)this.checked=!this.checked;}
    if(a.kind==='type_text'&&this.focus)this.text+=a.text;
    if(a.kind==='fill_text'&&this.focus){this.text=a.text;this.submitted=!!a.submit;}
    return {delivery:'simulated'};
  }
  async release() {return 'simulated_release';}
  async close() {}
}
