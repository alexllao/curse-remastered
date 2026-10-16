import test from 'node:test';
import assert from 'node:assert/strict';
import { hudCursorPosition } from '../src/hud-cursor.ts';

test('el HUD superior e inferior limitan la mano completa y al cerrar liberan el cursor', () => {
  const cursor = { width: 16, height: 18 };
  for (const y of [0, 168]) {
    const hud = { x: 0, y, width: 320, height: 32 };
    assert.deepEqual(hudCursorPosition({ x: -20, y: -50 }, hud, cursor), { x: 0, y });
    assert.deepEqual(hudCursorPosition({ x: 500, y: 300 }, hud, cursor), { x: 304, y: y + 14 });
    assert.deepEqual(hudCursorPosition({ x: 125, y: y + 5 }, hud, cursor), { x: 125, y: y + 5 });
  }
  const free = { x: 40, y: 110 };
  assert.equal(hudCursorPosition(free, null, cursor), free);
});
