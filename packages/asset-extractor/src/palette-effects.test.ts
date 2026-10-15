import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceSelector, fadePaletteFrame } from './palette-effects.js';

test('fade preserves the input, starts unchanged and ends black', () => {
  const source = Buffer.from(Array.from({ length: 768 }, (_, index) => index % 64));
  const copy = Buffer.from(source);
  assert.deepEqual(fadePaletteFrame(source, 0), source);
  assert.deepEqual(fadePaletteFrame(source, 32), Buffer.alloc(768));
  assert.deepEqual(source, copy);
  assert.equal(fadePaletteFrame(Buffer.alloc(768, 2), 1)[0], 1);
  assert.equal(fadePaletteFrame(Buffer.alloc(768, 63), 16)[0], 31);
  assert.throws(() => fadePaletteFrame(source, -1), /step/);
  assert.throws(() => fadePaletteFrame(source, 33), /step/);
  assert.throws(() => fadePaletteFrame(source, 1.5), /step/);
  assert.throws(() => fadePaletteFrame(Buffer.alloc(767), 1), /RGB6/);
  assert.throws(() => fadePaletteFrame(Buffer.alloc(768, 64), 1), /RGB6/);
});

test('selector follows DEC/JA including incoming carry and 16-bit wrap', () => {
  assert.deepEqual(advanceSelector({ countdown: 4, nextColor: 8 }, false), {
    state: { countdown: 3, nextColor: 8 },
  });
  assert.deepEqual(advanceSelector({ countdown: 4, nextColor: 8 }, true), {
    state: { countdown: 4, nextColor: 9 },
    tableIndex: 8,
  });
  assert.deepEqual(advanceSelector({ countdown: 1, nextColor: 23 }, false), {
    state: { countdown: 4, nextColor: 0 },
    tableIndex: 23,
  });
  assert.deepEqual(advanceSelector({ countdown: 0, nextColor: 0 }, false), {
    state: { countdown: 65535, nextColor: 0 },
  });
  assert.throws(() => advanceSelector({ countdown: -1, nextColor: 0 }, false), /state/);
  assert.throws(() => advanceSelector({ countdown: 1, nextColor: 24 }, false), /state/);
});
