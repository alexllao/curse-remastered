import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const source = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const target = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-layout.json');
const data = await readFile(source);
const indexEnd = data.readUInt16LE(0) * 16;
const starts: number[] = [];
for (let p = 0; p + 1 < indexEnd; p += 2) {
  const offset = data.readUInt16LE(p);
  if (offset === 0) break;
  starts.push(offset * 16);
}
const sprites = starts.map((start, index) => {
  const end = starts[index + 1] ?? data.length;
  const size = end - start;
  const words = Array.from({ length: Math.min(8, Math.floor(size / 2)) }, (_, i) => data.readUInt16LE(start + i * 2));
  const [width, height, a, b, c] = words;
  const body = data.subarray(start + 10, end);
  const histogram = Array.from({ length: 256 }, (_, value) => ({ value, count: body.filter(byte => byte === value).length }))
    .filter(item => item.count > 0).sort((x, y) => y.count - x.count).slice(0, 12);
  const markers = [0, 255, 254, 253].map(value => ({
    value, offsets: Array.from(body.keys()).filter(i => body[i] === value).slice(0, 48),
    total: body.filter(byte => byte === value).length,
  }));
  return {
    index, start, end, size, width, height, words,
    bodyFirst64Hex: body.subarray(0, 64).toString('hex'),
    bodyLast32Hex: body.subarray(Math.max(0, body.length - 32)).toString('hex'),
    candidateRelations: {
      aPlusB: a + b, aPlusC: a + c, bPlusC: b + c,
      aMinusB: a - b, aMinusC: a - c, bMinusC: b - c,
      pixelCount: width * height, bodyBytes: body.length,
    },
    histogram, markers,
  };
});
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({ sprites, note: 'Exploratory layout analysis; no header field or pixel codec confirmed.' }, null, 2) + '\n');
console.log(JSON.stringify({ sprites: sprites.length, first: sprites[0], report: target }, null, 2));
