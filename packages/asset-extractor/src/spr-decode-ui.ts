import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, png } from './spr-codec.js';
import { executableSha256, sha256 } from './scene-palette.js';
import { colorSharedPixels, indexPalette, inspectIndices } from './shared-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const absolute = (path: string): string => (isAbsolute(path) ? path : resolve(root, path));
const dataDir = absolute(process.argv[2] ?? 'original/DATA');
const output = absolute(process.argv[3] ?? 'reports/sprites/interface');
const exe = await readFile(absolute(process.argv[4] ?? 'original/CURSE.EXE'));
if (sha256(exe) !== executableSha256)
  throw new Error('Unknown executable revision: UI palette evidence is not verified');
const palettePath = join(dataDir, 'SPRITES.PAL');
const palette = await readFile(palettePath);
if (palette.length !== 768 || palette.subarray(576).some((value) => value > 63))
  throw new Error('Invalid shared VGA palette tail');
const results = [];
for (const source of ['MOUSE.SPR', 'FONT.SPR', 'ICONS.SPR']) {
  const data = await readFile(join(dataDir, source));
  const decoded = decode(data, indexPalette, source);
  const name = source.replace(/\.SPR$/, '');
  const sprites = [],
    unresolved = [];
  await mkdir(join(output, name), { recursive: true });
  for (const [index, sprite] of decoded.entries()) {
    const usage = inspectIndices(sprite.pixels);
    if (usage.sceneDependentPixels || usage.animatedPixels) {
      unresolved.push({
        index,
        width: sprite.width,
        height: sprite.height,
        ...usage,
        reason: 'Requires scene or runtime palette context; no RGB PNG exported',
      });
      continue;
    }
    const file = name + '/sprite-' + String(index).padStart(3, '0') + '.png';
    const pixels = colorSharedPixels(sprite.pixels, palette);
    await writeFile(join(output, file), png(sprite.width, sprite.height, pixels));
    sprites.push({
      index,
      width: sprite.width,
      height: sprite.height,
      paintedPixels: sprite.paintedPixels,
      file,
      usedIndices: usage.indices,
      paletteStatus: 'verified-shared-baseline',
    });
  }
  results.push({
    source,
    sourceSha256: sha256(data),
    status: 'decoded',
    count: sprites.length,
    sourceSpriteCount: decoded.length,
    sprites,
    unresolved,
  });
}
const manifest = {
  schemaVersion: 1,
  kind: 'curse-interface-shared-palettes',
  executableSha256,
  note: 'Gameplay baseline shared palette; scene-dependent sprites and index 255 are excluded. Fades can still change the displayed DAC.',
  palette: relative(root, palettePath).replaceAll('\\', '/'),
  paletteSha256: sha256(palette),
  paletteRange: { firstIndex: 192, lastIndex: 254, sourceOffset: 576, bytes: 189 },
  evidence: {
    sharedLoad: '0x874-0x89A',
    mouseLoad: '0x518-0x581',
    iconLoad: '0xD949-0xD9BD',
    fontLoad: '0xD9BE-0xDA2E',
    selectorDrawing: '0xE173-0xE195',
    noPixelIndexRemap: '0x6F8C',
  },
  totalSprites: results.reduce((sum, row) => sum + row.sourceSpriteCount, 0),
  exportedSprites: results.reduce((sum, row) => sum + row.count, 0),
  unresolvedSprites: results.reduce((sum, row) => sum + row.unresolved.length, 0),
  results,
};
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      exportedSprites: manifest.exportedSprites,
      unresolvedSprites: manifest.unresolvedSprites,
      files: results.map((row) => ({
        source: row.source,
        exported: row.count,
        unresolved: row.unresolved.map((sprite) => sprite.index),
      })),
      report: join(output, 'manifest.json'),
    },
    null,
    2,
  ),
);
