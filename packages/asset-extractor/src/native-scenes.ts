import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeBrd } from './brd-resources.js';
import { composeScenePalette, sha256 } from './scene-palette.js';
import { colorContextPixels } from './shared-palette.js';
import { png } from './spr-codec.js';

/** Completar las salas contrastadas sin alterar los demás escenarios. */
export async function prepareNativeScenes(
  root: string,
  scenes: { id: number }[],
  prepare: (
    source: string,
    file: string,
    remaster?: boolean,
  ) => Promise<{ file: string; width: number; height: number }>,
) {
  const nativeScenes: Record<string, string> = {};
  for (const { id, name, modes } of [
    { id: 1, name: 'CORRIDOR', modes: [1, 3] },
    { id: 2, name: 'DROP', modes: [4] },
  ]) {
    const key = String(id).padStart(3, '0');
    let bytes: Buffer;
    try {
      bytes = await readFile(join(root, `reports/navigation/${name.toLowerCase()}/profile.json`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    const profile = JSON.parse(bytes.toString('utf8'));
    if (sha256(await readFile(join(root, 'original/CURSE.EXE'))) !== profile.executableSha256)
      throw new Error(`Repetir la traza nativa de ${name}`);
    const scene = scenes.find((s) => s.id === id) as {
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
      await readFile(join(root, `original/DATA/${name}.MAP`)),
      await readFile(join(root, 'original/DATA/SPRITES.PAL')),
    );
    const spriteBanks: Record<number, number> = { 0: 16384 };
    const banks: [number, string][] = [
      [20480, 'STD.BRD'],
      [16384, 'MANA.BRD'],
    ];
    // Modos del cargador original: el banco MANA cambia al realizar acciones.
    for (const mode of modes) {
      const at = 0x918 + mode * 2;
      const pointer = profile.memory[at] | (profile.memory[at + 1] << 8);
      const end = profile.memory.indexOf(0, pointer);
      const name = String.fromCharCode(...profile.memory.slice(pointer, end)).toUpperCase();
      if (!profile.files[name]) throw new Error(`Banco de acciones de ${name} desconocido`);
      const bank = 0x10000 + mode;
      spriteBanks[mode] = bank;
      banks.push([bank, name]);
    }
    for (const [bank, name] of banks) {
      const data = await readFile(join(root, 'original/DATA', name));
      if (JSON.stringify(Array.from(data)) !== JSON.stringify(profile.files[name]))
        throw new Error(`Banco de ${name} modificado`);
      for (const [frame, image] of decodeBrd(data, name).frames.entries()) {
        const source = `reports/scenes/layers/${key}/animation-${bank}-${frame}.png`;
        await writeFile(
          join(root, source),
          png(image.width, image.height, colorContextPixels(image.pixels, palette)),
        );
        assets.push({
          ...(await prepare(source, `escenario/${key}/animation-${bank}-${frame}.png`, true)),
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
      controls: profile.memory.slice(0x3594, 0x3597),
      bank: profile.memory[0x358c],
      assets,
      dimensions,
      scope: `${name} native routines, entry and dynamic handlers`,
    });
    const folder = join(root, 'assets/original/datos');
    await mkdir(folder, { recursive: true });
    await writeFile(join(folder, `${name.toLowerCase()}.json`), bytes);
    nativeScenes[String(id)] = `/original/datos/${name.toLowerCase()}.json`;
  }
  return nativeScenes;
}
