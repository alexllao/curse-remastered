import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const target = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-experimental.png');
const data = await readFile(source);
const tableEnd = data.readUInt16LE(0) * 16;
const starts: number[] = [];
for (let p = 0; p + 1 < tableEnd; p += 2) {
  const unit = data.readUInt16LE(p);
  if (!unit) break;
  starts.push(unit * 16);
}
type Run = { shift: number; pixels: number[] };
function scan(start: number, end: number): { runs: Run[]; skipped: number } {
  const runs: Run[] = [];
  let skipped = 0;
  for (let p = start; p + 3 <= end;) {
    // Experimental grammar: 00, signed offset (00 or FF), count, palette indices.
    if (data[p] !== 0 || (data[p + 1] !== 0 && data[p + 1] !== 255)) {
      p++;
      skipped++;
      continue;
    }
    const shift = data[p + 1] === 255 ? -1 : 0;
    const count = data[p + 2];
    if (!count || count > 192 || p + 3 + count > end) {
      p++;
      skipped++;
      continue;
    }
    runs.push({ shift, pixels: [...data.subarray(p + 3, p + 3 + count)] });
    p += 3 + count;
  }
  return { runs, skipped };
}
function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(tag: string, payload: Buffer): Buffer {
  const name = Buffer.from(tag, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, payload])));
  return Buffer.concat([len, name, payload, crc]);
}
const scale = 3;
const cellW = 210,
  cellH = 210,
  columns = 4;
const rows = Math.ceil(starts.length / columns);
const width = cellW * columns,
  height = cellH * rows;
const rgba = Buffer.alloc(width * height * 4);
for (let i = 0; i < rgba.length; i += 4) {
  const cellX = Math.floor(((i / 4) % width) / cellW);
  const cellY = Math.floor(Math.floor(i / 4 / width) / cellH);
  const checker = (Math.floor(((i / 4) % width) / 12) + Math.floor(i / 4 / width / 12)) % 2;
  const shade = checker ? 42 : 55;
  rgba[i] = shade;
  rgba[i + 1] = shade;
  rgba[i + 2] = shade;
  rgba[i + 3] = 255;
  void cellX;
  void cellY;
}
const stats: unknown[] = [];
for (let index = 0; index < starts.length; index++) {
  const start = starts[index],
    end = starts[index + 1] ?? data.length;
  const w = data.readUInt16LE(start),
    h = data.readUInt16LE(start + 2);
  const { runs, skipped } = scan(start + 10, end);
  const ox = (index % columns) * cellW + 8;
  const oy = Math.floor(index / columns) * cellH + 8;
  let drawn = 0;
  // Diagnostic: treat consecutive runs as scanlines, centered in each cell.
  for (let y = 0; y < Math.min(runs.length, 60); y++) {
    const run = runs[y];
    const left = Math.max(0, Math.floor((Math.min(w, 60) - run.pixels.length) / 2) + run.shift);
    for (let x = 0; x < run.pixels.length && x + left < 60; x++) {
      const palette = run.pixels[x];
      // Grayscale index visualization, NOT the game's original palette.
      const px = ox + (left + x) * scale;
      const py = oy + y * scale;
      for (let dy = 0; dy < scale; dy++)
        for (let dx = 0; dx < scale; dx++) {
          if (px + dx >= ox + cellW - 3 || py + dy >= oy + cellH - 3) continue;
          const dest = ((py + dy) * width + px + dx) * 4;
          rgba[dest] = palette;
          rgba[dest + 1] = palette;
          rgba[dest + 2] = palette;
          rgba[dest + 3] = 255;
        }
      drawn++;
    }
  }
  stats.push({
    index,
    dimensionsCandidate: [w, h],
    runs: runs.length,
    skippedBytes: skipped,
    drawnPixels: drawn,
  });
}
const raw = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++)
  rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, png);
await writeFile(
  target.replace(/\.png$/i, '.json'),
  JSON.stringify(
    {
      note: 'UNVERIFIED DIAGNOSTIC: grayscale palette indices and guessed row placement. NOT original sprite art.',
      stats,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    {
      preview: target,
      sprites: starts.length,
      first: stats[0],
      warning: 'Experimental visualization, not a decoded sprite.',
    },
    null,
    2,
  ),
);
