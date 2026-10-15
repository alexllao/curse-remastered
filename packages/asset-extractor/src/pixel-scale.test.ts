import test from 'node:test';
import assert from 'node:assert/strict';
import { scale2x } from './pixel-scale.js';

test('Scale2x conserva alfa y colores sin introducir valores interpolados', () => {
  const clear = [0, 0, 0, 0],
    red = [255, 0, 0, 255];
  const pixels = Buffer.from([...clear, ...clear, ...clear, ...red]);
  const output = scale2x(2, 2, pixels);
  assert.equal(output.length, 4 * 4 * 4);
  for (let at = 0; at < output.length; at += 4) {
    const color = [...output.subarray(at, at + 4)];
    assert.ok(
      JSON.stringify(color) === JSON.stringify(clear) ||
        JSON.stringify(color) === JSON.stringify(red),
    );
  }
  assert.deepEqual(scale2x(1, 1, Buffer.from(clear)), Buffer.alloc(16));
  assert.throws(() => scale2x(2, 2, Buffer.alloc(3)));
});

test('Scale2x reconstruye una esquina diagonal en lugar de repetir el centro', () => {
  const red = [255, 0, 0, 255],
    green = [0, 255, 0, 255],
    blue = [0, 0, 255, 255],
    yellow = [255, 255, 0, 255];
  const image = Buffer.from([
    ...red,
    ...red,
    ...blue,
    ...red,
    ...green,
    ...blue,
    ...yellow,
    ...yellow,
    ...blue,
  ]);
  const output = scale2x(3, 3, image);
  const pixel = (x: number, y: number) => [
    ...output.subarray((y * 6 + x) * 4, (y * 6 + x + 1) * 4),
  ];
  assert.deepEqual(pixel(2, 2), red);
  assert.deepEqual(pixel(3, 2), green);
  assert.deepEqual(pixel(2, 3), green);
  assert.deepEqual(pixel(3, 3), green);
});
