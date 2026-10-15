import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unpackRnc1, crc16 } from './rnc1.js';
import { unpackRnc2 } from './rnc2.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fromRoot = (value: string): string => (isAbsolute(value) ? value : resolve(root, value));
const sourceRoot = fromRoot(process.argv[2] ?? 'original');
const destinationRoot = fromRoot(process.argv[3] ?? 'reports/extracted');
const extensions = new Set([
  '.DAT',
  '.MAP',
  '.SPR',
  '.BRD',
  '.SFX',
  '.PAL',
  '.RS1',
  '.RS2',
  '.RS3',
  '.RS4',
  '.RS5',
]);
type Entry = {
  file: string;
  extension: string;
  size: number;
  format: string;
  method?: number;
  unpackedSize?: number;
  packedCrcValid?: boolean;
  status: 'extracted' | 'unsupported' | 'raw';
  output?: string;
  error?: string;
};
const results: Entry[] = [];
async function walk(directory: string): Promise<void> {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    if (item.isSymbolicLink()) continue;
    const full = join(directory, item.name);
    if (item.isDirectory()) {
      await walk(full);
      continue;
    }
    if (!item.isFile()) continue;
    const extension = extname(item.name).toUpperCase();
    if (!extensions.has(extension)) continue;
    const bytes = await readFile(full);
    const name = relative(sourceRoot, full).replaceAll('\\', '/');
    const entry: Entry = {
      file: name,
      extension,
      size: bytes.length,
      format: 'unknown',
      status: 'raw',
    };
    results.push(entry);
    if (bytes.length < 18 || bytes.toString('ascii', 0, 3) !== 'RNC') continue;
    entry.format = 'RNC';
    entry.method = bytes[3];
    entry.unpackedSize = bytes.readUInt32BE(4);
    const packedSize = bytes.readUInt32BE(8);
    entry.packedCrcValid =
      packedSize + 18 <= bytes.length &&
      crc16(bytes.subarray(18, 18 + packedSize)) === bytes.readUInt16BE(14);
    if (entry.method !== 1 && entry.method !== 2) {
      entry.status = 'unsupported';
      entry.error = 'Unsupported RNC compression method';
      continue;
    }
    try {
      const decoded = entry.method === 1 ? unpackRnc1(bytes) : unpackRnc2(bytes);
      const output = join(destinationRoot, name + '.bin');
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, decoded);
      entry.status = 'extracted';
      entry.output = relative(root, output).replaceAll('\\', '/');
    } catch (error) {
      entry.status = 'unsupported';
      entry.error = error instanceof Error ? error.message : String(error);
    }
  }
}
await walk(sourceRoot);
results.sort((a, b) => a.file.localeCompare(b.file));
const report = {
  source: relative(root, sourceRoot).replaceAll('\\', '/'),
  total: results.length,
  extracted: results.filter((x) => x.status === 'extracted').length,
  unsupported: results.filter((x) => x.status === 'unsupported').length,
  raw: results.filter((x) => x.status === 'raw').length,
  files: results,
};
await mkdir(destinationRoot, { recursive: true });
const reportPath = join(destinationRoot, 'manifest.json');
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      report: relative(root, reportPath),
      total: report.total,
      extracted: report.extracted,
      unsupported: report.unsupported,
      raw: report.raw,
    },
    null,
    2,
  ),
);
if (report.unsupported > 0)
  console.log('Some resources need additional format decoders; see manifest.json.');
