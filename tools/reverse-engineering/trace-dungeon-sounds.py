"""Traza la selección Sound Blaster de la primera sala sin ejecutar hardware de audio."""
import hashlib
import importlib.util
import json
import struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import UC_X86_REG_AX, UC_X86_REG_BX, UC_X86_REG_DS, UC_X86_REG_SI, UC_X86_REG_IP

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
trace = importlib.util.module_from_spec(spec)
spec.loader.exec_module(trace)


def main():
    exe = (ROOT / 'original/CURSE.EXE').read_bytes()
    sources = {name: (ROOT / 'original/DATA' / name).read_bytes()
               for name in ('STD.SFX', 'DUNGEON.SFX')}

    def select(event, busy=False, current_priority=0):
        machine = trace.Machine(exe)
        for address, segment, name in ((0x5284, 0x4000, 'STD.SFX'), (0x5286, 0x5000, 'DUNGEON.SFX')):
            machine.uc.mem_write(trace.LOAD_ADDRESS + address, struct.pack('<H', segment))
            machine.uc.mem_write(segment * 16, sources[name])
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x8351, bytes([int(busy)]))
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x5375, bytes([current_priority]))
        machine.set_word(0x8082, 0)
        machine.uc.reg_write(UC_X86_REG_AX, event)
        calls = []

        def intercept(uc, address, size, context):
            if address != trace.LOAD_ADDRESS + 0x556d - 512:
                return
            segment = uc.reg_read(UC_X86_REG_DS)
            source = {0x4000: 'STD.SFX', 0x5000: 'DUNGEON.SFX'}[segment]
            calls.append({'source': source, 'byteOffset': uc.reg_read(UC_X86_REG_SI),
                          'byteLength': uc.reg_read(UC_X86_REG_AX),
                          'timeConstant': uc.reg_read(UC_X86_REG_BX) & 255,
                          'priority': machine.uc.mem_read(trace.LOAD_ADDRESS + 0x5375, 1)[0]})
            # Omite únicamente CALL al controlador DMA; captura sus argumentos reales.
            uc.reg_write(UC_X86_REG_IP, uc.reg_read(UC_X86_REG_IP) + 3)

        machine.uc.hook_add(UC_HOOK_CODE, intercept)
        machine.execute(0x5507, 0x5570)
        trace.require(len(calls) <= 1, 'Unexpected multiple transfers')
        return calls[0] if calls else None

    machine = trace.Machine(exe)
    group = machine.uc.mem_read(trace.DATA_ADDRESS + 0x9048, 1)[0]
    table = machine.word(0x901e + group * 2)
    next_table = machine.word(0x901e + (group + 1) * 2)
    trace.require(group == 0 and next_table - table == 6 * 5, 'Unknown first-room table')
    events = []
    priority_cases = 0
    for event in range(21):
        entry = select(event)
        trace.require(entry is not None, f'Missing event {event}')
        at = 0x8fd3 + event * 5 if event < 15 else table + (event - 15) * 5
        priority, constant, trim, sample = struct.unpack('<BBHB', machine.uc.mem_read(trace.DATA_ADDRESS + at, 5))
        source = sources[entry['source']]
        sample_header = struct.unpack_from('<H', source, sample * 2)[0]
        length = struct.unpack_from('<H', source, sample_header)[0]
        trace.require(entry == {'source': 'STD.SFX' if event < 15 else 'DUNGEON.SFX',
                               'byteOffset': sample_header + 2, 'byteLength': length - trim,
                               'timeConstant': constant, 'priority': priority}, 'Selection differs from table')
        trace.require(0 < entry['byteLength'] and entry['byteOffset'] + entry['byteLength'] <= len(source), 'Invalid sample bounds')
        pcm = source[entry['byteOffset']:entry['byteOffset'] + entry['byteLength']]
        entry.update({'event': event, 'resourceId': None if event < 15 else 0,
                      'sampleIndex': sample, 'trimBytes': trim,
                      'sampleRateHz': 1_000_000 / (256 - constant),
                      'sha256Pcm': hashlib.sha256(pcm).hexdigest()})
        events.append(entry)
        for current in (0, 50, 100, 200, 254, 255):
            accepted = select(event, True, current)
            trace.require((accepted is not None) == (priority > current), 'Priority mismatch')
            priority_cases += 1
    trace.require(select(255) is None, 'FF must not start a sample')
    # Verifica los comandos del controlador capturado: frecuencia 40h, DMA PCM 14h.
    trace.require(exe[0x821c:0x821e] == bytes([0xb0, 0x40]), 'Unknown DSP time-constant command')
    trace.require(exe[0x8254:0x8256] == bytes([0xb0, 0x14]), 'Unknown 8-bit PCM DMA command')
    output = ROOT / 'reports/audio/dungeon-sounds.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({'schemaVersion': 1, 'executableSha256': trace.PROFILE,
        'sourceSha256': {name: hashlib.sha256(data).hexdigest() for name, data in sources.items()},
        'events': events, 'priorityCases': priority_cases, 'encoding': 'pcm_u8_mono',
        'limitations': ['DMA arguments and DSP commands verified; no audible comparison or analog hardware capture',
                        'Only global events 0-14 and resource 0 events 15-20 are mapped']}, indent=2) + '\n', encoding='utf-8')
    print(f'Sonidos: {len(events)} asociaciones y {priority_cases} casos de prioridad contrastados sin audio.')


if __name__ == '__main__':
    main()
