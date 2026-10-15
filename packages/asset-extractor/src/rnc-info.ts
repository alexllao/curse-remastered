import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const input = process.argv[2] ?? 'original/DATA/TITLE.DAT';
const path = isAbsolute(input) ? input : resolve(root, input);
const data = await readFile(path);
if (data.length < 18 || data.toString('ascii', 0, 3) !== 'RNC') {
  throw new Error('Not an RNC file (expected 18-byte RNC header)');
}
const method = data[3];
const unpackedSize = data.readUInt32BE(4);
const packedSize = data.readUInt32BE(8);
const unpackedCrc = data.readUInt16BE(12);
const packedCrc = data.readUInt16BE(14);
const leeway = data[16];
const chunks = data[17];
if (packedSize > data.length - 18) throw new Error('RNC payload exceeds file size');
const crc16 = (bytes: Uint8Array) => {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
};
const actualPackedCrc = crc16(data.subarray(18, 18 + packedSize));
console.log(
  JSON.stringify(
    {
      path: input,
      method,
      unpackedSize,
      packedSize,
      headerBytes: 18,
      unpackedCrc: unpackedCrc.toString(16).padStart(4, '0'),
      packedCrc: packedCrc.toString(16).padStart(4, '0'),
      actualPackedCrc: actualPackedCrc.toString(16).padStart(4, '0'),
      packedCrcValid: packedCrc === actualPackedCrc,
      leeway,
      chunks,
      likelyVga320x200: unpackedSize === 320 * 200,
    },
    null,
    2,
  ),
);
