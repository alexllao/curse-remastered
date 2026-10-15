import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const target = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-decoded');
const data = await readFile(source);
if (data.length < 16) throw new Error('SPR file too short');
const first = data.readUInt16LE(0) * 16;
if (first < 16 || first > data.length || first % 2 !== 0) throw new Error('Invalid SPR index');
const starts: number[] = [];
for (let i = 0; i < first; i += 2) {
  const unit = data.readUInt16LE(i);
  // The offset table may end with zero padding up to the first 16-byte block.
  if (unit === 0) break;
  const start = unit * 16;
  if (start < first || start >= data.length || (starts.length && start <= starts[starts.length - 1])) throw new Error('Invalid sprite offset table');
  starts.push(start);
}
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name: string, payload: Buffer): Buffer {
  const tag = Buffer.from(name, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(payload.length);
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([len, tag, payload, sum]);
}
function png(width: number, height: number, pixels: Buffer): Buffer {
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) pixels.copy(scanlines, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}
await mkdir(target, { recursive: true });
const stats = [];
for (let index = 0; index < starts.length; index++) {
  const start = starts[index], end = starts[index + 1] ?? data.length;
  if (start + 10 > end) throw new Error('Truncated sprite header at ' + index);
  const width = data.readUInt16LE(start), height = data.readUInt16LE(start + 2);
  if (!width || !height || width > 4096 || height > 4096) throw new Error('Invalid dimensions at sprite ' + index);
  const offsets = [0, data.readUInt16LE(start + 8), data.readUInt16LE(start + 6), data.readUInt16LE(start + 4)];
  const positions = offsets.map(offset => start + 10 + offset);
  if (positions.some((p, i) => p >= end || (i > 0 && p <= positions[i - 1]))) throw new Error('Invalid VGA plane offsets at sprite ' + index);
  const rgba = Buffer.alloc(width * height * 4);
  let painted = 0;
  for (let plane = 0; plane < 4; plane++) {
    let position = positions[plane];
    const limit = positions[plane + 1] ?? end;
    for (let y = 0; y < height; y++) {
      let x = plane;
      let terminated = false;
      while (position < limit) {
        let count = data.readInt8(position++);
        if (count === 0) { terminated = true; break; }
        if (count < 0) {
          x += -count * 4;
          if (position >= limit) throw new Error('Truncated run count at sprite ' + index);
          count = data[position++];
        }
        if (position + count > limit) throw new Error('Truncated color run at sprite ' + index);
        for (let n = 0; n < count; n++) {
          if (x >= 0 && x < width) {
            const pixel = (y * width + x) * 4;
            const colorIndex = data[position + n];
            rgba[pixel] = colorIndex; rgba[pixel + 1] = colorIndex; rgba[pixel + 2] = colorIndex; rgba[pixel + 3] = 255;
            painted++;
          }
          x += 4;
        }
        position += count;
      }
      if (!terminated) throw new Error('Unterminated row at sprite ' + index + ', plane ' + plane + ', row ' + y);
    }
    // DOS renderer may leave alignment/padding after the last scanline.
    if (position > limit) throw new Error('Plane boundary exceeded at sprite ' + index);
  }
  const filename = 'sprite-' + String(index).padStart(3, '0') + '.png';
  await writeFile(join(target, filename), png(width, height, rgba));
  stats.push({ index, width, height, paintedPixels: painted, planeOffsets: offsets, filename });
}
await writeFile(join(target, 'manifest.json'), JSON.stringify({
  source: basename(source),
  algorithm: 'Verified against CURSE.EXE x86 sprite renderer at file offset 0x718c: 4 VGA planes, signed skip/copy scanline RLE.',
  color: 'Grayscale palette indices only; original RGB palette not yet applied.',
  sprites: stats,
}, null, 2) + '\n');
console.log(JSON.stringify({ output: target, decoded: stats.length, first: stats[0], note: 'Original palette not yet applied' }, null, 2));
