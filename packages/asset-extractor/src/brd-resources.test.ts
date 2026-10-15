import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBrd, readBrdIndex, readLogicalRooms } from './brd-resources.js';

test('BRD valid prefix preserves original frame bytes and reports an invalid tail', () => {
  const data = Buffer.alloc(48);
  data.writeUInt16LE(1, 0);
  data.writeUInt16LE(0x3f00, 2);
  data.writeUInt16LE(4, 16);
  data.writeUInt16LE(1, 18);
  data.writeUInt16LE(9, 20);
  data.writeUInt16LE(6, 22);
  data.writeUInt16LE(3, 24);
  for (let plane = 0; plane < 4; plane++) data.set([1, 192 + plane, 0], 26 + plane * 3);
  const before = Buffer.from(data);
  const result = decodeBrd(data, 'synthetic.BRD');
  assert.equal(result.frames.length, 1);
  assert.equal(result.issues[0].index, 1);
  assert.deepEqual(
    [...result.frames[0].pixels],
    [192, 192, 192, 255, 193, 193, 193, 255, 194, 194, 194, 255, 195, 195, 195, 255],
  );
  assert.deepEqual(data, before);
  assert.throws(() => readBrdIndex(Buffer.alloc(8)), /Truncated/);
  assert.throws(() => readLogicalRooms(Buffer.alloc(64)), /revision/);
});
