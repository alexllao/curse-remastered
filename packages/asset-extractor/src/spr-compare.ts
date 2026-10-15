import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const target = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-compare.png');
const data = await readFile(source);
const indexBytes = data.readUInt16LE(0) * 16;
const offsets: number[] = [];
for (let i = 0; i + 1 < indexBytes; i += 2) {
  const value = data.readUInt16LE(i);
  if (!value) break;
  offsets.push(value * 16);
}
type Run = { prefix: number; pixels: number[] };
type Parsed = { runs: Run[]; skipped: number };
function parse(from: number, to: number, mode: 'scan' | 'aligned'): Parsed {
  const runs: Run[] = [];
  let skipped = 0;
  for (let p = from; p + 2 < to;) {
    if (data[p] !== 0) { p++; skipped++; continue; }
    let countAt = p + 1;
    let prefix = 0;
    if (data[countAt] === 255) { prefix = -1; countAt++; }
    const count = data[countAt];
    if (count === 0 || count > 192 || countAt + 1 + count > to) { p++; skipped++; continue; }
    if (mode === 'aligned' && count > 64) { p++; skipped++; continue; }
    runs.push({ prefix, pixels: [...data.subarray(countAt + 1, countAt + 1 + count)] });
    p = countAt + 1 + count;
  }
  return { runs, skipped };
}
function crc(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, bytes: Buffer): Buffer {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4); len.writeUInt32BE(bytes.length);
  const check = Buffer.alloc(4); check.writeUInt32BE(crc(Buffer.concat([name, bytes])));
  return Buffer.concat([len, name, bytes, check]);
}
const selected = [0, 1, 4, 6, 7, 9, 12, 16, 21];
const modes = ['one-run-per-row', 'wrap-to-width', 'fixed-runs-per-row'] as const;
const scale = 3, cellW = 560, cellH = 330;
const width = cellW * modes.length, height = cellH * selected.length;
const rgba = Buffer.alloc(width * height * 4);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  const pos = (y * width + x) * 4;
  const check = (Math.floor(x / 12) + Math.floor(y / 12)) % 2;
  rgba[pos] = rgba[pos + 1] = rgba[pos + 2] = check ? 42 : 55;
  rgba[pos + 3] = 255;
}
function plot(x: number, y: number, color: number) {
  if (x < 0 || y < 0 || x + scale > width || y + scale > height) return;
  for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
    const p = ((y + dy) * width + x + dx) * 4;
    rgba[p] = color; rgba[p + 1] = color; rgba[p + 2] = color;
  }
}
const stats: unknown[] = [];
for (let row = 0; row < selected.length; row++) {
  const index = selected[row], start = offsets[index], end = offsets[index + 1] ?? data.length;
  const w = data.readUInt16LE(start), h = data.readUInt16LE(start + 2);
  const { runs, skipped } = parse(start + 10, end, 'scan');
  const info: Record<string, unknown> = { index, widthCandidate: w, heightCandidate: h, runs: runs.length, skipped };
  for (let column = 0; column < modes.length; column++) {
    const mode = modes[column];
    const originX = column * cellW + 12, originY = row * cellH + 12;
    let x = 0, y = 0, painted = 0;
    const runsPerRow = Math.max(1, Math.round(runs.length / Math.max(1, h)));
    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      if (mode === 'one-run-per-row') { y = i; x = Math.max(0, Math.floor((w - run.pixels.length) / 2)); }
      else if (mode === 'fixed-runs-per-row') {
        if (i % runsPerRow === 0) { y = Math.floor(i / runsPerRow); x = 0; }
      } else if (x + run.pixels.length > w) { x = 0; y++; }
      if (y >= h || y >= 100) break;
      for (const value of run.pixels) {
        if (x >= 0 && x < w && x < 175) { plot(originX + x * scale, originY + y * scale, value); painted++; }
        x++;
      }
    }
    info[mode] = { painted, rowsUsed: Math.min(y + 1, h) };
  }
  stats.push(info);
}
const raw = Buffer.alloc(height * (width * 4 + 1));
for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
await mkdir(dirname(target), { recursive: true });
await writeFile(target, png);
await writeFile(target.replace(/\.png$/i, '.json'), JSON.stringify({ warning: 'All three layouts are UNVERIFIED hypotheses; palette shown as grayscale indices.', columns: modes, rows: selected, stats }, null, 2) + '\n');
console.log(JSON.stringify({ image: target, columns: modes, rows: selected, note: 'Comparison only, not a validated decoder' }, null, 2));
