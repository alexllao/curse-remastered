import type { ActionCommand } from './original-action-menu.js';
export type NativeOperand =
  | ['r', string, number]
  | ['i', number, number]
  | ['m', number, string, string, string, number, number];
export interface NativeSceneProfile {
  schemaVersion: number;
  executableSha256: string;
  cs: number[];
  memory: number[];
  segments: { segment: number; bytes: number[] }[];
  files: Record<string, number[]>;
  instructions: Record<string, [string, number, NativeOperand[]]>;
  resourceId: number;
}
/** Rutinas verificadas del ejecutable local; no ejecuta DOS, VGA ni hardware de audio. */
export class OriginalSceneMachine {
  readonly ram = new Uint8Array(2 * 1024 * 1024);
  readonly registers: Record<string, number> = {};
  sounds: number[] = [];
  pendingRoom: number | null = null;
  cursor: 'normal' | 'success' | 'failure' = 'normal';
  private flags = 2;
  private inputFile: number[] = [];
  private inputPosition = 0;
  private profile: NativeSceneProfile;
  private ip = 0;
  trace?: (at: number, regs: Record<string, number>, flags: number) => void;
  constructor(profile: NativeSceneProfile) {
    if (profile.schemaVersion !== 1) throw new Error('Perfil nativo desconocido');
    this.profile = profile;
    this.ram.set(profile.cs, 0x10000);
    this.ram.set(profile.memory, 0x1f310);
    for (const segment of profile.segments) this.ram.set(segment.bytes, segment.segment * 16);
    Object.assign(this.registers, {
      ax: 0,
      bx: 0,
      cx: 0,
      dx: 0,
      si: 0,
      di: 0,
      bp: 0,
      sp: 0xff00,
      cs: 0x1000,
      ds: 0x1f31,
      es: 0x1f31,
      ss: 0x7000,
    });
  }
  byte(at: number) {
    return this.ram[0x1f310 + (at & 65535)];
  }
  word(at: number) {
    return this.byte(at) | (this.byte(at + 1) << 8);
  }
  setByte(at: number, value: number) {
    this.ram[0x1f310 + (at & 65535)] = value;
  }
  setWord(at: number, value: number) {
    this.setByte(at, value);
    this.setByte(at + 1, value >> 8);
  }
  private reg(name: string): number {
    if (/^[abcd][hl]$/.test(name))
      return ((this.registers[name[0] + 'x'] ?? 0) >> (name[1] === 'h' ? 8 : 0)) & 255;
    return this.registers[name] ?? 0;
  }
  private setReg(name: string, value: number) {
    if (/^[abcd][hl]$/.test(name)) {
      const key = name[0] + 'x',
        shift = name[1] === 'h' ? 8 : 0;
      this.registers[key] = (this.reg(key) & ~(255 << shift)) | ((value & 255) << shift);
    } else
      this.registers[name] =
        name.startsWith('e') && name.length === 3 ? value >>> 0 : value & 65535;
  }
  private offset(op: Extract<NativeOperand, ['m', ...unknown[]]>): number {
    return (this.reg(op[3]) + this.reg(op[4]) * op[5] + op[6]) & 65535;
  }
  private address(op: Extract<NativeOperand, ['m', ...unknown[]]>): number {
    return this.reg(op[2] || (['bp', 'sp'].includes(op[3]) ? 'ss' : 'ds')) * 16 + this.offset(op);
  }
  private read(op: NativeOperand): number {
    if (op[0] === 'i') {
      const modulus = 2 ** (op[2] * 8);
      return ((op[1] % modulus) + modulus) % modulus;
    }
    if (op[0] === 'r') return this.reg(op[1]);
    let value = 0;
    const at = this.address(op);
    for (let i = 0; i < op[1]; i++) value += this.ram[at + i] * 2 ** (8 * i);
    return value;
  }
  private write(op: NativeOperand, value: number) {
    if (op[0] === 'r') this.setReg(op[1], value);
    else if (op[0] === 'm') {
      const at = this.address(op);
      for (let i = 0; i < op[1]; i++) this.ram[at + i] = Math.floor(value / 2 ** (8 * i));
    } else throw new Error('Destino inmediato nativo');
  }
  private size(op: NativeOperand) {
    return op[0] === 'm' ? op[1] : op[2];
  }
  private signed(value: number, size: number) {
    const modulus = 2 ** (size * 8);
    return value >= modulus / 2 ? value - modulus : value;
  }
  private bit(mask: number) {
    return !!(this.flags & mask);
  }
  private flag(mask: number, value: boolean) {
    this.flags = value ? this.flags | mask : this.flags & ~mask;
  }
  private arithmetic(value: number, size: number, carry: boolean, overflow: boolean) {
    const modulus = 2 ** (size * 8),
      result = ((value % modulus) + modulus) % modulus;
    this.flag(1, carry);
    this.flag(0x800, overflow);
    this.flag(0x40, result === 0);
    this.flag(0x80, result >= modulus / 2);
    let parity = result & 255;
    parity ^= parity >> 4;
    parity ^= parity >> 2;
    parity ^= parity >> 1;
    this.flag(4, !(parity & 1));
    return result;
  }
  private push(value: number) {
    this.setReg('sp', this.reg('sp') - 2);
    const at = this.reg('ss') * 16 + this.reg('sp');
    this.ram[at] = value;
    this.ram[at + 1] = value >> 8;
  }
  private pop() {
    const at = this.reg('ss') * 16 + this.reg('sp'),
      value = this.ram[at] | (this.ram[at + 1] << 8);
    this.setReg('sp', this.reg('sp') + 2);
    return value;
  }
  private condition(op: string) {
    const c = this.bit(1),
      z = this.bit(0x40),
      s = this.bit(0x80),
      o = this.bit(0x800),
      p = this.bit(4);
    const tests: Record<string, boolean> = {
      je: z,
      jz: z,
      jne: !z,
      jnz: !z,
      jb: c,
      jc: c,
      jnae: c,
      jae: !c,
      jnc: !c,
      jnb: !c,
      jbe: c || z,
      jna: c || z,
      ja: !c && !z,
      jnbe: !c && !z,
      jl: s !== o,
      jnge: s !== o,
      jge: s === o,
      jnl: s === o,
      jle: z || s !== o,
      jng: z || s !== o,
      jg: !z && s === o,
      jnle: !z && s === o,
      js: s,
      jns: !s,
      jo: o,
      jno: !o,
      jp: p,
      jpe: p,
      jnp: !p,
      jpo: !p,
      jcxz: this.reg('cx') === 0,
    };
    if (!(op in tests)) throw new Error(`Condición nativa pendiente: ${op}`);
    return tests[op];
  }
  private interrupt(number: number) {
    if (number !== 0x21) throw new Error(`Interrupción nativa no permitida: ${number}`);
    const ah = this.reg('ah');
    if (ah === 0x3d) {
      let name = '';
      for (let i = 0; i < 80; i++) {
        const ch = this.ram[this.reg('ds') * 16 + ((this.reg('dx') + i) & 65535)];
        if (!ch) break;
        name += String.fromCharCode(ch);
      }
      name = name.replaceAll('\\', '/').split('/').at(-1)!.toUpperCase();
      const file = this.profile.files[name];
      if (!file) throw new Error(`Banco no verificado: ${name}`);
      this.inputFile = file;
      this.inputPosition = 0;
      this.setReg('ax', 10);
    } else if (ah === 0x3f) {
      const bytes = this.inputFile.slice(this.inputPosition, this.inputPosition + this.reg('cx'));
      this.ram.set(bytes, this.reg('ds') * 16 + this.reg('dx'));
      this.inputPosition += bytes.length;
      this.setReg('ax', bytes.length);
    } else if (ah === 0x48) this.setReg('ax', 0x9000);
    else if (![0x3e, 0x49].includes(ah))
      throw new Error(`Servicio DOS nativo pendiente: ${ah.toString(16)}`);
    this.flag(1, false);
  }
  call(address: number, registers: Record<string, number> = {}) {
    Object.assign(
      this.registers,
      { cs: 0x1000, ds: 0x1f31, es: 0x1f31, ss: 0x7000, sp: 0xff00 },
      registers,
    );
    this.push(0xee02);
    this.run(address, 0xf002);
  }
  run(address: number, stop: number) {
    this.ip = address;
    for (let guard = 0; guard < 2_000_000; guard++) {
      if (this.ip === stop || this.pendingRoom !== null) return;
      this.trace?.(this.ip, { ...this.registers }, this.flags);
      if (this.ip === 0x5488) {
        this.sounds.push(this.reg('al'));
        this.ip = this.pop() + 512;
        continue;
      }
      if (this.ip === 0x4cf0) {
        this.pendingRoom = this.reg('bx');
        return;
      }
      if ([0xe096, 0xe27f, 0xe0fb].includes(this.ip)) {
        this.cursor = 'failure';
        this.ip = this.pop() + 512;
        continue;
      }
      if (this.ip === 0x8a6b) this.cursor = 'success';
      if (this.ip === 0x8aa0) this.cursor = 'failure';
      const instruction = this.profile.instructions[this.ip];
      if (!instruction) throw new Error(`Instrucción no verificada: ${this.ip.toString(16)}`);
      const [raw, next, args] = instruction,
        parts = raw.split(' '),
        op = parts.at(-1)!;
      const current = this.ip;
      this.ip = next;
      const a = args[0],
        b = args[1],
        av = a ? this.read(a) : 0,
        bv = b ? this.read(b) : 0;
      const size = a ? this.size(a) : 2,
        modulus = 2 ** (size * 8),
        sign = modulus / 2;
      const jump = () => (av + (a[0] === 'i' ? 0 : 512)) & 65535;
      if (op === 'mov') this.write(a, bv);
      else if (op === 'lea')
        this.write(a, this.offset(b as Extract<NativeOperand, ['m', ...unknown[]]>));
      else if (op === 'xchg') {
        this.write(a, bv);
        this.write(b, av);
      } else if (op === 'push') this.push(av);
      else if (op === 'pop') this.write(a, this.pop());
      else if (['pushf', 'pushfd'].includes(op)) this.push(this.flags);
      else if (['popf', 'popfd'].includes(op)) this.flags = this.pop();
      else if (op === 'call') {
        this.push(next - 512);
        this.ip = jump();
      } else if (op === 'ret') {
        this.ip = this.pop() + 512;
        if (a) this.setReg('sp', this.reg('sp') + av);
      } else if (op === 'jmp') this.ip = jump();
      else if (op.startsWith('j')) {
        if (this.condition(op)) this.ip = jump();
      } else if (op.startsWith('loop')) {
        this.setReg('cx', this.reg('cx') - 1);
        if (
          this.reg('cx') &&
          (op === 'loop' || (op === 'loope' ? this.bit(0x40) : !this.bit(0x40)))
        )
          this.ip = jump();
      } else if (['add', 'adc', 'sub', 'sbb', 'cmp', 'inc', 'dec', 'neg'].includes(op)) {
        const previousCarry = this.bit(1),
          subtract = ['sub', 'sbb', 'cmp', 'dec', 'neg'].includes(op);
        const lhs = op === 'neg' ? 0 : av,
          rhs = ['inc', 'dec'].includes(op) ? 1 : op === 'neg' ? av : bv;
        const extra = ['adc', 'sbb'].includes(op) && previousCarry ? 1 : 0,
          result = lhs + (subtract ? -(rhs + extra) : rhs + extra);
        const truncated = this.arithmetic(
          result,
          size,
          subtract ? lhs < rhs + extra : result >= modulus,
          subtract
            ? !!((lhs ^ rhs) & (lhs ^ result) & sign)
            : !!(~(lhs ^ rhs) & (lhs ^ result) & sign),
        );
        if (['inc', 'dec'].includes(op)) this.flag(1, previousCarry);
        if (op !== 'cmp') this.write(a, truncated);
      } else if (['and', 'or', 'xor', 'test'].includes(op)) {
        const value = op === 'or' ? av | bv : op === 'xor' ? av ^ bv : av & bv;
        const result = this.arithmetic(value, size, false, false);
        if (op !== 'test') this.write(a, result);
      } else if (op === 'not') this.write(a, ~av & (modulus - 1));
      else if (['shl', 'sal', 'shr', 'sar', 'rol', 'ror', 'rcl', 'rcr'].includes(op)) {
        let value = av;
        const count = bv & 31;
        for (let n = 0; n < count; n++) {
          const carry = this.bit(1),
            left = ['shl', 'sal', 'rol', 'rcl'].includes(op),
            bit = left ? !!(value & sign) : !!(value & 1);
          if (left)
            value = (value * 2 + (op === 'rol' ? +bit : op === 'rcl' ? +carry : 0)) % modulus;
          else
            value =
              Math.floor(value / 2) +
              (op === 'ror'
                ? +bit * sign
                : op === 'rcr'
                  ? +carry * sign
                  : op === 'sar' && value & sign
                    ? sign
                    : 0);
          this.flag(1, bit);
        }
        if (count) {
          const c = this.bit(1);
          if (!['rol', 'ror', 'rcl', 'rcr'].includes(op))
            this.arithmetic(
              value,
              size,
              c,
              count === 1
                ? op === 'shr'
                  ? !!(av & sign)
                  : op === 'sar'
                    ? false
                    : !!(value & sign) !== c
                : this.bit(0x800),
            );
          this.write(a, value);
        }
      } else if (op === 'mul' || op === 'imul') {
        const signed = op === 'imul',
          factor = (v: number) => (signed ? this.signed(v, size) : v);
        if (args.length > 1) {
          const value =
            factor(args.length > 2 ? bv : av) * factor(args.length > 2 ? this.read(args[2]) : bv);
          this.write(a, value);
          this.flag(1, value < -sign || value >= sign);
          this.flag(0x800, this.bit(1));
        } else {
          const value = factor(this.reg(size === 1 ? 'al' : 'ax')) * factor(av);
          this.setReg('ax', value);
          if (size === 2) this.setReg('dx', Math.floor(value / 65536));
          this.flag(1, signed ? value < -sign || value >= sign : value >= modulus);
          this.flag(0x800, this.bit(1));
        }
      } else if (op === 'div' || op === 'idiv') {
        let numerator = size === 1 ? this.reg('ax') : this.reg('dx') * 65536 + this.reg('ax');
        if (op === 'idiv') numerator = this.signed(numerator, size * 2);
        const denominator = op === 'idiv' ? this.signed(av, size) : av;
        if (!denominator) throw new Error('División nativa por cero');
        this.setReg(size === 1 ? 'al' : 'ax', Math.trunc(numerator / denominator));
        this.setReg(size === 1 ? 'ah' : 'dx', numerator % denominator);
      } else if (['cbw', 'cwde'].includes(op)) this.setReg('ax', this.signed(this.reg('al'), 1));
      else if (['cwd', 'cdq'].includes(op)) this.setReg('dx', this.reg('ax') & 32768 ? 65535 : 0);
      else if (op === 'clc') this.flag(1, false);
      else if (op === 'stc') this.flag(1, true);
      else if (op === 'cmc') this.flag(1, !this.bit(1));
      else if (op === 'cld' || op === 'std') this.flag(0x400, op === 'std');
      else if (op === 'xlatb')
        this.setReg(
          'al',
          this.ram[this.reg('ds') * 16 + ((this.reg('bx') + this.reg('al')) & 65535)],
        );
      else if (op === 'int') this.interrupt(av);
      else if (
        ['lodsb', 'lodsw', 'stosb', 'stosw', 'movsb', 'movsw', 'scasb', 'scasw'].includes(op)
      ) {
        const bytes = op.endsWith('b') ? 1 : 2,
          repeat = parts.length > 1,
          delta = this.bit(0x400) ? -bytes : bytes;
        let count = repeat ? this.reg('cx') : 1;
        while (count-- > 0) {
          const src = this.reg('ds') * 16 + this.reg('si'),
            dst = this.reg('es') * 16 + this.reg('di');
          const value = this.ram[src] | (bytes === 2 ? this.ram[src + 1] << 8 : 0);
          if (op.startsWith('lods')) this.setReg(bytes === 1 ? 'al' : 'ax', value);
          if (op.startsWith('stos') || op.startsWith('movs')) {
            const v = op.startsWith('stos') ? this.reg('ax') : value;
            this.ram[dst] = v;
            if (bytes === 2) this.ram[dst + 1] = v >> 8;
          }
          if (op.startsWith('scas')) {
            const v = this.ram[dst] | (bytes === 2 ? this.ram[dst + 1] << 8 : 0),
              lhs = this.reg(bytes === 1 ? 'al' : 'ax');
            this.arithmetic(
              lhs - v,
              bytes,
              lhs < v,
              !!((lhs ^ v) & (lhs ^ (lhs - v)) & (2 ** (bytes * 8 - 1))),
            );
          }
          if (op.startsWith('lods') || op.startsWith('movs'))
            this.setReg('si', this.reg('si') + delta);
          if (!op.startsWith('lods')) this.setReg('di', this.reg('di') + delta);
          if (repeat) this.setReg('cx', this.reg('cx') - 1);
          if (
            repeat &&
            op.startsWith('scas') &&
            (parts[0] === 'repne' ? this.bit(0x40) : !this.bit(0x40))
          )
            break;
        }
      } else if (!['nop', 'cli', 'sti', 'wait'].includes(op))
        throw new Error(`Operación nativa pendiente: ${raw} @${current.toString(16)}`);
    }
    throw new Error('Rutina nativa excede el límite de instrucciones');
  }
  action(command: ActionCommand) {
    const addresses: Record<string, number> = {
      take: 0x583a,
      look: 0x3a4a,
      talk: 0x34de,
      use: 0x3d53,
      fight: 0x31ca,
      jump: 0x3343,
    };
    const address = addresses[command.kind];
    if (!address) return;
    this.sounds = [];
    this.cursor = 'failure';
    this.setWord(0xb620, (command.item ?? 0) + (command.kind === 'talk' ? 23 : 26));
    this.setWord(0xb634, command.verb ?? 0);
    this.setWord(0xb638, command.other ?? 65535);
    this.call(address, { bx: 0 });
  }
  walk(x: number, y: number) {
    if (!this.byte(0x3594) || !this.byte(0x3596)) return;
    this.cursor = 'normal';
    this.setWord(0x9978, 0);
    this.setWord(0x997a, x);
    this.setWord(0x997c, y);
    this.setWord(0xdfa, 0x9978);
    this.call(0x115f, { si: 0x9978 });
  }
  tick() {
    this.sounds = [];
    this.setWord(0xae6, this.word(0x2c2d));
    this.setWord(0xae8, this.word(0x2c2f));
    this.run(0xb6d, 0xc59);
    this.run(0x85de, 0x8a21);
    // 0xC5C: F6 solicita una sala al terminar el programa de actor.
    if (this.byte(0x9975) !== 255) {
      this.pendingRoom = this.byte(0x9975);
      this.setByte(0x9975, 255);
      return;
    }
    if (this.byte(0x3596)) this.run(0xc78, 0xda6);
    if (this.pendingRoom === null) this.call(0x12ec);
  }
  actors() {
    return Array.from({ length: 69 }, (_, i) =>
      Array.from(this.ram.slice(0x1f310 + 0x2c2b + i * 33, 0x1f310 + 0x2c2b + (i + 1) * 33)),
    );
  }
}
