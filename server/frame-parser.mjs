import {requireThat} from './contracts.mjs';
export function jpegSize(bytes) {
  requireThat(bytes.length>4&&bytes[0]===255&&bytes[1]===216,'BAD_FRAME','JPEG required');
  for(let p=2;p+4<bytes.length;){
    requireThat(bytes[p++]===255,'BAD_FRAME','Malformed JPEG marker');
    while(bytes[p]===255)p++;
    const marker=bytes[p++];if(marker===0xd9||marker===0xda)break;
    const length=bytes.readUInt16BE(p);
    requireThat(length>=2&&p+length<=bytes.length,'BAD_FRAME','Malformed JPEG length');
    if([0xc0,0xc1,0xc2].includes(marker)){
      requireThat(length>=8,'BAD_FRAME','Malformed JPEG dimensions');
      return {width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
    }
    p+=length;
  }
  throw new Error('JPEG dimensions missing');
}
export class MultipartFrames {
  constructor(onFrame){this.buffer=Buffer.alloc(0);this.onFrame=onFrame;}
  push(chunk){
    requireThat(this.buffer.length+chunk.length<=4*1024*1024,'VIDEO_OVERFLOW','Video pipe exceeded bound');
    this.buffer=Buffer.concat([this.buffer,chunk]);
    for(;;){
      const at=this.buffer.indexOf('\r\n\r\n');if(at<0){requireThat(this.buffer.length<1024,'BAD_FRAME','Multipart header too large');return;}
      const header=this.buffer.subarray(0,at).toString('ascii'),match=/Content-length:\s*(\d+)/i.exec(header);
      requireThat(match&&/Content-type:\s*image\/jpeg/i.test(header),'BAD_FRAME','Missing MJPEG frame header');
      const length=Number(match[1]);requireThat(length>0&&length<=2*1024*1024,'BAD_FRAME','JPEG exceeds bound');
      if(this.buffer.length<at+4+length+2)return;
      const bytes=Buffer.from(this.buffer.subarray(at+4,at+4+length));
      this.buffer=this.buffer.subarray(at+4+length+2);this.onFrame(bytes);
    }
  }
}
