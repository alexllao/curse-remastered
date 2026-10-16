"""Perfil local de CORRIDOR y contrastes contra rutinas aisladas de CURSE.EXE.

Normaliza actores a coordenadas del panorama (cámara cero). El intérprete del port
no ejecuta DOS/VGA: los submenús se sirven con OriginalActionMenu. No representa
una comparación visual o de cadencia con DOSBox ni un recorrido completo del puzle.
"""
from pathlib import Path
import json,struct,importlib.util,hashlib
from capstone import *
from capstone.x86 import *
r=Path(__file__).resolve().parents[2]
source=(r/'tools/reverse-engineering/trace-dungeon-actions.py').read_text(encoding='utf-8').split('\ndef main():')[0]
source=source.replace("'DUNGEON.SPR'","'CORRIDOR.SPR'").replace('self.set_word(0x8082, 0)','self.set_word(0x8082, 1)').replace("m['resources'][0]['records']","m['resources'][1]['records']")
ns={'__file__':str(r/'tools/reverse-engineering/trace-dungeon-actions.py'),'__name__':'corridor_native'}
exec(compile(source,ns['__file__'],'exec'),ns)
D=ns['Dungeon'];t=ns['t'];exe=ns['exe'];regions=json.loads((r/'reports/navigation/boxdet.json').read_text())['resources'][1]['records']
def setup():
 d=D();a=bytearray(33);a[0]=1;a[1]=128
 for at,v in [(2,1152),(4,138),(6,32),(8,48),(14,65535),(31,20480)]:struct.pack_into('<H',a,at,v)
 for at in [16,21,26]:a[at+3]=1;a[at+4]=2
 d.uc.mem_write(t.DATA_ADDRESS+0x2c2b,bytes(a));d.uc.mem_write(t.DATA_ADDRESS+0x3594,b'\1\1\1');d.byte(0x358c,255)
 d.set_word(0x3591,0);d.set_word(0x359a,0)
 d.uc.mem_write(t.DATA_ADDRESS+0x5225,struct.pack('<10H',1,3,*([65535]*8)))
 return d
out=r/'reports/navigation/corridor';out.mkdir(parents=True,exist_ok=True)
d=setup();cs=list(d.uc.mem_read(t.LOAD_ADDRESS,65536));ds=list(d.uc.mem_read(t.DATA_ADDRESS,65536))
md=Cs(CS_ARCH_X86,CS_MODE_16);md.detail=True
instructions={};ops=set()
for address in range(0x200,0xf200):
 inst=next(md.disasm(bytes(cs[address-512:address-512+15]),address,count=1),None)
 if inst is None:continue
 args=[]
 for op in inst.operands:
  if op.type==X86_OP_REG:args.append(['r',inst.reg_name(op.reg),op.size])
  elif op.type==X86_OP_IMM:args.append(['i',op.imm,op.size])
  elif op.type==X86_OP_MEM:
   mm=op.mem;args.append(['m',op.size,inst.reg_name(mm.segment) if mm.segment else '',inst.reg_name(mm.base) if mm.base else '',inst.reg_name(mm.index) if mm.index else '',mm.scale,mm.disp])
 instructions[str(address)]=[inst.mnemonic,address+inst.size,args]
