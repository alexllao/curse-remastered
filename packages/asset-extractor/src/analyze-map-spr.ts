import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const inputDir = resolve(root, process.argv[2] ?? 'original');
const outputFile = resolve(root, process.argv[3] ?? 'reports/map-spr-analysis.json');

type FileReport = {
  file: string;
  extension: string;
  bytes: number;
  first64Hex: string;
  first32Ascii: string;
  uniqueByteValues: number;
  zeroPercent: number;
  entropyBitsPerByte: number;
  repeatedByteRuns: number;
  candidate16BitLE: number[];
  candidate16BitBE: number[];
  candidate32BitLE: number[];
  candidate32BitBE: number[];
  rnc: string | null;
};

async function walk(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) files.push(...(await walk(path)));
    else if (item.isFile() && /\.(MAP|SPR)$/i.test(item.name)) files.push(path);
  }
  return files.sort();
}
function entropy(bytes: Uint8Array): number {
  if (!bytes.length) return 0;
  const histogram = new Uint32Array(256);
  for (const value of bytes) histogram[value]++;
  let value = 0;
  for (const count of histogram) {
    if (count) {
      const p = count / bytes.length;
      value -= p * Math.log2(p);
    }
  }
  return Math.round(value * 1000) / 1000;
}
function analyze(path: string, data: Buffer): FileReport {
  const prefix = data.subarray(0, 32);
  const values16LE: number[] = [];
  const values16BE: number[] = [];
  const values32LE: number[] = [];
  const values32BE: number[] = [];
  for (let offset = 0; offset + 1 < Math.min(data.length, 16); offset += 2) {
    values16LE.push(data.readUInt16LE(offset));
    values16BE.push(data.readUInt16BE(offset));
  }
  for (let offset = 0; offset + 3 < Math.min(data.length, 16); offset += 4) {
    values32LE.push(data.readUInt32LE(offset));
    values32BE.push(data.readUInt32BE(offset));
  }
  let runs = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i] === data[i - 1]) runs++;
  }
  const histogram = new Set(data);
  const signature = data.length >= 4 && data.toString('ascii', 0, 3) === 'RNC'
    ? `RNC method ${data[3]}` : null;
  return {
    file: relative(inputDir, path).replaceAll('\\', '/'),
    extension: path.slice(path.lastIndexOf('.')).toUpperCase(),
    bytes: data.length,
    first64Hex: data.subarray(0, 64).toString('hex'),
    first32Ascii: [...prefix].map((value) => value >= 32 && value <= 126 ? String.fromCharCode(value) : '.').join(''),
    uniqueByteValues: histogram.size,
    zeroPercent: data.length ? Math.round(10000 * data.filter((value) => value === 0).length / data.length) / 100 : 0,
    entropyBitsPerByte: entropy(data),
    repeatedByteRuns: runs,
    candidate16BitLE: values16LE,
    candidate16BitBE: values16BE,
    candidate32BitLE: values32LE,
    candidate32BitBE: values32BE,
    rnc: signature,
  };
}
const paths = await walk(inputDir);
const files: FileReport[] = [];
for (const path of paths) files.push(analyze(path, await readFile(path)));
const grouped = Object.entries(Object.groupBy(files, (item) => item.extension)).map(([extension, items]) => ({
  extension,
  count: items?.length ?? 0,
  sizes: [...new Set((items ?? []).map((item) => item.bytes))].sort((a, b) => a - b),
}));
await mkdir(resolve(outputFile, '..'), { recursive: true });
await writeFile(outputFile, JSON.stringify({ total: files.length, grouped, files }, null, 2) + '\n');
console.log(JSON.stringify({ total: files.length, grouped, report: relative(root, outputFile) }, null, 2));
