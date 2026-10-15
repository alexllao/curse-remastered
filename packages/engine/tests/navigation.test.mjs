import test from 'node:test';
import assert from 'node:assert/strict';
import { containsPoint, moveTowards, facingTowards } from '../src/navigation.ts';

test('la zona transitable incluye bordes y rechaza puntos exteriores', () => {
  const floor = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  for (const point of [
    { x: 5, y: 5 },
    { x: 0, y: 0 },
    { x: 10, y: 4 },
  ])
    assert.equal(containsPoint(floor, point), true);
  for (const point of [
    { x: -1, y: 5 },
    { x: 5, y: 11 },
    { x: NaN, y: 5 },
  ])
    assert.equal(containsPoint(floor, point), false);
});
test('el movimiento diagonal conserva velocidad y no sobrepasa el destino', () => {
  assert.deepEqual(moveTowards({ x: 0, y: 0 }, { x: 3, y: 4 }, 2.5, 1), { x: 1.5, y: 2 });
  assert.deepEqual(moveTowards({ x: 0, y: 0 }, { x: 3, y: 4 }, 20, 1), { x: 3, y: 4 });
  assert.deepEqual(moveTowards({ x: 3, y: 4 }, { x: 3, y: 4 }, 20, 1), { x: 3, y: 4 });
  assert.throws(() => moveTowards({ x: 0, y: 0 }, { x: 3, y: 4 }, 20, -1));
});
test('las cuatro orientaciones se calculan en coordenadas lógicas', () => {
  const at = { x: 5, y: 5 };
  assert.equal(facingTowards(at, { x: 1, y: 5 }), 'left');
  assert.equal(facingTowards(at, { x: 8, y: 5 }), 'right');
  assert.equal(facingTowards(at, { x: 5, y: 1 }), 'up');
  assert.equal(facingTowards(at, { x: 5, y: 9 }), 'down');
});
