"""Contrasta acciones de la primera mazmorra ejecutando rutinas originales aisladas.

Las llamadas de acción se inyectan explícitamente: no es una ejecución completa
de DOS ni una medida de su cadencia. Lecturas de bancos limitadas a original/DATA;
el hardware de sonido se omite y los datos derivados se guardan en reports/.
"""
import sys, importlib.util, json, struct
from pathlib import Path
from unicorn import UC_HOOK_CODE
from unicorn.x86_const import *
r = Path(__file__).resolve().parents[2]
s = importlib.util.spec_from_file_location('trace', r / 'tools/reverse-engineering/trace-palettes.py')
t = importlib.util.module_from_spec(s)
s.loader.exec_module(t)
exe = (r / 'original/CURSE.EXE').read_bytes()

class Dungeon(t.Machine):

    def interrupt(self, uc, number, ctx):
        ah = uc.reg_read(UC_X86_REG_AX) >> 8
        if number == 33 and ah in (61, 63, 62):
            if ah == 61:
                addr = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
                name = bytes(uc.mem_read(addr, 80)).split(b'\x00')[0].decode().replace('\\', '/').split('/')[-1].upper()
                assert name.endswith('.BRD') and (r / 'original/DATA' / name).is_file(), name
                self.opened.add(name)
                self.open_data = (r / 'original/DATA' / name).read_bytes()
                uc.reg_write(UC_X86_REG_AX, 10)
            elif ah == 63:
                count = uc.reg_read(UC_X86_REG_CX)
                addr = uc.reg_read(UC_X86_REG_DS) * 16 + uc.reg_read(UC_X86_REG_DX)
                data = self.open_data[:count]
                uc.mem_write(addr, data)
                uc.reg_write(UC_X86_REG_AX, len(data))
            uc.reg_write(UC_X86_REG_EFLAGS, uc.reg_read(UC_X86_REG_EFLAGS) & ~1)
            return
        super().interrupt(uc, number, ctx)

    def __init__(self):
        super().__init__(exe)
        for off, seg in [(16, 0x4000), (14, 0x5000), (0x4aee, 0x6000), (24, 0x8000)]:
            self.uc.mem_write(t.LOAD_ADDRESS + off, struct.pack('<H', seg))
        for bank, name in [(0x40000, 'MANA.BRD'), (0x50000, 'STD.BRD'), (0x60000, 'DUNGEON.SPR')]:
            self.uc.mem_write(bank, (r / 'original/DATA' / name).read_bytes())
        self.uc.mem_write(t.DATA_ADDRESS + 0x2c0a, bytes(70 * 33))
        self.set_word(0x8082, 0)
        self.byte(0xad6, 1)
        self.execute(0x8ca6, 0x8d6e)
        self.uc.reg_write(UC_X86_REG_BX, 0xffff)
        self.uc.reg_write(UC_X86_REG_ES, t.DATA_SEGMENT)
        self.execute(0x4d55, 0x4e89)
        self.byte(0x358c, 0)
        self.execute(0x4f04, 0x4f2b)
        self.uc.mem_write(t.DATA_ADDRESS + 0x3594, bytes(3))
        self.sounds = []
        self.opened = set()
        self.exited = False
        self.uc.hook_add(UC_HOOK_CODE, self.hook)
        m = json.loads((r / 'reports/navigation/boxdet.json').read_text())
        regions = m['resources'][0]['records']
        self.uc.mem_write(0x80000, b''.join((struct.pack('<BB4h', x['type'], x['argument'], x['left'], x['top'], x['right'], x['bottom']) for x in regions)))
        self.set_word(0xdf0, len(regions))

    def byte(self, at, n):
        self.uc.mem_write(t.DATA_ADDRESS + at, bytes([n]))

    def hook(self, uc, addr, size, ctx):
        at = addr - t.LOAD_ADDRESS + 0x200
        if at == 0x4cf0:
            self.exited = True
            self.exit_room = uc.reg_read(UC_X86_REG_BX)
            uc.emu_stop()
        if at == 0x5488:
            self.sounds.append(uc.reg_read(UC_X86_REG_AX) & 255)
            sp = uc.reg_read(UC_X86_REG_SP)
            ret = struct.unpack('<H', uc.mem_read(0x70000 + sp, 2))[0]
            uc.reg_write(UC_X86_REG_SP, sp + 2)
            uc.reg_write(UC_X86_REG_IP, ret)

    def call(self, at, bx=None):
        self.uc.reg_write(UC_X86_REG_CS, t.LOAD_SEGMENT)
        self.uc.reg_write(UC_X86_REG_DS, t.DATA_SEGMENT)
        self.uc.reg_write(UC_X86_REG_ES, t.DATA_SEGMENT)
        self.uc.reg_write(UC_X86_REG_SP, 0xfefe)
        self.uc.mem_write(0x7fefe, struct.pack('<H', 0xee02))
        if bx is not None:
            self.uc.reg_write(UC_X86_REG_BX, bx)
        self.execute(at, 0xf002)

    def tick(self):
        self.set_word(0xae6, self.word(0x2c2d))
        self.set_word(0xae8, self.word(0x2c2f))
        self.execute(0xb6d, 0xc59)
        self.execute(0x85de, 0x8a21)
        if self.uc.mem_read(t.DATA_ADDRESS + 0x3596, 1)[0]:
            self.stop_address = t.LOAD_ADDRESS + 0xda6 - 0x200
            self.uc.emu_start(t.LOAD_ADDRESS + 0xc78 - 0x200, 0, count=0x1e8480)
            if self.exited:
                return
            t.require(self.uc.reg_read(UC_X86_REG_IP) == 0xda6 - 0x200, 'Collision routine did not return')
        self.call(0x12ec)

    def state(self):
        raw = bytes(self.uc.mem_read(t.DATA_ADDRESS + 0x2c2b, 69 * 33))
        actors = [list(raw[i * 33:(i + 1) * 33]) for i in range(69)]
        return dict(actors=actors, controls=list(self.uc.mem_read(t.DATA_ADDRESS + 0x3594, 3)), bank=self.uc.mem_read(t.DATA_ADDRESS + 0x358c, 1)[0], pending=self.uc.mem_read(t.DATA_ADDRESS + 0x9975, 1)[0], inventory=list(struct.unpack('<10H', self.uc.mem_read(t.DATA_ADDRESS + 0x5225, 20))), walking=self.word(0x359a), action=[self.word(x) for x in [0xad7, 0xadc, 0xae1]], sounds=list(self.sounds), seed=list(struct.unpack('<4H', self.uc.mem_read(t.LOAD_ADDRESS + 0x78de, 8))), collision=self.uc.mem_read(t.DATA_ADDRESS + 0xdef, 1)[0], score=self.word(0x35c7), templates=list(self.uc.mem_read(t.DATA_ADDRESS + 0x35dd, 80)))

    def summary(self):
        st = self.state()
        return {k: v for k, v in st.items() if k != 'actors'} | {'ben': st['actors'][0][:10], 'channels': list(struct.unpack('<3H', bytes(st['actors'][0][16:18] + st['actors'][0][21:23] + st['actors'][0][26:28]))), 'objects': [(i + 1, x[:2]) for i, x in enumerate(st['actors']) if i < 11]}

