"""Render silencioso de MIDI verificados; escribe solo en carpeta de preparaciÃ³n."""
from pathlib import Path
import ctypes as c, json, subprocess, wave, hashlib, argparse
import mido

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--input', type=Path, required=True)
args=parser.parse_args();root=args.root;folder=args.input
report=json.loads((folder/'verification.json').read_text())
library_path=root/'reports/tools/munt-build/Release/mt32emu-2.dll'
library=c.CDLL(str(library_path))
def bind(name,result,args):
 fn=getattr(library,'mt32emu_'+name);fn.restype=result;fn.argtypes=args;return fn
create=bind('create_context',c.c_void_p,[c.c_void_p,c.c_void_p]);free=bind('free_context',None,[c.c_void_p])
add=bind('add_rom_file',c.c_int,[c.c_void_p,c.c_char_p]);open_synth=bind('open_synth',c.c_int,[c.c_void_p])
rate=bind('get_actual_stereo_output_samplerate',c.c_uint,[c.c_void_p]);message=bind('play_msg_now',None,[c.c_void_p,c.c_uint])
render=bind('render_bit16s',None,[c.c_void_p,c.POINTER(c.c_int16),c.c_uint])
analog=bind('set_analog_output_mode',None,[c.c_void_p,c.c_int])
output_rate=bind('set_stereo_output_samplerate',None,[c.c_void_p,c.c_double])
nice_ramp=bind('set_nice_amp_ramp_enabled',None,[c.c_void_p,c.c_int])
roms=[root/'reports/audio/roms'/name for name in ['MT32_CONTROL.ROM','MT32_PCM.ROM']]
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def level(path):
 p=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(path),'-af','loudnorm=print_format=json','-f','null','NUL'],capture_output=True,text=True,check=True)
 return json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1])
reference=level(root/'assets/remaster/musica/CURSE.RS5.mp3')
for item in report['tracks']:
 name=item['track'];midi=folder/f'{name}.expanded.mid'
 assert sha(midi)==item['expandedMidiSha256']
 context=create(None,None)
 try:
  for rom in roms:assert add(context,str(rom).encode())>=0
  analog(context,2);output_rate(context,48000)
  assert open_synth(context)==0
  nice_ramp(context,1)
  sample_rate=rate(context);buffer=(c.c_int16*(4096*2))();wav=folder/f'{name}.wav'
  with wave.open(str(wav),'wb') as stream:
   stream.setnchannels(2);stream.setsampwidth(2);stream.setframerate(sample_rate)
   def advance(frames):
    while frames:
     count=min(frames,4096);render(context,buffer,count);stream.writeframesraw(bytes(buffer)[:count*4]);frames-=count
   elapsed=0.;rendered=0
   for msg in mido.MidiFile(midi):
    elapsed+=msg.time;target=round(elapsed*sample_rate);advance(target-rendered);rendered=target
    if msg.is_meta:continue
    assert msg.type!='sysex','No SysEx expected in verified capture'
    data=msg.bytes();message(context,sum(value<<(8*i) for i,value in enumerate(data)))
  initial=level(wav);gain=float(reference['input_i'])-float(initial['input_i']);filters=f'volume={gain:.5f}dB'
  if float(initial['input_tp'])+gain>-.8:filters+=',alimiter=limit=0.794:level=disabled:latency=1'
  ogg=folder/f'{name}.ogg'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-af',filters,'-c:a','libvorbis','-q:a','6',str(ogg)],check=True)
  final=level(ogg);assert abs(float(final['input_i'])-float(reference['input_i']))<.5
  assert float(final['input_tp'])<-.5
  item.update({'outputSha256':sha(ogg),'sampleRate':sample_rate,'gainDb':gain,'loudness':final})
  print(json.dumps({'track':name,'LUFS':final['input_i'],'sampleRate':sample_rate}),flush=True)
 finally:free(context)
report.update({'librarySha256':sha(library_path),'romSha256':{p.name:sha(p) for p in roms},'referenceSha256':sha(root/'assets/remaster/musica/CURSE.RS5.mp3'), 'emulatorSettings':{'analogOutputMode':2,'stereoOutputSampleRate':48000,'niceAmpRamp':True,'partialCount':32,'reverb':'ROM default','dacInputMode':0}})
(folder/'render.json').write_text(json.dumps(report,indent=2)+'\n')
