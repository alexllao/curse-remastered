"""Contrasta la secuencia completa de DROP y su salida mediante el ejecutable local."""
from pathlib import Path
import json,struct
r=Path(__file__).resolve().parents[2];source=(r/'tools/reverse-engineering/trace-dungeon-actions.py').read_text(encoding='utf-8').split('\ndef main():')[0];source=source.replace("'DUNGEON.SPR'","'DROP.SPR'").replace('self.set_word(0x8082, 0)','self.set_word(0x8082, 2)').replace("m['resources'][0]['records']","m['resources'][2]['records']");ns={'__file__':str(r/'tools/reverse-engineering/trace-dungeon-actions.py'),'__name__':'drop_native'};exec(compile(source,ns['__file__'],'exec'),ns);D=ns['Dungeon'];t=ns['t'];d=D()
# Repetir la entrada lÃ³gica1 tras inicializar objetos de DROP.
d.uc.reg_write(ns['UC_X86_REG_BX'],1);d.uc.reg_write(ns['UC_X86_REG_ES'],t.DATA_SEGMENT);d.execute(0x4d55,0x4e89);d.byte(0x358c,255);d.set_word(0x2c4a,0x5000);d.set_word(0x3591,0)

import hashlib
from capstone import Cs,CS_ARCH_X86,CS_MODE_16
from capstone.x86 import X86_OP_REG,X86_OP_IMM,X86_OP_MEM
out=r/'reports/navigation/drop';out.mkdir(parents=True,exist_ok=True)
cs=list(d.uc.mem_read(t.LOAD_ADDRESS,65536));memory=list(d.uc.mem_read(t.DATA_ADDRESS,65536));md=Cs(CS_ARCH_X86,CS_MODE_16);md.detail=True;instructions={}
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
segments=[{'segment':segment,'bytes':list((r/'original/DATA'/name).read_bytes())} for segment,name in [(0x4000,'MANA.BRD'),(0x5000,'STD.BRD'),(0x6000,'DROP.SPR')]]
regions=json.loads((r/'reports/navigation/boxdet.json').read_text())['resources'][2]['records'];segments.append({'segment':0x8000,'bytes':list(b''.join(struct.pack('<BB4h',x['type'],x['argument'],x['left'],x['top'],x['right'],x['bottom']) for x in regions))})
files={p.name:list(p.read_bytes()) for p in (r/'original/DATA').glob('*.BRD')}
profile={'schemaVersion':1,'resourceId':2,'executableSha256':t.PROFILE,'sourceSha256':{name:hashlib.sha256((r/'original/DATA'/name).read_bytes()).hexdigest() for name in ['DROP.SPR','DROP.MAP','STD.BRD','MANA.BRD','FALL.BRD']},'cs':cs,'memory':memory,'instructions':instructions,'files':files,'segments':segments,'entry':{'logicalRoomId':1,'cameraX':0,'source':'native logical room entry loader'}}
(out/'profile.json').write_text(json.dumps(profile,separators=(',',':')))
states=[]
for cycle in range(1200):
 d.sounds=[];d.tick();states.append(d.state())
 if d.exited:break
t.require(d.exited and d.exit_room==3,'DROP did not reach its native exit')
report={'executableSha256':t.PROFILE,'states':states,'exit':{'logicalRoomId':d.exit_room,'resourceId':d.word(0x7482+d.exit_room*2)},'opened':sorted(d.opened),'limitations':['Isolated native routines, not a DOSBox recording','VGA and audio hardware bypassed']}
(out/'sequence.json').write_text(json.dumps(report,separators=(',',':')))
print(json.dumps({'ticks':len(states),'exit':report['exit'],'opened':sorted(d.opened),'sounds':[(i,x['sounds']) for i,x in enumerate(states) if x['sounds']]}))
