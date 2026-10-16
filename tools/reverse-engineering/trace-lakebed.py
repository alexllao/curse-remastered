"""Entrada, pecera y recorridos de LAKEBED mediante rutinas originales aisladas."""
from pathlib import Path
import json,struct
r=Path(__file__).resolve().parents[2];source=(r/'tools/reverse-engineering/trace-dungeon-actions.py').read_text(encoding='utf-8').split('\ndef main():')[0];source=source.replace("'DUNGEON.SPR'","'LAKEBED.SPR'").replace('self.set_word(0x8082, 0)','self.set_word(0x8082, 3)').replace("m['resources'][0]['records']","m['resources'][3]['records']");ns={'__file__':str(r/'tools/reverse-engineering/trace-dungeon-actions.py'),'__name__':'lakebed_native'};exec(compile(source,ns['__file__'],'exec'),ns);D=ns['Dungeon'];t=ns['t'];d=D()

def setup():
 d=D();d.uc.reg_write(ns['UC_X86_REG_BX'],3);d.uc.reg_write(ns['UC_X86_REG_ES'],t.DATA_SEGMENT);d.execute(0x4d55,0x4e89);d.set_word(0x3591,0);d.set_word(0x2c2d,1420)
 d.uc.mem_write(0x40000,(r/'original/DATA/PLUNGE.BRD').read_bytes());d.byte(0x358c,5);d.byte(0x9974,5)
 d.uc.mem_write(t.DATA_ADDRESS+0x5225,struct.pack('<10H',6,7,9,*([65535]*7)))
 return d


from capstone import Cs,CS_ARCH_X86,CS_MODE_16
from capstone.x86 import X86_OP_REG,X86_OP_IMM,X86_OP_MEM
import hashlib
out=r/'reports/navigation/lakebed';out.mkdir(parents=True,exist_ok=True)
d=setup();cs=list(d.uc.mem_read(t.LOAD_ADDRESS,65536));memory=list(d.uc.mem_read(t.DATA_ADDRESS,65536));md=Cs(CS_ARCH_X86,CS_MODE_16);md.detail=True;instructions={}
for at in range(0x200,0xf200):
 inst=next(md.disasm(bytes(cs[at-512:at-512+15]),at,count=1),None)
 if inst is None:continue
 args=[]
 for op in inst.operands:
  if op.type==X86_OP_REG:args.append(['r',inst.reg_name(op.reg),op.size])
  elif op.type==X86_OP_IMM:args.append(['i',op.imm,op.size])
  elif op.type==X86_OP_MEM:
   m=op.mem;args.append(['m',op.size,inst.reg_name(m.segment) if m.segment else '',inst.reg_name(m.base) if m.base else '',inst.reg_name(m.index) if m.index else '',m.scale,m.disp])
 instructions[str(at)]=[inst.mnemonic,at+inst.size,args]
segments=[{'segment':seg,'bytes':list((r/'original/DATA'/name).read_bytes())} for seg,name in [(0x4000,'PLUNGE.BRD'),(0x5000,'STD.BRD'),(0x6000,'LAKEBED.SPR')]]
regions=json.loads((r/'reports/navigation/boxdet.json').read_text())['resources'][3]['records'];segments.append({'segment':0x8000,'bytes':list(b''.join(struct.pack('<BB4h',x['type'],x['argument'],x['left'],x['top'],x['right'],x['bottom']) for x in regions))})
files={p.name:list(p.read_bytes()) for p in (r/'original/DATA').glob('*.BRD')};profile={'schemaVersion':1,'resourceId':3,'executableSha256':t.PROFILE,'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (r/'original/DATA').glob('*.BRD')},'cs':cs,'memory':memory,'segments':segments,'files':files,'instructions':instructions,'entry':{'x':1420,'y':-48,'cameraX':1280,'logicalRoomId':3,'source':'native entry normalized to world coordinates'}}
(out/'profile.json').write_text(json.dumps(profile,separators=(',',':')))
events=[]
def ticks(count):
 rows=[]
 for i in range(count):
  d.sounds=[];d.tick();rows.append(d.state())
  if d.exited:break
 events.append({'kind':'ticks','states':rows})
def action(command):
 d.sounds=[];d.set_word(0xb620,command['item']+(23 if command['kind']=='talk' else 26));d.set_word(0xb634,command.get('verb',0));d.set_word(0xb638,command.get('other',65535));d.call({'use':0x3d53,'take':0x583a,'look':0x3a4a,'jump':0x3343,'talk':0x34de}[command['kind']],0);events.append({'kind':'action','command':command,'expected':d.state()})
ticks(100)
t.require(d.word(0x2c3b)==0,'Contextual actions must be enabled after plunge')
action({'kind':'use','item':6,'verb':4});ticks(160);t.require(d.state()['controls']==[1,1,1],'Wearing bowl must enable walking')
for x,y in [(1450,185),(1250,185),(1192,188),(1030,188),(850,185),(730,185),(330,185),(80,185)]:
 d.set_word(0x9978,0);d.set_word(0x997a,x);d.set_word(0x997c,y);d.set_word(0xdfa,0x9978);d.uc.reg_write(ns['UC_X86_REG_SI'],0x9978);d.call(0x115f);events.append({'kind':'walk','point':{'x':x,'y':y},'expected':d.state()});ticks(160)
 if d.exited:break
(out/'sequence.json').write_text(json.dumps({'events':events,'opened':sorted(d.opened),'exit':getattr(d,'exit_room',None)},separators=(',',':')))
print(json.dumps({'ticks':sum(len(e.get('states',[])) for e in events),'opened':sorted(d.opened),'finalControls':d.state()['controls'],'ben':d.state()['actors'][0][:10]}))

# Acciones independientes a partir de la entrada ya asentada, sin forzar inventario.
cases=[];ui_cases=[]
for kind,item,verb,other in [('take',i,0,65535) for i in range(15,27)]+[('look',i,0,65535) for i in range(15,27)]+[('use',i,v,65535) for i in [6,7,9] for v in [2,3,4,5]]+[('use',i,0,o) for i,o in [(7,20),(9,20),(6,23),(7,24)]]:
 d=setup()
 for _ in range(100):d.sounds=[];d.tick()
 command={'kind':kind,'item':item,'verb':verb,'other':other}
 try:
  d.sounds=[];d.set_word(0xb620,item+26);d.set_word(0xb634,verb);d.set_word(0xb638,other);d.call({'take':0x583a,'look':0x3a4a,'use':0x3d53}[kind],0)
  initial=d.state();states=[]
  for _ in range(80):
   d.sounds=[];d.tick();states.append(d.state())
   if d.exited:break
  cases.append({'command':command,'initial':initial,'states':states})
 except Exception as e:
  if 'Unsupported OUT 3c4/1' not in str(e):raise
  ui_cases.append({'command':command,'reason':'native VGA submenu omitted'})
(out/'actions.json').write_text(json.dumps(cases,separators=(',',':')))
(out/'ui-cases.json').write_text(json.dumps(ui_cases,separators=(',',':')))
print(json.dumps({'actionCases':len(cases),'omittedVgaMenus':len(ui_cases)}))
