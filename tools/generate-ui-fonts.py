# Font glyph subset generator. Run remotely; generated C files are included in releases.
from pathlib import Path
import struct,subprocess,os,hashlib
root=Path(__file__).resolve().parents[1]
source=Path('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc')
b=source.read_bytes()
off=struct.unpack_from('>I',b,12)[0];n=struct.unpack_from('>H',b,off+4)[0]
out=bytearray(b[off:off+12]);out.extend(bytes(n*16));head=None
for i in range(n):
 tag,checksum,pos,size=struct.unpack_from('>4sIII',b,off+12+i*16)
 newpos=len(out);table=bytearray(b[pos:pos+size])
 if tag==b'head':table[8:12]=bytes(4);head=newpos
 out.extend(table);out.extend(bytes((-len(out))%4))
 checksum=sum(struct.unpack('>'+str((len(table)+3)//4)+'I',table+bytes((-len(table))%4)))&0xffffffff
 struct.pack_into('>4sIII',out,12+i*16,tag,checksum,newpos,size)
total=sum(struct.unpack('>'+str(len(out)//4)+'I',out))&0xffffffff
struct.pack_into('>I',out,head+8,(0xb1b0afba-total)&0xffffffff)
(root/'.cache/fonts').mkdir(parents=True,exist_ok=True)
(root/'.cache/fonts/wqy.ttf').write_bytes(out)
chars=set()
for name in ['device_ui.c','ui_model.c']:
 chars.update(c for c in (root/'firmware/main'/name).read_text() if ord(c)>127)
for size in [16,20,30]:
 subprocess.run([str(root/'.cache/font-tools/node_modules/.bin/lv_font_conv'),'--font',str(root/'.cache/fonts/wqy.ttf'),'-r','32-126','--symbols',''.join(sorted(chars)),'--size',str(size),'--bpp','4','--format','lvgl','--no-compress','--lv-font-name',f'cua_font_{size}','-o',str(root/f'firmware/main/fonts/cua_font_{size}.c')],check=True)
print('WenQuanYi input SHA256:',hashlib.sha256(b).hexdigest())
