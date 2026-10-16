import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decode, png } from './spr-codec.js';
import { colorContextPixels, indexPalette } from './shared-palette.js';
import { composeScenePalette, executableSha256, sha256 } from './scene-palette.js';

/** Datos y glifos de 0xE360 y 0xD823; las cadenas originales permanecen fuera de Git. */
export async function prepareOriginalInfo<T>(
  root: string,
  prepare: (source: string, file: string) => Promise<T>,
) {
  const exe = await readFile(join(root, 'original/CURSE.EXE'));
  if (sha256(exe) !== executableSha256) throw new Error('Unverified original info executable');
  const data = exe.subarray(exe.readUInt16LE(8) * 16 + 0xf310);
  const pages: { width: number; height: number; rows: number[][] }[] = [];
  const fields: { page: number; row: number; column: number; kind: 'score' | 'percentage' }[] = [];
  const mapping = Array.from(data.subarray(0xb6b4, 0xb6b4 + 128), (value) =>
    value < 128 ? value : value - 256,
  );
  for (let index = 0; index < 8; index++) {
    const pointer = data.readUInt16LE(0xb74e + index * 2);
    if (pointer === 65535) break;
    const width = data.readUInt16LE(pointer),
      height = data.readUInt16LE(pointer + 2);
    if (width > 320 || height > 200 || !width || !height)
      throw new Error('Invalid original info rectangle');
    const rows: number[][] = [[]];
    for (let at = pointer + 4, guard = 0; guard < 2048; at++, guard++) {
      const value = data[at];
      if (value === 254) break;
      if (value === 255) {
        rows.push([]);
        continue;
      }
      if (at === 0xb772 || at === 0xb78c)
        fields.push({
          page: index,
          row: rows.length - 1,
          column: rows.at(-1)!.length,
          kind: at === 0xb772 ? 'score' : 'percentage',
        });
      rows.at(-1)!.push(value);
    }
    pages.push({ width, height, rows });
  }
  if (pages.length !== 4 || fields.length !== 2)
    throw new Error('Unexpected original information layout');
  const palette = composeScenePalette(
    await readFile(join(root, 'original/DATA/DUNGEON.MAP')),
    await readFile(join(root, 'original/DATA/SPRITES.PAL')),
  );
  const font = decode(
    await readFile(join(root, 'original/DATA/FONT.SPR')),
    indexPalette,
    'FONT.SPR',
  );
  await mkdir(join(root, 'reports/interface/info'), { recursive: true });
  const glyphs = [];
  for (const [index, glyph] of font.entries()) {
    const source = `reports/interface/info/glyph-${index}.png`;
    await writeFile(
      join(root, source),
      png(glyph.width, glyph.height, colorContextPixels(glyph.pixels, palette)),
    );
    glyphs.push(await prepare(source, `interfaz/info/glyph-${index}.png`));
  }
  return {
    pages,
    fields,
    mapping,
    glyphs,
    maximumScore: 478,
    advanceX: 8,
    advanceY: 10,
    insetX: 8,
    insetY: 5,
  };
}
