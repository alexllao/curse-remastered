"""Contrastar selector RS/MPU y petición de parada sin audio ni tiempos físicos."""
import importlib.util,json,struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX
root=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('trace',root/'tools/reverse-engineering/trace-palettes.py');t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
exe=(root/'original/CURSE.EXE').read_bytes();data=exe[0xf510:]
results=[]
for resource in range(78):
 for previous in [255, data[0x80cd+resource]]:
  m=t.Machine(exe);m.set_word(0x8082,resource);m.uc.mem_write(t.DATA_ADDRESS+0xad3,b'\x04');m.uc.mem_write(t.DATA_ADDRESS+0x80b8,bytes([previous]));m.uc.mem_write(t.LOAD_ADDRESS+0x7b2c,struct.pack('<H',t.DATA_SEGMENT))
  stopped=[]
  def boundary(uc,address,size,unused):
   if address in [t.LOAD_ADDRESS+v-512 for v in [0x5001,0x5098]]:stopped.append(address-t.LOAD_ADDRESS+512);uc.emu_stop()
  m.uc.hook_add(UC_HOOK_CODE,boundary)
  m.uc.emu_start(t.LOAD_ADDRESS+0x4fd5-512,0,count=10000)
  changed=stopped==[0x5001]
  t.require(changed==(previous!=data[0x80cd+resource]),'Selector mismatch')
  row={'resourceId':resource,'previous':previous,'changed':changed,'stopRequested':m.uc.mem_read(t.DATA_ADDRESS+0x9955,1)[0]}
  if changed:
   m.execute(0x5012,0x5017);ptr=m.uc.reg_read(UC_X86_REG_AX);row['track']=data[ptr:ptr+16].split(b'\0')[0].decode().upper();row['tempo']=m.uc.mem_read(t.DATA_ADDRESS+0x806e,1)[0]
  results.append(row)
class Midi(t.Machine):
 def __init__(self):self.midi=[];super().__init__(exe)
 def input_port(self,uc,port,size,unused):
  if port==0x331:return 0
  return super().input_port(uc,port,size,unused)
 def output_port(self,uc,port,size,value,unused):
  if port in (0x330,0x331):self.midi.append({'port':port,'value':value});return
  super().output_port(uc,port,size,value,unused)
m=Midi();m.uc.mem_write(t.DATA_ADDRESS+0x9955,b'\x01');m.uc.reg_write(UC_X86_REG_AX,0xf0);m.execute(0x7ff9,0x80ec)
t.require([p['value'] for p in m.midi]==[0,0xfc],'Unexpected stop response')
report={'schemaVersion':1,'executableSha256':t.PROFILE,'cases':results,'stopResponse':m.midi,'scope':'RS/MPU selector only; isolated native instructions, no physical timing or full DOS playback'}
(root/'reports/music').mkdir(exist_ok=True)
(root/'reports/music/native-selection.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'cases':len(results),'dungeon':results[0],'stopResponse':m.midi}))
