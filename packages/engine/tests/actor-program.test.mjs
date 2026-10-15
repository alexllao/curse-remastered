import test from 'node:test';
import assert from 'node:assert/strict';
import { tickOriginalActors } from '../src/actor-program.ts';
function fixture(program) {
  const actors = Array.from({ length: 69 }, () => Array(33).fill(0));
  const actor = actors[0];
  actor[0] = 1;
  actor[16] = 1;
  actor[19] = actor[20] = 1;
  return {
    actors,
    programs: [0, ...program],
    seed: [1, 2, 3, 4],
    firstFreeSlot: 2,
    dimensions: { '0:1': [16, 24] },
    controls: [0, 0, 0],
    bank: 0,
    collision: 0,
    pendingRoom: null,
    sounds: [],
  };
}
test('el control de clic no habilita caminar durante la entrada encadenada', () => {
  const state = fixture([252, 124]);
  tickOriginalActors(state);
  assert.deepEqual(state.controls, [0, 1, 0]);
  assert.equal(state.actors[0][16], 0);
});
test('un periodo cero desborda el contador y espera 256 ciclos', () => {
  const state = fixture([122, 0, 1, 124]);
  tickOriginalActors(state);
  assert.equal(state.actors[0][1], 1);
  tickOriginalActors(state);
  assert.equal(state.actors[0][19], 255);
  assert.equal(state.actors[0][16], 1);
  for (let i = 0; i < 255; i++) tickOriginalActors(state);
  assert.equal(state.actors[0][16], 0);
});
test('ocultar y volver a mostrar no cambia el fotograma ni mueve el actor', () => {
  const state = fixture([254, 255, 124]);
  state.actors[0][2] = 125;
  state.actors[0][4] = 98;
  tickOriginalActors(state);
  assert.equal(state.actors[0][0], 3);
  tickOriginalActors(state);
  assert.equal(state.actors[0][0], 1);
  assert.equal(state.actors[0][2], 125);
  assert.equal(state.actors[0][4], 98);
  assert.equal(state.actors[0][1], 0);
});
