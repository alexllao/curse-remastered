import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decode, png } from './spr-codec.js';
import { unpackRnc1 } from './rnc1.js';
import { indexedRgba } from './scene-background.js';
import { colorContextPixels, indexPalette } from './shared-palette.js';
import { composeScenePalette, executableSha256, sha256 } from './scene-palette.js';

/** Solo la barra inicial de DUNGEON; los programas de acción se portan aparte. */
export async function prepareOriginalHud<T>(
  root: string,
  prepare: (source: string, file: string) => Promise<T>,
) {
  const exe = await readFile(join(root, 'original/CURSE.EXE'));
  const report = JSON.parse(
    await readFile(join(root, 'reports/navigation/original-hud.json'), 'utf8'),
  );
  if (sha256(exe) !== executableSha256 || report.executableSha256 !== executableSha256)
    throw new Error('Unverified original HUD executable');
  for (const [name, expected] of Object.entries(report.sources))
    if (sha256(await readFile(join(root, 'original/DATA', name))) !== expected)
      throw new Error('Original HUD source changed: ' + name);
  if (report.calls.length !== 12 || report.positions.length !== 16)
    throw new Error('Incomplete original HUD trace');
  for (const sample of report.positions)
    if (
      sample.barY !== (sample.y < 100 ? 0 : 168) ||
      sample.selectionX !== Math.floor(sample.x / 32) * 32
    )
      throw new Error('Original HUD placement changed');
  const palette = await readFile(join(root, 'original/DATA/SPRITES.PAL'));
  const scenePalette = composeScenePalette(
    await readFile(join(root, 'original/DATA/DUNGEON.MAP')),
    palette,
  );
  const icons = decode(
    await readFile(join(root, 'original/DATA/ICONS.SPR')),
    indexPalette,
    'ICONS.SPR',
  );
  const menu = Buffer.from(unpackRnc1(await readFile(join(root, 'original/DATA/MENU.DAT'))));
  if (menu.length !== 320 * 32) throw new Error('Unexpected original menu dimensions');
  await mkdir(join(root, 'reports/interface'), { recursive: true });
  async function image(name: string, width: number, height: number, indexed: Buffer) {
    const source = `reports/interface/${name}.png`;
    await writeFile(
      join(root, source),
      png(width, height, colorContextPixels(indexed, scenePalette)),
    );
    return prepare(source, `interfaz/hud/${name}.png`);
  }
  const background = await image('MENU', 320, 32, indexedRgba(menu));
  const iconAssets = [];
  for (const [index, sprite] of icons.entries())
    iconAssets.push(await image(`icon-${index}`, sprite.width, sprite.height, sprite.pixels));
  const mouse = decode(
    await readFile(join(root, 'original/DATA/MOUSE.SPR')),
    indexPalette,
    'MOUSE.SPR',
  );
  const cursors = [];
  for (const [index, sprite] of mouse.entries())
    cursors.push(await image(`mouse-${index}`, sprite.width, sprite.height, sprite.pixels));
  // El aspa que bloquea recoger/interactuar está integrada en el EXE como SPR.
  const wrapper = Buffer.alloc(16);
  wrapper.writeUInt16LE(1);
  const raw = exe.subarray(0xf510 + 0xbc10, 0xf510 + 0xbdd4);
  const cross = decode(Buffer.concat([wrapper, raw]), indexPalette, 'CURSE.EXE blocked action')[0];
  const blocked = await image('blocked', cross.width, cross.height, cross.pixels);
  return {
    background,
    icons: iconAssets,
    cursors,
    blocked,
    selection: report.selection,
    selectionColor: report.selectionColorsRgb6
      .slice(0, 3)
      .map((n: number) => Math.round((n * 255) / 63)),
    selectionAnimation: {
      colors: Array.from({ length: 24 }, (_, i) =>
        report.selectionColorsRgb6
          .slice(i * 3, i * 3 + 3)
          .map((n: number) => Math.round((n * 255) / 63)),
      ),
      modalCyclesPerColor: report.selectionAnimation.modalCyclesPerColor,
      referenceHz: 70,
    },
    initialBlocked: [1, 2],
    scope: 'Original contextual selector and submenus; DUNGEON actions in separate room controller',
  };
}
