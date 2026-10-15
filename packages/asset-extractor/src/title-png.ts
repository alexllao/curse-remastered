import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { unpackRnc1 } from './rnc1.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pathFromRoot = (path: string): string => isAbsolute(path) ? path : resolve(root, path);
const input = pathFromRoot(process.argv[2] ?? 'original/DATA/TITLE.DAT');
const palettePath = pathFromRoot(process.argv[3] ?? 'original/DATA/TITLE.PAL');
const outputPath = pathFromRoot(process.argv[4] ?? 'reports/TITLE.png');

const pixels = unpackRnc1(await readFile(input));
const palette = await readFile(palettePath);
const width = 320;
const height = 200;
if (pixels.length !== width * height) throw new Error('Expected a 320x200 indexed image');
if (palette.length !== 768) throw new Error('Expected a 768-byte VGA palette');

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, payload: Buffer): Buffer => {
  const name = Buffer.from(type, 'ascii');
  const size = Buffer.alloc(4);
  size.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([size, name, payload, checksum]);
};
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8; // 8-bit indexed
header[9] = 3; // PNG indexed-color mode
const rgb = Buffer.from(palette.map((value) => Math.round(value * 255 / 63)));
const scanlines = Buffer.alloc(height * (width + 1));
for (let row = 0; row < height; row++) {
  scanlines.set(pixels.subarray(row * width, (row + 1) * width), row * (width + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('PLTE', rgb),
  chunk('IDAT', deflateSync(scanlines)),
  chunk('IEND', Buffer.alloc(0)),
]);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, png);
console.log(`Created ${outputPath} (${width}x${height}, verified RNC1 CRC)`);
