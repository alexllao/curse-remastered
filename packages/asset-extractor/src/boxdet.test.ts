import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoxdet } from './boxdet.js';

test('BOXDET rejects truncated pointers and records and preserves signed coordinates', () => {
  const data = Buffer.alloc(170);
  data.writeUInt16LE(158, 0);
  data.writeUInt16LE(1, 158);
  data[160] = 3;
  data[161] = 9;
  [-5, 8, 100, 199].forEach((n, i) => data.writeInt16LE(n, 162 + i * 2));
  assert.deepEqual(readBoxdet(data, 0).records[0], {
    index: 0,
    fileOffset: 160,
    type: 3,
    argument: 9,
    left: -5,
    top: 8,
    right: 100,
    bottom: 199,
  });
  assert.deepEqual(readBoxdet(data, 1).records, []);
  assert.throws(() => readBoxdet(data.subarray(0, 169), 0), /Truncated/);
  data.writeUInt16LE(169, 0);
  assert.throws(() => readBoxdet(data, 0), /pointer/);
  for (const id of [-1, 78, 0.5]) assert.throws(() => readBoxdet(data, id), /resource/);
});
