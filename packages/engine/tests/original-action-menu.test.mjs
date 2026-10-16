import test from 'node:test';
import assert from 'node:assert/strict';
import { OriginalActionMenu } from '../src/original-action-menu.ts';

function fixture(blocked = false) {
  const commands = [];
  const masks = [];
  const menu = new OriginalActionMenu({
    inventory: () => [1, 3],
    nearby: (mask) => {
      masks.push(mask);
      return [0, 2, 4];
    },
    vocabulary: () => [1, 0],
    icon: (item) => 26 + item,
    blocked: () => blocked,
    execute: (command) => commands.push(command),
  });
  return { menu, commands, masks };
}

test('las acciones bloqueadas no cambian de menú ni ejecutan órdenes', () => {
  const { menu, commands } = fixture(true);
  assert.equal(menu.select(1), false);
  assert.equal(menu.select(2), false);
  assert.equal(menu.select(99), false);
  assert.equal(menu.cells().length, 10);
  assert.deepEqual(commands, []);
});

test('el inventario es consultivo y ayuda conserva su posición tras saludo', () => {
  const { menu, commands } = fixture();
  menu.select(0);
  assert.deepEqual(
    menu.cells().map((cell) => cell.value),
    [1, 3],
  );
  menu.select(0);
  assert.equal(menu.cells().length, 10);
  menu.select(4);
  assert.deepEqual(
    menu.cells().map((cell) => cell.icon),
    [24, 23],
  );
  assert.equal(menu.select(1), true);
  assert.deepEqual(commands, [{ kind: 'talk', item: 0 }]);
});

test('desbloquear admite escoger llave primero o cadenas primero', () => {
  for (const inventoryFirst of [true, false]) {
    const { menu, commands } = fixture();
    menu.select(2);
    menu.select(0);
    if (inventoryFirst) {
      menu.select(0); // Inventario.
      menu.select(0); // Llave.
      menu.select(1); // Cadenas.
    } else {
      menu.select(1); // Cadenas.
      assert.equal(menu.cells()[1].blocked, true);
      assert.equal(menu.select(1), false); // Impide usar el objeto consigo mismo.
      menu.select(0); // Inventario.
      menu.select(0); // Llave.
    }
    assert.deepEqual(commands, [
      { kind: 'use', verb: 0, item: inventoryFirst ? 0 : 1, other: inventoryFirst ? 1 : 0 },
    ]);
  }
});

test('recoger, mirar y saltar consultan máscaras diferentes; empujar solo requiere un objeto', () => {
  const { menu, commands, masks } = fixture();
  for (const [icon, mask] of [
    [1, 2],
    [3, 1],
    [6, 5],
  ]) {
    menu.reset();
    menu.select(icon);
    menu.cells();
    assert.equal(masks.at(-1), mask);
  }
  menu.reset();
  menu.select(2);
  menu.select(2);
  assert.equal(menu.select(2), true);
  assert.deepEqual(commands, [{ kind: 'use', verb: 2, item: 2, other: undefined }]);
});
