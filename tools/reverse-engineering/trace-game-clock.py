"""Contrastar el reloj compartido de paseo y actores, sin afirmar tiempos físicos."""
import importlib.util
import json
from pathlib import Path
import struct
from unicorn import UC_HOOK_CODE


def main():
    root = Path(__file__).resolve().parents[2]
    spec = importlib.util.spec_from_file_location('trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    exe = (root / 'original/CURSE.EXE').read_bytes()
    # Direcciones de archivo; CALL near usa desplazamiento respecto a la instrucción siguiente.
    def target(at):
        trace.require(exe[at] == 0xe8, 'Expected near CALL')
        return (at + 3 + struct.unpack_from('<h', exe, at + 1)[0]) & 0xffff
    trace.require(target(0x8e5) == 0xecd5, 'Changed frame rendering call')
    trace.require(target(0xc59) == 0x85de, 'Changed actor interpreter call')
    trace.require(exe[0x455:0x45a] == bytes.fromhex('2e fe 06 75 02'), 'Changed IRQ pulse counter')
    trace.require(exe[0x3ae:0x3b1] == bytes.fromhex('b8 50 42'), 'Changed PIT divisor')
    trace.require(exe[0xedab:0xedb1] == bytes.fromhex('2e c6 06 75 02 00'), 'Changed frame pulse reset')
    cases = []
    for pulses in range(8):
        machine = trace.Machine(exe)
        machine.uc.mem_write(trace.LOAD_ADDRESS + 0x275, bytes([pulses]))
        reached = []
        def boundary(uc, address, _size, _):
            if address == trace.LOAD_ADDRESS + 0xed3b - 512:
                reached.append(True)
                uc.emu_stop()
        machine.uc.hook_add(UC_HOOK_CODE, boundary)
        machine.uc.emu_start(trace.LOAD_ADDRESS + 0xed33 - 512, 0, count=100)
        trace.require(bool(reached) == (pulses >= 5), 'Changed frame gate')
        cases.append({'pulses': pulses, 'frameReady': bool(reached)})
    report = {
        'schemaVersion': 1, 'executableSha256': trace.PROFILE,
        'cyclePulses': 5, 'referenceHz': 70, 'pitDivisor': 0x4250,
        'flow': {'frameCall': '0x8E5→0xECD5', 'gate': '0xED33–0xED3B',
                 'walk': '0xB6D–0xC59', 'actorsCall': '0xC59→0x85DE',
                 'pulseIncrement': '0x455', 'pulseReset': '0xEDAB'},
        'cases': cases,
        'limitations': ['Injected IRQ counter, no hardware timing capture',
                        '70 Hz retained as presentation reference; not measured DOS frame rate',
                        'Rendering, load times and room-controller execution not timed'],
    }
    (root / 'reports/navigation/game-clock.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'cyclePulses': 5, 'verifiedCases': len(cases), 'sharedWalkActorLoop': True}))


if __name__ == '__main__':
    main()
