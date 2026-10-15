import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const absolute = (path: string): string => (isAbsolute(path) ? path : resolve(root, path));
const source = absolute(process.argv[2] ?? 'original/DATA/BENN.SPR');
const target = absolute(process.argv[3] ?? 'reports/sprites/BENN-index.json');
const data = await readFile(source);
if (data.length < 32 || data.length % 16 !== 0) throw new Error('Invalid SPR file length');

const firstOffsetUnits = data.readUInt16LE(0);
const indexEnd = firstOffsetUnits * 16;
if (indexEnd < 4 || indexEnd > data.length || indexEnd > 65536) {
  throw new Error('SPR first offset outside file');
}
const offsets: number[] = [];
let last = 0;
let indexCount = 0;
for (let pos = 0; pos + 1 < indexEnd; pos += 2) {
  const unit = data.readUInt16LE(pos);
  if (unit === 0) break;
  const offset = unit * 16;
  if (offset < indexEnd || offset >= data.length || offset <= last) {
    throw new Error(`Invalid SPR index entry at byte ${pos}: ${unit}`);
  }
  offsets.push(offset);
  last = offset;
  indexCount++;
}
if (indexCount === 0) throw new Error('Empty SPR index');
const sprites = offsets.map((start, index) => {
  const end = offsets[index + 1] ?? data.length;
  if (end - start < 10) throw new Error(`Sprite ${index} has truncated header`);
  return {
    index,
    start,
    end,
    bytes: end - start,
    widthCandidate: data.readUInt16LE(start),
    heightCandidate: data.readUInt16LE(start + 2),
    headerWords: Array.from({ length: 5 }, (_, i) => data.readUInt16LE(start + i * 2)),
    first32Hex: data.subarray(start, Math.min(start + 32, end)).toString('hex'),
  };
});
const report = {
  source: source.replace(root, '').replaceAll('\\', '/'),
  bytes: data.length,
  indexEnd,
  indexCount,
  sprites,
  note: 'Index and 16-byte alignment verified. Dimensions and remaining header words are hypotheses; pixel codec unknown.',
};
await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({ sprites: sprites.length, first: sprites[0], report: target }, null, 2),
);
