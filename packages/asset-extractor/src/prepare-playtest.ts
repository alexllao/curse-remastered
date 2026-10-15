import { scale2x } from './pixel-scale.js';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { png } from './spr-codec.js';
import { sha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url)),
  mods = join(root, 'mods');
function decodePng(data: Buffer) {
  if (
    !data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    data[24] !== 8 ||
    data[25] !== 6
  )
    throw new Error('Expected extractor RGBA PNG');
  const width = data.readUInt32BE(16),
    height = data.readUInt32BE(20),
    chunks: Buffer[] = [];
  for (let at = 8; at < data.length;) {
    const length = data.readUInt32BE(at),
      tag = data.toString('ascii', at + 4, at + 8);
    if (tag === 'IDAT') chunks.push(data.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)),
    pixels = Buffer.alloc(width * height * 4),
    stride = width * 4 + 1;
  if (raw.length !== height * stride) throw new Error('Unexpected PNG size');
  for (let y = 0; y < height; y++) {
    if (raw[y * stride] !== 0) throw new Error('Expected unfiltered extractor PNG');
    raw.copy(pixels, y * width * 4, y * stride + 1, (y + 1) * stride);
  }
  return { width, height, pixels };
}
async function prepare(source: string, file: string, remaster = false) {
  const bytes = await readFile(join(root, source)),
    { width, height, pixels } = decodePng(bytes);
  const output = join(mods, 'original', file);
  await mkdir(join(output, '..'), { recursive: true });
  let existing: Buffer | undefined;
  try {
    existing = await readFile(output);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (existing && sha256(existing) !== sha256(bytes))
    throw new Error('Local original differs: ' + file);
  if (!existing) await copyFile(join(root, source), output);
  const scaled = join(mods, 'escalado', file);
  await mkdir(join(scaled, '..'), { recursive: true });
  await writeFile(scaled, png(width * 2, height * 2, scale2x(width, height, pixels)));
  return { file, width, height, remaster, source, sourceSha256: sha256(bytes) };
}
const background = await prepare(
  'reports/scenes/backgrounds/070-STUDY/background.png',
  'fondos/070-STUDY.png',
  true,
);
const player = [];
for (let index = 0; index < 27; index++)
  player.push(
    await prepare(
      `reports/brd/shared/STD/frame-${String(index).padStart(3, '0')}.png`,
      `ben/STD-${String(index).padStart(3, '0')}.png`,
      true,
    ),
  );
await mkdir(join(mods, 'remaster/fondos'), { recursive: true });
await mkdir(join(mods, 'remaster/ben'), { recursive: true });
await mkdir(join(mods, 'referencias'), { recursive: true });
await writeFile(
  join(mods, 'manifest.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      logicalWidth: 320,
      logicalHeight: 200,
      scene: 'STUDY',
      scope:
        'Walking prototype; hand-authored convex floor, no original room scripts or gameplay claims',
      background,
      player,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Preparado STUDY y 27 fotogramas de Ben. Primer resultado: mods/remaster/fondos/070-STUDY.png (1280 × 800). No se han modificado tus remasters.',
);
