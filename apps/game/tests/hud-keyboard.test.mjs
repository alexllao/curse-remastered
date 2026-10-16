import test from 'node:test';
import assert from 'node:assert/strict';
import { hudKeyboardCommand, nextHudSelection } from '../src/hud-keyboard.ts';
import { OriginalActionMenu } from '../../../packages/engine/src/original-action-menu.ts';

function source(blocked = false) {
  const executed = [];
  return {
    executed,
    inventory: () => [1, 3],
    nearby: () => [5],
    vocabulary: () => [0, 1],
    icon: (id) => 26 + id,
    blocked: () => blocked,
    execute: (command) => executed.push(command),
  };
}

test('abrir con teclado, elegir Coger y confirmar el único objeto con Intro', () => {
  const s = source();
  const menu = new OriginalActionMenu(s);
  assert.equal(hudKeyboardCommand('Enter', false), 'open');
  assert.equal(hudKeyboardCommand(' ', false), 'open');
  assert.equal(hudKeyboardCommand('ArrowRight', true), 'next');
  let selected = nextHudSelection(0, 1, menu.cells());
  assert.equal(selected, 1);
  assert.equal(hudKeyboardCommand('Enter', true), 'select');
  assert.equal(menu.select(selected), false);
  // El foco entra en la primera casilla del submenú, sin quedarse en una casilla vacía.
  selected = nextHudSelection(-1, 1, menu.cells());
  assert.equal(selected, 0);
  assert.equal(menu.select(selected), true);
  assert.deepEqual(s.executed, [{ kind: 'take', item: 5 }]);
});

test('la navegación recorre las opciones válidas y salta las bloqueadas', () => {
  const menu = new OriginalActionMenu(source(true));
  assert.equal(nextHudSelection(0, 1, menu.cells()), 3);
  assert.equal(nextHudSelection(9, 1, menu.cells()), 0);
  assert.equal(nextHudSelection(0, -1, menu.cells()), 9);
  assert.equal(nextHudSelection(0, 1, []), 0);
  assert.equal(hudKeyboardCommand('Tab', true, true), 'previous');
  assert.equal(hudKeyboardCommand('Tab', true), 'next');
  assert.equal(hudKeyboardCommand('Escape', true), 'back');
  assert.equal(hudKeyboardCommand('a', true), null);
});

test('Escape retrocede por verbos, primer objeto y destinos sin ejecutar acciones', () => {
  const s = source();
  const menu = new OriginalActionMenu(s);
  menu.select(2); // Verbos.
  const verbs = menu.cells();
  menu.select(0); // Usar: elegir primer objeto.
  const firstTargets = menu.cells();
  menu.select(1); // Primer objeto escogido.
  assert.ok(menu.cells().some((cell) => cell.blocked));
  assert.equal(menu.back(), true);
  assert.deepEqual(menu.cells(), firstTargets);
  assert.equal(menu.back(), true);
  assert.deepEqual(menu.cells(), verbs);
  assert.equal(menu.back(), true);
  assert.equal(menu.cells().length, 10);
  assert.equal(menu.back(), false);
  assert.deepEqual(s.executed, []);
  menu.select(1);
  menu.reset();
  assert.equal(menu.back(), false);
});
