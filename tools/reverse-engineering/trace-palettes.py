"""Execute original palette routines in isolated 16-bit x86, capturing DAC OUTs.

This is a routine harness, not a DOS/VGA emulator or a full-game timing test.
Original bytes, palette tables and traces must stay under ignored reports/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from importlib.metadata import version
from pathlib import Path
import struct

from unicorn import Uc, UC_ARCH_X86, UC_MODE_16, UC_HOOK_INTR, UC_HOOK_INSN, UC_HOOK_CODE
from unicorn.x86_const import (
    UC_X86_INS_IN, UC_X86_INS_OUT, UC_X86_REG_AX, UC_X86_REG_BX,
    UC_X86_REG_CS, UC_X86_REG_CX, UC_X86_REG_DS, UC_X86_REG_ES,
    UC_X86_REG_IP, UC_X86_REG_SI, UC_X86_REG_SP, UC_X86_REG_SS,
    UC_X86_REG_EFLAGS,
)

PROFILE = 'f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d'
LOAD_SEGMENT = 0x1000
LOAD_ADDRESS = LOAD_SEGMENT * 16
DATA_SEGMENT = LOAD_SEGMENT + 0x0F31
DATA_ADDRESS = DATA_SEGMENT * 16
# Instruction ranges include real parameter setup and CALL; stop just after return.
FADE_CALLS = [(0x760, 0x76C), (0xCD2, 0xCDE), (0x2AD0, 0x2ADC),
              (0x2C41, 0x2C4D), (0x2E96, 0x2EA2), (0x311D, 0x3129),
              (0x4D1D, 0x4D29), (0xD78F, 0xD79B)]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


class Machine:
    def __init__(self, exe: bytes, allocation_failure: bool = False, retrace_phase: int = 0):
        require(hashlib.sha256(exe).hexdigest() == PROFILE, 'Unknown executable revision')
        self.uc = Uc(UC_ARCH_X86, UC_MODE_16)
        self.uc.mem_map(0, 2 * 1024 * 1024)
        header = struct.unpack_from('<H', exe, 8)[0] * 16
        self.uc.mem_write(LOAD_ADDRESS, exe[header:])
        count = struct.unpack_from('<H', exe, 6)[0]
        table = struct.unpack_from('<H', exe, 24)[0]
        for i in range(count):
            offset, segment = struct.unpack_from('<HH', exe, table + i * 4)
            address = LOAD_ADDRESS + segment * 16 + offset
            value = struct.unpack('<H', self.uc.mem_read(address, 2))[0]
            self.uc.mem_write(address, struct.pack('<H', (value + LOAD_SEGMENT) & 65535))
        for register, value in [(UC_X86_REG_CS, LOAD_SEGMENT),
                                (UC_X86_REG_DS, DATA_SEGMENT),
                                (UC_X86_REG_ES, DATA_SEGMENT),
                                (UC_X86_REG_SS, 0x7000), (UC_X86_REG_SP, 0xFF00)]:
            self.uc.reg_write(register, value)
        self.uc.reg_write(UC_X86_REG_EFLAGS, 2)  # DF clear, no injected hardware IRQs.
        self.frames: list[dict] = []
        self.current: dict | None = None
        self.retrace_reads = 0
        self.retrace_phase = retrace_phase
        self.allocations: list[int] = []
        self.frees = 0
        self.allocation_failure = allocation_failure
        self.stop_address = None
        self.uc.hook_add(UC_HOOK_CODE, self.stop_at_boundary)
        self.uc.hook_add(UC_HOOK_INTR, self.interrupt)
        self.uc.hook_add(UC_HOOK_INSN, self.input_port, None, 1, 0, UC_X86_INS_IN)
        self.uc.hook_add(UC_HOOK_INSN, self.output_port, None, 1, 0, UC_X86_INS_OUT)
        # Execute original DS/CS initialization; CS:[0] is assigned at startup.
        self.execute(0x227, 0x238)

    def interrupt(self, uc, number, _):
        ah = uc.reg_read(UC_X86_REG_AX) >> 8
        require(number == 0x21 and ah in (0x48, 0x49), f'Unsupported interrupt {number:x}/{ah:x}')
        if ah == 0x48:
            self.allocations.append(uc.reg_read(UC_X86_REG_BX))
            if self.allocation_failure:
                uc.reg_write(UC_X86_REG_AX, 8)
                uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) | 1)
                return
            require(uc.reg_read(UC_X86_REG_BX) == 0xF0, 'Unexpected scratch allocation')
            uc.reg_write(UC_X86_REG_AX, 0x5000)
        else:
            require(uc.reg_read(UC_X86_REG_ES) == 0x5000, 'Unexpected scratch free')
            self.frees += 1
        uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)

    def input_port(self, _uc, port, size, _):
        require(port == 0x3DA and size == 1, f'Unsupported IN {port:x}/{size}')
        # Deliberately synthetic retrace: validates polling, not physical timing.
        value = 8 * ((self.retrace_reads + self.retrace_phase) % 2)
        self.retrace_reads += 1
        return value

    def output_port(self, uc, port, size, value, _):
        require(size == 1 and port in (0x3C8, 0x3C9), f'Unsupported OUT {port:x}/{size}')
        if port == 0x3C8:
            self.current = {'firstIndex': value, 'rgb6': [], 'writerFileOffset': uc.reg_read(UC_X86_REG_IP) + 0x200}
            self.frames.append(self.current)
        else:
            require(self.current is not None, 'DAC component without index')
            require(0 <= value <= 63, 'Non-VGA output component')
            self.current['rgb6'].append(value)

    def stop_at_boundary(self, uc, address, _size, _):
        if address == self.stop_address:
            uc.emu_stop()

    def execute(self, start: int, stop: int):
        self.stop_address = LOAD_ADDRESS + stop - 0x200
        self.uc.emu_start(LOAD_ADDRESS + start - 0x200,
                          0, count=2_000_000)
        require(self.uc.reg_read(UC_X86_REG_IP) == stop - 0x200,
                'Routine failed to reach stop before instruction limit')

    def word(self, offset: int) -> int:
        return struct.unpack('<H', self.uc.mem_read(DATA_ADDRESS + offset, 2))[0]

    def set_word(self, offset: int, value: int):
        self.uc.mem_write(DATA_ADDRESS + offset, struct.pack('<H', value))


def trace_fade(exe: bytes, palette: bytes, call: tuple[int, int], phase: int = 0, fail: bool = False):
    require(len(palette) == 768 and max(palette) <= 63, 'Expected 768 RGB6 palette bytes')
    machine = Machine(exe, allocation_failure=fail, retrace_phase=phase)
    machine.uc.mem_write(DATA_ADDRESS + 0xAEF, palette)
    machine.execute(*call)
    require(machine.allocations == [0xF0], 'Unexpected allocation sequence')
    require(bytes(machine.uc.mem_read(DATA_ADDRESS + 0xAEF, 768)) == palette,
            'Fade modified the source palette buffer')
    require(machine.uc.reg_read(UC_X86_REG_DS) == DATA_SEGMENT, 'DS not restored')
    require(machine.uc.reg_read(UC_X86_REG_SI) == 0xAEF, 'SI not restored')
    if fail:
        require(not machine.frames and machine.frees == 0, 'Allocation failure wrote to DAC or freed memory')
        require(machine.uc.reg_read(UC_X86_REG_EFLAGS) & 1, 'Allocation failure did not set carry')
    else:
        require(len(machine.frames) == 32 and machine.frees == 1, 'Expected 32 uploads and one free')
        require(not (machine.uc.reg_read(UC_X86_REG_EFLAGS) & 1), 'Successful fade returned carry')
        for step, frame in enumerate(machine.frames, 1):
            expected = [(component * 256 - (component * 256 // 32) * step) >> 8 for component in palette]
            require(frame['firstIndex'] == 0 and frame['rgb6'] == expected,
                    f'Fade mismatch at step {step}')
        require(machine.frames[-1]['rgb6'] == [0] * 768, 'Final frame is not black')
    return {'callFileOffset': hex(call[1] - 3), 'allocationFailure': fail,
            'retraceInitialPhase': phase, 'retraceReads': machine.retrace_reads,
            'sourceBufferUnchanged': True, 'frames': machine.frames}


def trace_selector(exe: bytes, carry: int, input_mode: int | None = None, mouse_max_y: int = 199):
    machine = Machine(exe)
    machine.execute(0xDD1C, 0xDD2D)
    table = bytes(machine.uc.mem_read(DATA_ADDRESS + 0xB63E, 24 * 3))
    require(len(table) == 72 and max(table) <= 63, 'Invalid embedded color table')
    if input_mode is not None:
        machine.uc.mem_write(DATA_ADDRESS + 0xAD5, bytes([input_mode]))
        machine.set_word(0xB60A, 16)
        for offset, value in [(0x9916, 0), (0x9918, 319), (0x991A, 0), (0x991C, mouse_max_y)]:
            machine.set_word(offset, value)
    period = 1 if carry else 4
    events = []
    for iteration in range(1, 194):
        previous = len(machine.frames)
        if input_mode is None:
            flags = machine.uc.reg_read(UC_X86_REG_EFLAGS)
            machine.uc.reg_write(UC_X86_REG_EFLAGS, (flags & ~1) | carry)
        else:
            # Execute the original loop tail, including the mouse clamp when mode=1.
            machine.execute(0xDFF9, 0xDD53)
        require(machine.uc.reg_read(UC_X86_REG_EFLAGS) & 1 == carry, 'Unexpected loop-entry carry')
        machine.execute(0xDD53, 0xDD8E)
        if len(machine.frames) != previous:
            color_index = len(events) % 24
            frame = machine.frames[-1]
            require(frame['firstIndex'] == 255 and bytes(frame['rgb6']) == table[color_index * 3:color_index * 3 + 3], 'Selector color mismatch')
            require(iteration == 1 + len(events) * period, 'Selector cadence mismatch')
            events.append({'iteration': iteration, 'tableIndex': color_index, **frame})
        require(machine.word(0xB63C) == len(events) % 24, 'Selector table index did not wrap')
    require(len(events) == 192 // period + 1, 'Unexpected selector event count')
    require(bytes(machine.uc.mem_read(DATA_ADDRESS + 0xB63E, 72)) == table, 'Color table mutated')
    return {'scope': 'Original initialization, color block and optionally original loop tail; middle UI loop omitted',
            'initialization': '0xDD1C-0xDD2D', 'block': '0xDD53-0xDD8E',
            'tableFileOffset': '0x1AB4E', 'events': events, 'loopEntryCarry': carry,
            'inputMode': input_mode, 'syntheticMouseMaxY': mouse_max_y if input_mode == 1 else None,
            'periodInLoopIterations': 24 * period, 'seconds': None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=Path('original/CURSE.EXE'))
    parser.add_argument('--palette', type=Path, action='append', default=[])
    parser.add_argument('--output', type=Path, default=Path('reports/exe/palette-trace.json'))
    args = parser.parse_args()
    exe = args.exe.read_bytes()
    require(hashlib.sha256(exe).hexdigest() == PROFILE, 'Unknown executable revision')
    # All 64 possible component values, repeated; independent from game data.
    synthetic = bytes(i % 64 for i in range(768))
    call_tests = [trace_fade(exe, synthetic, call) for call in FADE_CALLS]
    phase_test = trace_fade(exe, synthetic, FADE_CALLS[0], phase=1)
    failure_test = trace_fade(exe, synthetic, FADE_CALLS[0], fail=True)
    palettes = []
    for path in args.palette:
        data = path.read_bytes()
        palettes.append({'source': str(path), 'sha256': hashlib.sha256(data).hexdigest(),
                         'trace': trace_fade(exe, data, FADE_CALLS[6])})
    report = {'schemaVersion': 1, 'status': 'verified-isolated-execution',
              'executableSha256': PROFILE, 'emulator': {'name': 'unicorn', 'version': version('unicorn')},
              'limitations': ['Not a full-game capture', 'DOS allocation/free and VGA retrace are synthetic',
                              'No wall-clock or monitor-frequency claim', 'Selector UI loop is not emulated'],
              'syntheticFadeCallTests': call_tests, 'alternateRetracePhaseTest': phase_test,
              'allocationFailureTest': failure_test, 'palettes': palettes,
              'selectorTests': [trace_selector(exe, 0), trace_selector(exe, 1),
                                trace_selector(exe, 1, input_mode=0), trace_selector(exe, 0, input_mode=2),
                                trace_selector(exe, 1, input_mode=1), trace_selector(exe, 0, input_mode=1, mouse_max_y=16)]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': report['status'], 'fadeCallSites': len(call_tests),
                      'realPalettes': len(palettes), 'selectorCases': len(report['selectorTests']),
                      'output': str(args.output)}, indent=2))


if __name__ == '__main__':
    main()
