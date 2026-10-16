from pathlib import Path
import hashlib,json,os
base=Path(os.environ['CURSE_CAPTURE_WORK'])
source=base/'runtime/mingw-build/mingw-sdl2/dosbox-x.exe'
output=source.with_name('dosbox-capture.exe')
data=bytearray(source.read_bytes());at=0x4c6abe
assert hashlib.sha256(data).hexdigest()=='072c1944635ccc545a816e128625e3405feab559021e4ef60b2d512f97f754c0', 'Unsupported DOSBox-X binary'
assert data[at:at+4]==bytes.fromhex('48 83 c8 01')
# Ãšnica modificaciÃ³n: WaveEvent empieza WAV|MIDI (1|4) en vez de solo WAV (1).
# CAPTURE_AddMidi abre el fichero en el primer evento; sus contadores iniciales son cero.
data[at+3]=5
output.write_bytes(data)
sha=lambda b:hashlib.sha256(b).hexdigest()
(base/'recorder-instrumentation.json').write_text(json.dumps({'sourceRelease':'DOSBox-X 2026.10.01 b6abbd5 MinGW SDL2 64-bit','originalExeSha256':sha(source.read_bytes()),'instrumentedExeSha256':sha(data),'patch':{'fileOffset':at+3,'before':1,'after':5,'purpose':'Enable native raw MIDI recorder when WAV capture starts; no synthesis or MPU changes'},'gameExecutableModified':False},indent=2)+'\n')
print(output)
