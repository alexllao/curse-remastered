import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, png } from './spr-codec.js';
import { sha256 } from './scene-palette.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const pathFromRoot = (path: string): string => (isAbsolute(path) ? path : resolve(root, path));
const sourceDir = pathFromRoot(process.argv[2] ?? 'original/DATA');
const outputDir = pathFromRoot(process.argv[3] ?? 'reports/sprites/all');
const paletteFile = pathFromRoot(process.argv[4] ?? 'original/DATA/SPRITES.PAL');

type SpriteResult = {
  index: number;
  width: number;
  height: number;
  paintedPixels: number;
  file: string;
};
type FileResult = {
  source: string;
  status: 'decoded' | 'error' | 'unresolved';
  palette?: string;
  paletteStatus?: string;
  map?: string;
  count: number;
  sprites?: SpriteResult[];
  error?: string;
};
async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory()
        ? walk(path)
        : entry.isFile() && extname(path).toLowerCase() === '.spr'
          ? [path]
          : [];
    }),
  );
  return files.flat().sort((a, b) => a.localeCompare(b));
}

type Recipe = {
  sprite: string;
  map: string;
  palette: string;
  status: string;
  paletteSha256: string;
  spriteSha256: string;
};
const sceneMode = paletteFile.toLowerCase().endsWith('.json');
let recipes: Recipe[] = [];
if (sceneMode) {
  const manifest = JSON.parse(await readFile(paletteFile, 'utf8'));
  if (
    manifest.kind !== 'curse-scene-palettes' ||
    manifest.status !== 'verified-static' ||
    !Array.isArray(manifest.recipes)
  )
    throw new Error('Expected a verified scene palette manifest');
  recipes = manifest.recipes;
}
async function loadPalette(path: string, expectedHash?: string): Promise<Buffer> {
  const raw = await readFile(path);
  if (raw.length !== 768 || raw.some((value) => value > 63))
    throw new Error('Expected a 768-byte VGA palette');
  if (expectedHash && sha256(raw) !== expectedHash)
    throw new Error('Palette hash mismatch; regenerate exe-palettes');
  return Buffer.from(raw.map((value) => Math.round((value * 255) / 63)));
}
const explicitPalette = sceneMode ? undefined : await loadPalette(paletteFile);
const files = await walk(sourceDir);
if (!files.length) throw new Error('No se encontraron archivos .SPR en ' + sourceDir);
await mkdir(outputDir, { recursive: true });
const results: FileResult[] = [];
for (const file of files) {
  const source = relative(sourceDir, file).replaceAll('\\', '/');
  const matches = sceneMode
    ? recipes.filter((row) => row.sprite === source.toUpperCase())
    : [undefined];
  if (!matches.length) {
    results.push({ source, status: 'unresolved', count: 0 });
    continue;
  }
  for (const recipe of matches) {
    const label = recipe ? recipe.map.replace(/\.MAP$/i, '') + '/' + source : source;
    try {
      const data = await readFile(file);
      if (recipe && (recipe.status !== 'verified-static' || sha256(data) !== recipe.spriteSha256))
        throw new Error('Unverified or changed sprite association');
      const palette = recipe
        ? await loadPalette(pathFromRoot(recipe.palette), recipe.paletteSha256)
        : explicitPalette!;
      const sprites = decode(data, palette, source);
      const destination = join(outputDir, label.replace(/\.spr$/i, ''));
      await mkdir(destination, { recursive: true });
      const entries: SpriteResult[] = [];
      for (let index = 0; index < sprites.length; index++) {
        const sprite = sprites[index];
        const name = 'sprite-' + String(index).padStart(3, '0') + '.png';
        await writeFile(join(destination, name), png(sprite.width, sprite.height, sprite.pixels));
        entries.push({
          index,
          width: sprite.width,
          height: sprite.height,
          paintedPixels: sprite.paintedPixels,
          file: relative(outputDir, join(destination, name)).replaceAll('\\', '/'),
        });
      }
      results.push({
        source: label,
        status: 'decoded',
        count: entries.length,
        sprites: entries,
        palette: recipe?.palette ?? relative(root, paletteFile).replaceAll('\\', '/'),
        paletteStatus: recipe ? 'verified-static' : 'unverified-explicit',
        map: recipe?.map,
      });
      console.log('OK ' + source + ': ' + entries.length + ' sprites');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ source: label, status: 'error', count: 0, error: message });
      console.error('ERROR ' + source + ': ' + message);
    }
  }
}
const manifest = {
  note: sceneMode
    ? 'Paletas de carga de escena verificadas estaticamente; no incluyen fundidos ni animacion del indice 255.'
    : 'Paleta explicita sin asociacion verificada; no implica que sea correcta para cada escena.',
  palette: relative(root, paletteFile).replaceAll('\\', '/'),
  sourceDir: relative(root, sourceDir).replaceAll('\\', '/'),
  totalFiles: files.length,
  decodedVariants: results.filter((result) => result.status === 'decoded').length,
  decodedFiles: new Set(
    results
      .filter((result) => result.status === 'decoded')
      .map((result) => result.source.split('/').pop()),
  ).size,
  unresolvedFiles: results.filter((result) => result.status === 'unresolved').length,
  failedFiles: results.filter((result) => result.status === 'error').length,
  totalSprites: results.reduce((sum, result) => sum + result.count, 0),
  results,
};
await writeFile(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      files: manifest.totalFiles,
      decoded: manifest.decodedFiles,
      failed: manifest.failedFiles,
      sprites: manifest.totalSprites,
      report: join(outputDir, 'manifest.json'),
    },
    null,
    2,
  ),
);
if (manifest.failedFiles) process.exitCode = 1;
