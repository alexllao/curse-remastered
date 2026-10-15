import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fromRoot = (path: string): string => (isAbsolute(path) ? path : resolve(root, path));
const sourceDir = fromRoot(process.argv[2] ?? 'reports/extracted');
const originals = fromRoot(process.argv[3] ?? 'original');
const outputDir = fromRoot(process.argv[4] ?? 'reports/images');
const WIDTH = 320;
const HEIGHT = 200;

type Entry = { file: string; status: string; output?: string; unpackedSize?: number };
type Manifest = { files: Entry[] };
type ImageResult = {
  source: string;
  palette: string | null;
  output: string | null;
  status: 'converted' | 'skipped' | 'error';
  note: string;
};

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, payload: Buffer): Buffer {
  const tag = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([tag, payload])));
  return Buffer.concat([length, tag, payload, checksum]);
}
function indexedPng(pixels: Uint8Array, palette: Uint8Array): Buffer {
  if (pixels.length !== WIDTH * HEIGHT) throw new Error('La imagen no mide 320 x 200');
  if (palette.length !== 768) throw new Error('La paleta no ocupa 768 bytes');
  if (palette.some((channel) => channel > 63)) {
    throw new Error('Paleta incompatible con los valores VGA de 6 bits esperados');
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 3;
  const rgb = Buffer.from(palette.map((value) => Math.round((value * 255) / 63)));
  const rows = Buffer.alloc(HEIGHT * (WIDTH + 1));
  for (let y = 0; y < HEIGHT; y++) {
    rows.set(pixels.subarray(y * WIDTH, (y + 1) * WIDTH), y * (WIDTH + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('PLTE', rgb),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
function paletteFor(file: string): string | null {
  // These associations are hypotheses based on filenames, not confirmed mappings.
  const name = file.replaceAll('\\', '/').split('/').at(-1) ?? '';
  if (/^BALCONY[1-5]\.DAT$/i.test(name)) return 'DATA/BALCONY.PAL';
  if (/^BASEBAL[1-6]\.DAT$/i.test(name) || /^BASEBAT\.DAT$/i.test(name)) {
    return 'DATA/BASEBALL.PAL';
  }
  if (/^CAULDRN[1-4]\.DAT$/i.test(name)) return 'DATA/CAULDRN.PAL';
  if (/^TITLE\.DAT$/i.test(name)) return 'DATA/TITLE.PAL';
  if (/^CORE\.DAT$/i.test(name)) return 'DATA/CORE.PAL';
  return null;
}
const manifest = JSON.parse(await readFile(join(sourceDir, 'manifest.json'), 'utf8')) as Manifest;
const results: ImageResult[] = [];
for (const entry of manifest.files) {
  if (entry.status !== 'extracted') continue;
  const paletteName = paletteFor(entry.file);
  if (entry.unpackedSize !== WIDTH * HEIGHT || !entry.output || !paletteName) {
    results.push({
      source: entry.file, palette: paletteName, output: null, status: 'skipped',
      note: 'Sin 64.000 bytes o sin una paleta candidata identificada',
    });
    continue;
  }
  try {
    // Use the output path recorded in the manifest, not a reconstructed filename.
    const pixels = await readFile(fromRoot(entry.output));
    const palette = await readFile(join(originals, paletteName));
    const png = indexedPng(pixels, palette);
    const relativeOutput = entry.file.replace(/\.DAT$/i, '.png');
    const output = join(outputDir, relativeOutput);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, png);
    results.push({
      source: entry.file, palette: paletteName,
      output: relativeOutput.replaceAll('\\', '/'), status: 'converted',
      note: 'PNG generado; comprobar visualmente la asociación de paleta',
    });
  } catch (error) {
    results.push({
      source: entry.file, palette: paletteName, output: null, status: 'error',
      note: error instanceof Error ? error.message : String(error),
    });
  }
}
await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, 'manifest.json'), JSON.stringify({ results }, null, 2) + '\n');
console.log(JSON.stringify({
  converted: results.filter((r) => r.status === 'converted').length,
  skipped: results.filter((r) => r.status === 'skipped').length,
  errors: results.filter((r) => r.status === 'error').length,
  report: 'reports/images/manifest.json',
}, null, 2));
