"""Read-only UART identity and display telemetry probe for the delivered adapter."""
import argparse,json,pathlib,time
import serial
p=argparse.ArgumentParser()
p.add_argument('--port',required=True)
p.add_argument('--mac',required=True)
p.add_argument('--firmware',default='agent-auto-ops-0.3.4')
p.add_argument('--seconds',type=float,default=0)
p.add_argument('--output',required=True)
a=p.parse_args()
s=serial.Serial();s.port=a.port;s.baudrate=115200;s.timeout=.5;s.dtr=False;s.rts=False
evidence={'samples':[],'uart':[]}
def req(op):
 s.write((json.dumps({'v':1,'op':op,'seq':0})+'\n').encode())
 end=time.monotonic()+8
 while time.monotonic()<end:
  line=s.readline().decode('utf-8',errors='replace').strip()
  if line:evidence['uart'].append(line)
  if line.startswith('@cua '):
   r=json.loads(line[5:]);assert r.get('ok'),r
   if r.get('op')==op:return r
 raise TimeoutError(op)
try:
 s.open();s.reset_input_buffer()
 hello=req('hello')
 assert hello['mac']==a.mac and hello['firmware']==a.firmware,hello
 evidence['hello']=hello;print(json.dumps(hello),flush=True)
 start=time.monotonic()
 while True:
  state=req('ui_status');evidence['samples'].append(state);print(json.dumps(state),flush=True)
  if time.monotonic()-start>=a.seconds:break
  time.sleep(min(5,max(0,a.seconds-(time.monotonic()-start))))
 last=req('hello');assert last['boot_id']==hello['boot_id'],'Board rebooted'
 evidence['passed']=True
finally:
 if s.is_open:s.close()
 pathlib.Path(a.output).write_text(json.dumps(evidence,ensure_ascii=False,indent=2),encoding='utf-8')
