import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const input = resolve(root, process.argv[2] ?? 'original/DATA/BENN.SPR');
const output = resolve(root, process.argv[3] ?? 'reports/sprites/BENN-rows.json');
const file = await readFile(input);
const tableBytes = file.readUInt16LE(0) * 16;
const offsets: number[] = [];
for (let p = 0; p + 1 < tableBytes; p += 2) {
  const unit = file.readUInt16LE(p);
  if (!unit) break;
  offsets.push(unit * 16);
}

type Row = { y: number; offset: number; shift: number; count: number; pixelsHex: string };
function parseRows(data: Buffer, start: number, end: number, height: number, signedShift: boolean) {
  const rows: Row[] = [];
  let p = start;
  let error: string | null = null;
  for (let y = 0; y < height; y++) {
    if (p + 2 > end) {
      error = 'missing row header';
      break;
    }
    const offset = p;
    const shift = signedShift ? data.readInt8(p) : data[p];
    const count = data[p + 1];
    p += 2;
    if (p + count > end) {
      error = 'pixel data exceeds sprite boundary';
      break;
    }
    rows.push({ y, offset, shift, count, pixelsHex: data.subarray(p, p + count).toString('hex') });
    p += count;
  }
  return { rows, consumed: p - start, remaining: end - p, error };
}

const sprites = offsets.map((start, index) => {
  const end = offsets[index + 1] ?? file.length;
  const width = file.readUInt16LE(start);
  const height = file.readUInt16LE(start + 2);
  const words = [2, 4, 6, 8].map((i) => file.readUInt16LE(start + i));
  const starts = [10, 12, 14, 16].filter((n) => start + n < end);
  const candidates = starts.map((headerBytes) => {
    const parsed = parseRows(file, start + headerBytes, end, height, true);
    const inBounds = parsed.rows.filter(
      (r) =>
        r.shift >= -width && r.shift <= width && r.count <= width && r.shift + r.count <= width,
    ).length;
    return {
      headerBytes,
      parsedRows: parsed.rows.length,
      expectedRows: height,
      inBounds,
      consumed: parsed.consumed,
      remaining: parsed.remaining,
      error: parsed.error,
      firstRows: parsed.rows.slice(0, 8),
      lastRows: parsed.rows.slice(-3),
    };
  });
  return { index, start, end, width, height, headerWords: words, candidates };
});
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      note: 'Diagnostic hypotheses only. Row layout and pixel decoding are NOT confirmed.',
      sprites,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({ sprites: sprites.length, report: output, first: sprites[0] }, null, 2),
);
