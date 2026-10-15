import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const absolute = (p: string): string => (isAbsolute(p) ? p : resolve(root, p));
const spritesDir = absolute(process.argv[2] ?? 'original/DATA');
const palettesDir = absolute(process.argv[3] ?? 'original/DATA');
const output = absolute(process.argv[4] ?? 'reports/sprites/palette-audit.json');
type RecordRow = {
  source: string;
  spriteCount: number;
  indexedPixels: number;
  distinctIndices: number;
  paletteResults: {
    palette: string;
    darkPercent: number;
    averageLuma: number;
    blackPixels: number;
    sampleColors: number[][];
  }[];
  error?: string;
};
function readIndices(data: Buffer): { count: number; histogram: Uint32Array } {
  const histogram = new Uint32Array(256);
  const first = data.readUInt16LE(0) * 16;
  if (first < 16 || first > data.length || first % 2) throw new Error('Invalid SPR offset table');
  const starts: number[] = [];
  for (let i = 0; i < first; i += 2) {
    const unit = data.readUInt16LE(i);
    if (!unit) break;
    const offset = unit * 16;
    if (
      offset < first ||
      offset >= data.length ||
      (starts.length && offset <= starts[starts.length - 1])
    )
      throw new Error('Invalid sprite start');
    starts.push(offset);
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i],
      end = starts[i + 1] ?? data.length;
    if (start + 10 > end) throw new Error('Truncated sprite');
    const height = data.readUInt16LE(start + 2);
    const offsets = [
      0,
      data.readUInt16LE(start + 8),
      data.readUInt16LE(start + 6),
      data.readUInt16LE(start + 4),
    ];
    const positions = offsets.map((offset) => start + 10 + offset);
    if (positions.some((p, j) => p >= end || (j && p <= positions[j - 1])))
      throw new Error('Invalid plane boundaries');
    for (let plane = 0; plane < 4; plane++) {
      let p = positions[plane];
      const limit = positions[plane + 1] ?? end;
      for (let y = 0; y < height; y++) {
        let finished = false;
        while (p < limit) {
          let n = data.readInt8(p++);
          if (!n) {
            finished = true;
            break;
          }
          if (n < 0) {
            if (p >= limit) throw new Error('Truncated skip');
            n = data[p++];
          }
          if (p + n > limit) throw new Error('Truncated pixels');
          for (let k = 0; k < n; k++) histogram[data[p + k]]++;
          p += n;
        }
        if (!finished) throw new Error('Unterminated row');
      }
    }
  }
  return { count: starts.length, histogram };
}
const names = (await readdir(palettesDir))
  .filter((name) => name.toLowerCase().endsWith('.pal'))
  .sort();
const palettes: { name: string; bytes: Buffer }[] = [];
for (const name of names) {
  const bytes = await readFile(join(palettesDir, name));
  if (bytes.length === 768 && bytes.every((value) => value <= 63)) palettes.push({ name, bytes });
}
if (!palettes.length) throw new Error('No valid 768-byte VGA palettes found in ' + palettesDir);
const sprFiles = (await readdir(spritesDir))
  .filter((name) => name.toLowerCase().endsWith('.spr'))
  .sort();
const rows: RecordRow[] = [];
for (const name of sprFiles) {
  try {
    const { count, histogram } = readIndices(await readFile(join(spritesDir, name)));
    const indexedPixels = histogram.reduce((a, b) => a + b, 0);
    const paletteResults = palettes
      .map(({ name: palette, bytes }) => {
        let dark = 0,
          black = 0,
          sum = 0;
        const common = Array.from(histogram.entries())
          .filter(([, count]) => count)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8);
        for (let index = 0; index < 256; index++) {
          const count = histogram[index];
          if (!count) continue;
          const r = bytes[index * 3],
            g = bytes[index * 3 + 1],
            b = bytes[index * 3 + 2];
          const luma = ((0.2126 * r + 0.7152 * g + 0.0722 * b) * 255) / 63;
          sum += luma * count;
          if (luma < 35) dark += count;
          if (r === 0 && g === 0 && b === 0) black += count;
        }
        return {
          palette,
          darkPercent: indexedPixels ? Math.round((dark * 1000) / indexedPixels) / 10 : 0,
          averageLuma: indexedPixels ? Math.round((sum / indexedPixels) * 10) / 10 : 0,
          blackPixels: black,
          sampleColors: common.map(([index, count]) => [
            index,
            count,
            bytes[index * 3],
            bytes[index * 3 + 1],
            bytes[index * 3 + 2],
          ]),
        };
      })
      .sort((a, b) => a.darkPercent - b.darkPercent);
    rows.push({
      source: name,
      spriteCount: count,
      indexedPixels,
      distinctIndices: histogram.filter((n) => n > 0).length,
      paletteResults,
    });
  } catch (error) {
    rows.push({
      source: name,
      spriteCount: 0,
      indexedPixels: 0,
      distinctIndices: 0,
      paletteResults: [],
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
await mkdir(dirname(output), { recursive: true });
await writeFile(
  output,
  JSON.stringify(
    {
      warning:
        'Brightness statistics are diagnostic only; the lowest darkPercent does NOT prove the correct palette.',
      palettes: palettes.map((p) => p.name),
      files: rows,
    },
    null,
    2,
  ) + '\n',
);
for (const row of rows.filter((r) => /^(BENN|XROADS)\.SPR$/i.test(r.source)))
  console.log(
    JSON.stringify(
      {
        source: row.source,
        sprites: row.spriteCount,
        palettes: row.paletteResults.map((p) => ({
          name: p.palette,
          darkPercent: p.darkPercent,
          averageLuma: p.averageLuma,
        })),
      },
      null,
      2,
    ),
  );
console.log(
  JSON.stringify(
    {
      files: rows.length,
      errors: rows.filter((r) => r.error).length,
      palettes: palettes.length,
      report: output,
    },
    null,
    2,
  ),
);
