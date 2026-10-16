"""Auditar el lote provisional histórico frente a las órdenes MPU del EXE."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import mido
from unicorn.x86_const import UC_X86_REG_SI

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('native', Path(__file__).with_name('trace-palettes.py'))
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
exe = (root / 'original/CURSE.EXE').read_bytes()
data = exe[struct.unpack_from('<H', exe, 8)[0] * 16 + 0xf310:]
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()

class MpuMachine(native.Machine):
    def __init__(self):
        self.writes = []
        super().__init__(exe)

    def input_port(self, uc, port, size, unused):
        if port == 0x331:
            return 0  # Disponibilidad sintética; no representa tiempos físicos.
        if port == 0x330:
            return 0xfe  # ACK sintético de las órdenes MPU.
        return super().input_port(uc, port, size, unused)

    def output_port(self, uc, port, size, value, unused):
        if port in (0x330, 0x331):
            self.writes.append({'port': port, 'value': value})
            return
        super().output_port(uc, port, size, value, unused)

render = json.loads((root / 'reports/audio/mt32-render.json').read_text(encoding='utf-8'))
library = root / 'reports/tools/munt-build/Release/mt32emu-2.dll'
library_ok = sha(library) == render['librarySha256']
rows = []
for index in range(5):
    m = MpuMachine()
    m.uc.reg_write(UC_X86_REG_SI, 0x80b9 + index * 4)
    m.execute(0x5012, 0x5017)
    tempo = m.uc.mem_read(native.DATA_ADDRESS + 0x806e, 1)[0]
    m.execute(0x5092, 0x5098)
    expected = [(0x331, 0xe0), (0x330, tempo), (0x331, 0xec), (0x330, 1), (0x331, 0xb8), (0x331, 8)]
    native.require([(event['port'], event['value']) for event in m.writes] == expected, 'Unexpected native MPU commands')
    track = f'CURSE.RS{index + 1}'
    path = root / f'assets/original/musica/anteriores/pre-captura-nativa-2026-10-16/{track}.mid'
    midi = mido.MidiFile(path)
    tempos = [event.tempo for part in midi.tracks for event in part if event.type == 'set_tempo']
    saved = render['files'][track + '.mid']
    roms_ok = all(sha(root / 'reports/audio/roms' / name) == digest for name, digest in saved['romSha256'].items())
    rows.append({'track': track, 'nativeTempoBpm': tempo, 'nativeMpuWrites': m.writes,
                 'midiTempoMicroseconds': tempos, 'midiBpm': [mido.tempo2bpm(value) for value in tempos],
                 'midiTicksPerBeat': midi.ticks_per_beat, 'midiSeconds': midi.length,
                 'midiHasSysex': any(event.type == 'sysex' for part in midi.tracks for event in part),
                 'midiHashMatchesRender': sha(path) == saved['midiSha256'],
                 'oggHashMatchesRender': sha(root / f'assets/original/musica/anteriores/pre-captura-nativa-2026-10-16/{track}.ogg') == saved['outputSha256'],
                 'romHashesMatchRender': roms_ok,
                 'tempoMetadataDiffers': tempos != [mido.bpm2tempo(tempo)]})
startup = MpuMachine()
startup.uc.reg_write(UC_X86_REG_SI, 0xe19)
startup.execute(0x7f6a, 0x7f7c)
report = {'schemaVersion': 1, 'executableSha256': native.PROFILE,
          'renderLibraryHashMatches': library_ok, 'startupMpuWrites': startup.writes, 'tracks': rows,
          'status': 'Historical baseline only: the previous MIDI tempo assumption differs from native MPU orders',
          'limitations': ['MPU ACK and status are synthetic; no full controller or physical timing emulation',
                          'Does not prove RS delay interpretation, loop boundaries or equivalence to DOS playback',
                          'No new renders activated; tempo-only correction is insufficient to certify fidelity',
                          'Absence of SysEx in MIDI is an observation, not proof that the game needs custom SysEx']}
destination = root / 'reports/audio/native-verified/baseline-input-audit.json'
destination.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
native.require(library_ok and all(row['midiHashMatchesRender'] and row['oggHashMatchesRender'] and row['romHashesMatchRender'] for row in rows), 'Stored render fingerprints differ')
print(json.dumps({'verifiedRenderFingerprints': len(rows), 'tempos': [{'track': row['track'], 'native': row['nativeTempoBpm'], 'midi': row['midiBpm']} for row in rows]}))
