import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSceneObjects, readIconContext } from './icon-context.js';
import { colorContextPixels, colorSharedPixels } from './shared-palette.js';

test('scene object ID comes from attributes +4, distinct from scene sprite index', () => {
  const data = Buffer.alloc(128);
  data[32] = 1;
  data[34] = 5;
  data.writeUInt16LE(202, 35);
  data.writeUInt16LE(152, 37);
  data.writeUInt16LE(64, 39);
  data.writeUInt16LE(175, 84); // dataBase 16 + attributes pointer 64 +4.
  data[41] = 0; // Scenery has no attributes pointer to dereference.
  data.writeUInt16LE(65535, 48);
  data[50] = 255;
  assert.deepEqual(parseSceneObjects(data, 16, 16, 70), [
    {
      resourceId: 70,
      recordFileOffset: 32,
      attributesFileOffset: 80,
      objectId: 175,
      sceneSpriteIndex: 5,
      x: 202,
      y: 152,
    },
  ]);
  assert.throws(() => parseSceneObjects(Buffer.alloc(8), 0, 0, 0), /Truncated/);
  assert.throws(() => parseSceneObjects(Buffer.alloc(9), 0, 0, 0), /Unterminated/);
  const invalid = Buffer.alloc(10);
  invalid[0] = 1;
  invalid.writeUInt16LE(200, 7);
  assert.throws(() => parseSceneObjects(invalid, 0, 0, 0), /attributes/);
  assert.throws(() => readIconContext(Buffer.alloc(64), 159), /revision/);
});
test('context palette changes scene pixels while preserving shared pixels and alpha', () => {
  const indexed = Buffer.from([82, 82, 82, 255, 192, 192, 192, 255, 0, 0, 0, 0]);
  const first = Buffer.alloc(768);
  first[192 * 3 + 1] = 63;
  first[82 * 3] = 63;
  const second = Buffer.from(first);
  second[82 * 3] = 0;
  second[82 * 3 + 2] = 63;
  const a = colorContextPixels(indexed, first),
    b = colorContextPixels(indexed, second);
  assert.deepEqual(a.subarray(0, 4), Buffer.from([255, 0, 0, 255]));
  assert.deepEqual(b.subarray(0, 4), Buffer.from([0, 0, 255, 255]));
  assert.deepEqual(a.subarray(4), b.subarray(4));
  assert.throws(() => colorSharedPixels(indexed, first), /context/);
  assert.throws(() => colorContextPixels(indexed, Buffer.alloc(767)), /palette/);
  const invalid = Buffer.from(first);
  invalid[0] = 64;
  assert.throws(() => colorContextPixels(indexed, invalid), /palette/);
});