def main():
    import hashlib
    d = Dungeon()
    initial = d.state()
    memory = list(d.uc.mem_read(t.DATA_ADDRESS, 0xb600))
    events = []
    menu_stages = []

    def menus(label):
        stage = {'label': label, 'state': d.state(), 'probes': []}
        x0, y0 = (d.word(0x2c2d), d.word(0x2c2f))
        for x, y in [(125, 98), (111, 109), (30, 109), (190, 109), (0x118, 148), (0x127, 150), (200, 110), (0, 0), (0x122, 151)]:
            d.set_word(0x2c2d, x)
            d.set_word(0x2c2f, y)
            for mask in [1, 2, 5]:
                d.uc.reg_write(UC_X86_REG_CX, 10)
                d.uc.reg_write(UC_X86_REG_DX, mask)
                d.uc.reg_write(UC_X86_REG_DI, 0xb620)
                d.call(0x8b1e)
                items = [d.word(0xb620 + i * 2) - 26 for i in range(10) if d.word(0xb620 + i * 2) != 0xffff]
                stage['probes'].append({'x': x, 'y': y, 'mask': mask, 'items': items})
        d.set_word(0x2c2d, x0)
        d.set_word(0x2c2f, y0)
        menu_stages.append(stage)

    def tick(count):
        rows = []
        for _ in range(count):
            d.sounds = []
            d.tick()
            rows.append(d.state())
        events.append({'kind': 'ticks', 'states': rows})

    def action(name, at, item, verb=None, other=0xffff):
        d.sounds = []
        d.set_word(0xb620, item + 26)
        if verb is not None:
            d.set_word(0xb634, verb)
            d.set_word(0xb638, other)
        d.call(at, 0)
        events.append({'kind': 'action', 'name': name, 'expected': d.state()})

    def settle(limit=0x12c):
        for _ in range(limit):
            tick(1)
            if d.state()['controls'] == [1, 1, 1] and (not d.state()['walking']) and (not any((d.word(x) for x in [0x2c3b, 0x2c40, 0x2c45]))):
                return
        raise RuntimeError('Action did not settle')
    tick(2)
    menus('chained')
    action('help', 0x34de, -3)
    tick(0x15e)
    menus('key-visible')
    action('take-key', 0x583a, 1)
    tick(12)
    action('unlock-chains', 0x3d53, 0, 0, 1)
    settle()
    menus('free')
    action('take-coin', 0x583a, 5)
    settle()
    action('push-wall', 0x3d53, 2, 2)
    settle()
    menus('wall-open')
    action('take-clip', 0x583a, 3)
    settle()
    action('unlock-door', 0x3d53, 4, 0, 3)
    settle()
    t.require(d.state()['actors'][4][1] == 16, 'Door did not open')
    menus('door-open')
    d.set_word(0x9978, 0)
    d.set_word(0x997a, 45)
    d.set_word(0x997c, 152)
    d.set_word(0xdfa, 0x9978)
    d.uc.reg_write(UC_X86_REG_SI, 0x9978)
    d.call(0x115f)
    events.append({'kind': 'walk', 'point': {'x': 45, 'y': 152}, 'expected': d.state()})
    for _ in range(100):
        tick(1)
        if d.exited:
            break
    t.require(d.exited and d.exit_room == 0, 'First exit did not lead to logical room 0')
    banks = []
    for mode in range(5):
        pointer = struct.unpack_from('<H', exe, 0xf510 + 0x918 + mode * 2)[0]
        name = exe[0xf510 + pointer:].split(b'\x00')[0].decode().upper()
        if name in d.opened or mode == 0:
            banks.append({'mode': mode, 'file': name, 'bank': 0x4000 if mode == 0 else 0x10000 + mode})
    report = {'schemaVersion': 1, 'executableSha256': t.PROFILE, 'sourceSha256': {name: hashlib.sha256((r / 'original/DATA' / name).read_bytes()).hexdigest() for name in ['MANA.BRD', 'STD.BRD', 'DUNGEON.SPR', *(x['file'] for x in banks)]}, 'initial': initial, 'memory': memory, 'banks': banks, 'events': events, 'menuStages': menu_stages, 'exit': {'logicalRoomId': d.exit_room, 'resourceId': 1}, 'limitations': ['Isolated native routines; no measured wall-clock cadence', 'Original renderer and sound hardware are not executed', 'Actions are injected at their handlers; menu availability is tested separately']}
    (r / 'reports/navigation/dungeon-actions.json').write_text(json.dumps(report, separators=(',', ':')) + '\n')
    print(json.dumps({'actions': len([x for x in events if x['kind'] == 'action']), 'ticks': sum((len(x.get('states', [])) for x in events)), 'banks': banks, 'final': d.summary()}))
if __name__ == '__main__':
    main()
