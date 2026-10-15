"""Verify ICONS[159] object creation and inventory mapping in isolated original code.

Uses the same Unicorn setup as trace-palettes.py; does not launch DOSBox or a game.
Outputs metadata only. Original resources remain local.
"""
import argparse
import importlib.util
import hashlib
import json
from pathlib import Path
import struct

from unicorn.x86_const import (
    UC_X86_REG_BX, UC_X86_REG_CX, UC_X86_REG_DX, UC_X86_REG_DI,
    UC_X86_REG_ES, UC_X86_REG_SI,
)


def main():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exe', type=Path, default=root / 'original/CURSE.EXE')
    parser.add_argument('--sprites', type=Path, default=root / 'original/DATA/STUDY.SPR')
    parser.add_argument('--output', type=Path, default=root / 'reports/exe/icon159-execution.json')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('palette_trace', Path(__file__).with_name('trace-palettes.py'))
    trace = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(trace)
    machine = trace.Machine(args.exe.read_bytes())  # Exact executable SHA-256 is required.
    sprite_bytes = args.sprites.read_bytes()
    machine.uc.mem_write(0x40000, sprite_bytes)
    machine.uc.mem_write(trace.LOAD_ADDRESS + 0x4aee, struct.pack('<H', 0x4000))
    machine.set_word(0x8082, 70)
    machine.uc.mem_write(trace.DATA_ADDRESS + 0xad6, b'\x00')
    machine.execute(0x8ca6, 0x8d6e)
    scene_object = machine.word(0x2c4c + 14)
    trace.require(scene_object == 175, 'Original loader did not create object 175')
    # Select all eligible objects, bypassing only player-distance checks via the
    # original mode flag. This does not establish full-game reachability.
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x3593, b'\x01')
    machine.uc.reg_write(UC_X86_REG_DI, 0xb620)
    machine.uc.reg_write(UC_X86_REG_CX, 10)
    machine.uc.reg_write(UC_X86_REG_DX, 2)
    machine.execute(0x8b1e, 0x8bd8)
    selector_value = machine.word(0xb620)
    trace.require(selector_value == 201, 'Unexpected selector value')
    machine.uc.mem_write(trace.DATA_ADDRESS + 0x5225, b'\xff' * 20)
    machine.uc.reg_write(UC_X86_REG_BX, 0)
    machine.execute(0x583a, 0x5879)
    inventory_object = machine.word(0x5225)
    trace.require(inventory_object == 175, 'Object was not inserted into inventory')
    flags_before = list(machine.uc.mem_read(trace.DATA_ADDRESS + 0x53ab, 3))
    machine.execute(0x653f, 0x6544)
    flags_after = list(machine.uc.mem_read(trace.DATA_ADDRESS + 0x53ab, 3))
    trace.require(flags_before[0] == 3 and flags_before[2] == 0 and
                  flags_after[0] == 3 and flags_after[2] == 1, 'Unexpected enabled object')
    machine.uc.reg_write(UC_X86_REG_ES, trace.DATA_SEGMENT)
    machine.uc.reg_write(UC_X86_REG_BX, 0xb620)
    machine.uc.reg_write(UC_X86_REG_CX, 10)
    machine.execute(0xe159, 0xe185)
    icon_index = machine.uc.reg_read(UC_X86_REG_SI)
    trace.require(icon_index == 159, 'Unexpected icon index')
    report = {
        'status': 'verified-isolated-execution', 'executableSha256': trace.PROFILE,
        'scope': 'Object creation, eligibility, inventory insertion and icon-index translation; not a full game capture',
        'inputs': {'resourceId': 70, 'sceneSprites': str(args.sprites), 'sceneSpritesSha256': hashlib.sha256(sprite_bytes).hexdigest(),
                   'allSceneObjectsEligibility': True, 'inventoryInitiallyEmpty': True},
        'observed': {'firstSceneObjectId': scene_object, 'firstSelectorValue': selector_value,
                     'firstInventoryObjectId': inventory_object, 'selectedIconIndex': icon_index,
                     'object175FlagBefore': flags_before[0], 'object175FlagAfter': flags_after[0],
                     'object176FlagBefore': flags_before[2], 'object176FlagAfter': flags_after[2]},
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
