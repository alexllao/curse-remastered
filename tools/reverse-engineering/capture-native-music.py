from pathlib import Path
import subprocess,os,socket,time,json,re,hashlib,shutil,argparse
base=Path(os.environ['CURSE_CAPTURE_WORK']);root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser();parser.add_argument('--track',type=int,default=1);parser.add_argument('--seconds',type=float,default=24);args=parser.parse_args()
resource={1:0,2:64,3:3,4:15,5:73}[args.track]
run=base/f'rs{args.track}';run.mkdir(exist_ok=True);captures=run/'captures';captures.mkdir(exist_ok=True)
game=run/'game';game.mkdir(exist_ok=True)
for name in ['CURSE.EXE','SETUP.EXE','CURSE.CFG']:shutil.copy2(root/'original'/name,game/name)
shutil.copytree(root/'original/DATA',game/'DATA',dirs_exist_ok=True)
data=bytearray((game/'CURSE.CFG').read_bytes());data[8]=4;data[9]=0;data[10]=0;(game/'CURSE.CFG').write_bytes(data)
assert hashlib.sha256((game/'CURSE.EXE').read_bytes()).hexdigest()=='f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d'
port=18980+args.track
conf=run/'capture.conf'
conf.write_text(f'''[sdl]
fullscreen=false
output=surface
autolock=false
priority=normal,normal
[dosbox]
machine=svga_s3
memsize=16
captures={captures.as_posix()}
mcp_server={port}
show recorded filename=false
disable graphical splash=true
[cpu]
core=normal
cycles=fixed 12000
[mixer]
nosound=true
rate=48000
[midi]
mpu401=intelligent
mididevice=mt32
mt32.romdir={(root/'reports/audio/roms').as_posix()}
mt32.model=mt32
[sblaster]
sbtype=none
[autoexec]
mount c "{game.as_posix()}"
c:
addkey p3000 l50 enter
DX-CAPTURE /A /-D CURSE.EXE
exit
''',encoding='utf-8')
server=socket.socket();server.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);server.bind(('127.0.0.1',port));server.listen(1);server.settimeout(12)
log=open(run/'process.log','wb');env=dict(os.environ,SDL_VIDEODRIVER='dummy',SDL_AUDIODRIVER='dummy')
startup=subprocess.STARTUPINFO();startup.dwFlags|=subprocess.STARTF_USESHOWWINDOW;startup.wShowWindow=0
exe=base/'runtime/mingw-build/mingw-sdl2/dosbox-capture.exe'
process=subprocess.Popen([str(exe),'-conf',str(conf),'-exit','-nomenu','-noconsole'],cwd=run,env=env,stdout=log,stderr=log,startupinfo=startup,creationflags=subprocess.CREATE_NO_WINDOW)
events=[]
print(json.dumps({'track':args.track,'pid':process.pid,'phase':'starting'}),flush=True)
try:
 conn,address=server.accept();conn.settimeout(8);stream=conn.makefile('rwb',buffering=0)
 def command(text,quiet=False):
  command.counter+=1;ident=str(command.counter);stream.write(f'REQ {ident} {text}\n'.encode());lines=[]
  while True:
   raw=stream.readline()
   if not raw:raise EOFError('Emulator closed connection')
   line=raw.decode(errors='replace').strip()
   if not line:continue
   lines.append(line)
   if line==f'END {ident}':break
  events.append({'command':text,'response':lines})
  if any(' ERR' in line for line in lines):raise RuntimeError(lines)
  if not quiet:print(json.dumps({'track':args.track,'command':text,'response':lines}),flush=True)
  return lines
 command.counter=0
 def regs():
  names='EAX EBX ECX EDX ESI EDI EBP ESP EIP CS DS ES SS FLAGS'.split()
  response=command('EXEC EV '+' '.join(names),True)
  values=next(line for line in response if re.fullmatch(r'(?:[0-9a-f]+ ?){14}',line,re.I))
  return dict(zip(names,[int(v,16) for v in values.split()]))
 command('PING',True);time.sleep(5)
 command('BREAK',True);saved=regs();cs=saved['CS'];ds=saved['DS']
 assert ds==cs+0xf31,(cs,ds)
 command(f'EXEC SM {ds:X}:8082 {resource:02X} 00',True)
 command(f'EXEC SM {ds:X}:80B8 FF',True)
 # Invocar Ãºnicamente el selector/cargador musical original y parar antes del fondo.
 command(f'EXEC BP {cs:X}:4E98',True)
 command('EXEC SR EIP 4DD5',True);command('EXEC RUN',True)
 time.sleep(.8);command('BREAK',True);after=regs()
 assert after['EIP']==0x4e98,after
 command('EXEC BPDEL *',True)
 command('EXEC SR '+' '.join(f'{name} {value:X}' for name,value in saved.items()),True)
 command('EXEC RUN',True)
 print(json.dumps({'track':args.track,'phase':'native-player-recording','seconds':args.seconds,'savedRegisters':saved}),flush=True)
 remaining=args.seconds
 while remaining>0:
  span=min(20,remaining);time.sleep(span);remaining-=span
  print(json.dumps({'track':args.track,'phase':'recording','remaining':remaining}),flush=True)
 command('BREAK',True);command('EXEC SR AX 4C00',True)
 try:command('EXEC INT 21',True)
 except (EOFError,OSError):pass
 try:process.wait(timeout=8)
 except subprocess.TimeoutExpired:
  try:command('EXEC RUN',True);process.wait(timeout=5)
  except Exception:process.terminate();process.wait(timeout=5)
except Exception as error:
 print(json.dumps({'track':args.track,'error':str(error)}),flush=True)
 if process.poll() is None:process.terminate();process.wait(timeout=5)
finally:
 server.close();log.close()
 (run/'debugger-transcript.json').write_text(json.dumps(events,indent=2)+'\n')
 print(json.dumps({'track':args.track,'phase':'finished','exit':process.poll(),'files':[(p.name,p.stat().st_size) for p in captures.iterdir()]}),flush=True)
