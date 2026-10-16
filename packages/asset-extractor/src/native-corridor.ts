import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeBrd } from './brd-resources.js';
import { composeScenePalette, sha256 } from './scene-palette.js';
import { colorContextPixels } from './shared-palette.js';
import { png } from './spr-codec.js';

/** Completar el recurso CORRIDOR sin alterar los demás escenarios. */
export async function prepareNativeCorridor(
  root: string,
  scenes: { id: number }[],
  prepare: (
    source: string,
    file: string,
    remaster?: boolean,
  ) => Promise<{ file: string; width: number; height: number }>,
) {
  let bytes: Buffer;
  try {
    bytes = await readFile(join(root, 'reports/navigation/corridor/profile.json'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  const profile = JSON.parse(bytes.toString('utf8'));
  if (sha256(await readFile(join(root, 'original/CURSE.EXE'))) !== profile.executableSha256)
    throw new Error('Repetir la traza nativa de CORRIDOR');
  const scene = scenes.find((s) => s.id === 1) as {
    id: number;
    animation: {
      actors: number[][];
      assets: unknown[];
      dimensions: Record<string, [number, number]>;
      includePlayer: boolean;
    };
  };
  const assets = [...scene.animation.assets];
  const dimensions = { ...scene.animation.dimensions };
  const palette = composeScenePalette(
    await readFile(join(root, 'original/DATA/CORRIDOR.MAP')),
    await readFile(join(root, 'original/DATA/SPRITES.PAL')),
  );
  const spriteBanks: Record<number, number> = { 0: 16384 };
  const banks: [number, string][] = [
    [20480, 'STD.BRD'],
    [16384, 'MANA.BRD'],
  ];
  // Modos del cargador original: el banco MANA cambia al realizar acciones.
  for (const mode of [1, 3]) {
    const at = 0x918 + mode * 2;
    const pointer = profile.memory[at] | (profile.memory[at + 1] << 8);
    const end = profile.memory.indexOf(0, pointer);
    const name = String.fromCharCode(...profile.memory.slice(pointer, end)).toUpperCase();
    if (!profile.files[name]) throw new Error('Banco de acciones de CORRIDOR desconocido');
    const bank = 0x10000 + mode;
    spriteBanks[mode] = bank;
    banks.push([bank, name]);
  }
  for (const [bank, name] of banks) {
    const data = await readFile(join(root, 'original/DATA', name));
    if (JSON.stringify(Array.from(data)) !== JSON.stringify(profile.files[name]))
      throw new Error('Banco de CORRIDOR modificado');
    for (const [frame, image] of decodeBrd(data, name).frames.entries()) {
      const source = `reports/scenes/layers/001/animation-${bank}-${frame}.png`;
      await writeFile(
        join(root, source),
        png(image.width, image.height, colorContextPixels(image.pixels, palette)),
      );
      assets.push({
        ...(await prepare(source, `escenario/001/animation-${bank}-${frame}.png`, true)),
        bank,
        frame,
      });
      dimensions[`${bank}:${frame}`] = [image.width, image.height];
    }
  }
  Object.assign(scene.animation, {
    spriteBanks,
    includePlayer: true,
    actors: Array.from({ length: 69 }, (_, i) =>
      profile.memory.slice(0x2c2b + i * 33, 0x2c2b + (i + 1) * 33),
    ),
    controls: [1, 1, 1],
    bank: 255,
    assets,
    dimensions,
    scope: 'CORRIDOR native routines, actions and dynamic handlers',
  });
  const folder = join(root, 'assets/original/datos');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'corridor.json'), bytes);
  return { '1': '/original/datos/corridor.json' };
}
