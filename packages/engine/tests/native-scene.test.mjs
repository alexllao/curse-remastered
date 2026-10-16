import test from 'node:test';
import assert from 'node:assert/strict';
import { OriginalSceneMachine } from '../src/native-scene.ts';
const reg = (name) => ['r', name, 2];
const imm = (value) => ['i', value, 2];
const mem = (offset, base = '', segment = '') => ['m', 2, segment, base, '', 1, offset];
function fixture(instructions = {}) {
  const memory = Array(65536).fill(0);
  memory[0x9975] = 255;
  return new OriginalSceneMachine({
    schemaVersion: 1,
    executableSha256: 'synthetic',
    cs: [],
    memory,
    segments: [],
    files: {},
    instructions,
    resourceId: 1,
  });
}
test('el inmediato negativo se normaliza a16bits y conserva el acarreo', () => {
  const vm = fixture({
    1024: ['mov', 1025, [reg('ax'), imm(0)]],
    1025: ['sub', 1026, [reg('ax'), imm(-1)]],
    1026: ['adc', 1027, [reg('bx'), imm(0)]],
    1027: ['ret', 1028, []],
  });
  vm.call(1024);
  assert.equal(vm.registers.ax, 1);
  assert.equal(vm.registers.bx, 1);
  assert.equal(vm.registers.sp, 0xff00);
});
test('CALL indirecto usa IP relativo aCS y restaura la pila', () => {
  const vm = fixture({
    1024: ['mov', 1025, [reg('bx'), imm(1536)]],
    1025: ['call', 1026, [reg('bx')]],
    1026: ['ret', 1027, []],
    2048: ['mov', 2049, [reg('ax'), imm(42)]],
    2049: ['ret', 2050, []],
  });
  vm.call(1024);
  assert.equal(vm.registers.ax, 42);
  assert.equal(vm.registers.sp, 0xff00);
});
test('las direcciones con BP usan SS y las demás DS', () => {
  const vm = fixture({
    1024: ['mov', 1025, [mem(16, 'bp'), imm(321)]],
    1025: ['mov', 1026, [mem(16), imm(654)]],
    1026: ['ret', 1027, []],
  });
  vm.call(1024, { bp: 0 });
  assert.equal(vm.ram[0x70010] | (vm.ram[0x70011] << 8), 321);
  assert.equal(vm.word(16), 654);
});
test('no ejecuta instrucciones ausentes ni abre bancos externos al perfil', () => {
  assert.throws(() => fixture().call(1024), /Instrucción no verificada/);
  const vm = fixture({ 1024: ['int', 1025, [imm(33)]], 1025: ['ret', 1026, []] });
  assert.throws(() => vm.call(1024, { ax: 0x3d00, dx: 0 }), /Banco no verificado/);
});
test('una petición F6 del actor se consume antes de colisiones y callbacks', () => {
  const vm = fixture({
    [0xb6d]: ['jmp', 0xb70, [imm(0xc59)]],
    [0x85de]: [
      'mov',
      0x85df,
      [
        ['m', 1, '', '', '', 1, 0x9975],
        ['i', 2, 1],
      ],
    ],
    [0x85df]: ['jmp', 0x85e0, [imm(0x8a21)]],
  });
  vm.tick();
  assert.equal(vm.pendingRoom, 2);
  assert.equal(vm.byte(0x9975), 255);
});