segments=[]
for seg,name in [(0x4000,'MANA.BRD'),(0x5000,'STD.BRD'),(0x6000,'CORRIDOR.SPR')]:segments.append({'segment':seg,'bytes':list((r/'original/DATA'/name).read_bytes())})
segments.append({'segment':0x8000,'bytes':list(b''.join(struct.pack('<BB4h',x['type'],x['argument'],x['left'],x['top'],x['right'],x['bottom']) for x in regions))})
files={p.name:list(p.read_bytes()) for p in (r/'original/DATA').glob('*.BRD')}
profile={'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'original/DATA').glob('*.BRD')},'schemaVersion':1,'executableSha256':t.PROFILE,'cs':cs,'memory':ds,'segments':segments,'files':files,'instructions':instructions,'resourceId':1,'entry':{'x':1152,'y':138,'frame':128,'cameraX':896,'source':'logical room 0, world coordinates'}}
(out/'profile.json').write_text(json.dumps(profile,separators=(',',':')))
# Traza: misma normalización a coordenadas del mundo que usa el port.
cases=[];ui_cases=[]
for kind,item,verb,other in [('take',i,None,None) for i in [6,9,10,11,12,13,14]]+[('use',i,v,o) for i in [6,7,8,9,10,11,12,13,14] for v in [0,1,2,4,5,6,7] for o in [65535,6,7,8]]+[('look',i,None,None) for i in range(6,15)]+[('talk',i,None,None) for i in [0,1]]:
 d=setup();d.set_word(0xb620,item+(23 if kind=='talk' else 26));d.set_word(0xb634,verb or 0);d.set_word(0xb638,other if other is not None else 65535)
 try:
  d.call({'take':0x583a,'use':0x3d53,'look':0x3a4a,'talk':0x34de}[kind],0)
  cases.append({'kind':kind,'item':item,'verb':verb,'other':other,'state':d.state(),'memory':list(d.uc.mem_read(t.DATA_ADDRESS,0xb640))})
 except Exception as e:
  # Selección adicional del HUD DOS: se contrasta por separado en el selector web.
  if 'Unsupported OUT 3c4/1' not in str(e):raise
  ui_cases.append({'kind':kind,'item':item,'verb':verb,'other':other,'reason':'native VGA submenu omitted'})
(out/'ui-cases.json').write_text(json.dumps(ui_cases,separators=(',',':')))
(out/'actions.json').write_text(json.dumps(cases,separators=(',',':')))
d=setup();ticks=[]
for _ in range(500):d.sounds=[];d.tick();ticks.append(d.state())
(out/'ticks.json').write_text(json.dumps(ticks,separators=(',',':')))
print(json.dumps({'profileBytes':(out/'profile.json').stat().st_size,'cases':len(cases),'ticks':len(ticks)}))

# Paseo real con el obstáculo del guardia; no se altera el estado para atravesarlo.
d=setup();walks=[]
for x,y in [(1155,194),(1115,194),(1050,194),(950,194),(850,194),(750,194),(650,194),(550,194),(450,194),(350,194),(250,194),(150,194),(75,194)]:
 d.set_word(0x9978,0);d.set_word(0x997a,x);d.set_word(0x997c,y);d.set_word(0xdfa,0x9978)
 d.uc.reg_write(ns['UC_X86_REG_SI'],0x9978);d.call(0x115f)
 walks.append({'kind':'walk','point':{'x':x,'y':y},'expected':d.state()})
 for cycle in range(180):
  d.sounds=[];d.tick();state=d.state();walks.append({'kind':'tick','expected':state})
  if d.exited:break
  if cycle>5 and state['controls']==[1,1,1] and state['walking']==0 and not any(state['actors'][0][at] or state['actors'][0][at+1] for at in [16,21,26]):break
 if d.exited:break
(out/'walks.json').write_text(json.dumps(walks,separators=(',',':')))
# Incluye el desarrollo de las acciones, carga DIG/SPLAT y callbacks dinámicos.
series=[]
for command in [{'kind':'take','item':6},{'kind':'take','item':9},{'kind':'take','item':13},{'kind':'look','item':8},{'kind':'use','item':8,'verb':0,'other':6}]:
 d=setup();d.set_word(0xb620,command['item']+26);d.set_word(0xb634,command.get('verb',0));d.set_word(0xb638,command.get('other',65535));d.call({'take':0x583a,'look':0x3a4a,'use':0x3d53}[command['kind']],0)
 states=[]
 for cycle in range(300):
  d.sounds=[];d.tick();states.append(d.state())
  if d.exited:break
 series.append({'command':command,'states':states})
(out/'sequences.json').write_text(json.dumps(series,separators=(',',':')))
print(json.dumps({'walkingRows':len(walks),'sequenceTicks':sum(len(x['states']) for x in series)}))
