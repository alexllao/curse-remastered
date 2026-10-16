import { execFileSync } from 'node:child_process';
import { readdir, mkdir, rename, readFile, writeFile, lstat, rmdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const oldRoot = join(root, 'mods'),
  newRoot = join(root, 'assets');
const apply = process.argv.includes('--apply');
async function entries(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}
function inside(base, path) {
  if (!resolve(path).startsWith(resolve(base) + sep))
    throw new Error('Ruta fuera del directorio previsto: ' + path);
}
const plan = [];
for (const type of ['graficos', 'musica', 'sonidos']) {
  for (const entry of await entries(join(oldRoot, type))) {
    if (entry.isSymbolicLink()) throw new Error('Revisar enlace antes de migrar: ' + entry.name);
    const source = join(oldRoot, type, entry.name);
    const target = entry.isDirectory()
      ? join(
          newRoot,
          entry.name === 'remastered' && type === 'sonidos' ? 'remaster' : entry.name,
          type,
        )
      : type === 'musica' && entry.name === 'music.json'
        ? join(newRoot, 'music.json')
        : join(newRoot, 'original', type, entry.name);
    inside(oldRoot, source);
    inside(newRoot, target);
    try {
      await lstat(target);
      throw new Error('Destino ocupado; no se sobrescribe: ' + target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    plan.push({ source, target, directory: entry.isDirectory() });
  }
}
// Mover primero los paquetes: sus metadatos de raíz se colocan después.
plan.sort((a, b) => Number(b.directory) - Number(a.directory));
// Inventario completo antes de mover nada; rechaza enlaces y verifica hashes después.
async function inventory(path) {
  const info = await lstat(path);
  if (info.isSymbolicLink()) throw new Error('Enlace no admitido: ' + path);
  if (info.isDirectory()) {
    const result = [];
    for (const entry of await entries(path))
      result.push(...(await inventory(join(path, entry.name))));
    return result;
  }
  return [
    {
      path,
      sha256: createHash('sha256')
        .update(await readFile(path))
        .digest('hex'),
    },
  ];
}
const files = [];
for (const move of plan)
  for (const file of await inventory(move.source)) {
    const suffix = relative(move.source, file.path);
    files.push({
      source: file.path,
      target: suffix ? join(move.target, suffix) : move.target,
      sha256: file.sha256,
    });
  }
const targets = new Set();
for (const file of files) {
  const key = process.platform === 'win32' ? file.target.toLowerCase() : file.target;
  if (targets.has(key))
    throw new Error('Dos recursos comparten destino; no se mueve nada: ' + file.target);
  targets.add(key);
}
console.log(
  `${plan.length} movimientos; ${files.length} archivos. ${apply ? 'Aplicando' : 'Vista previa; usa --apply para ejecutar'}.`,
);
if (apply) {
  const report = join(root, 'reports/asset-migration');
  await mkdir(report, { recursive: true });
  const receipt = join(report, new Date().toISOString().replaceAll(':', '-') + '.json');
  await writeFile(
    receipt,
    JSON.stringify({ schemaVersion: 1, status: 'planned', plan, files }, null, 2),
  );
  for (const move of plan) {
    await mkdir(join(move.target, '..'), { recursive: true });
    try {
      await rename(move.source, move.target);
    } catch (error) {
      if (process.platform !== 'win32' || error.code !== 'EPERM') throw error;
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "$s=[IO.Path]::GetFullPath($env:CURSE_MOVE_SOURCE); $t=[IO.Path]::GetFullPath($env:CURSE_MOVE_TARGET); $r=[IO.Path]::GetFullPath($env:CURSE_MOVE_ROOT); if (-not $s.StartsWith($r+'\\') -or -not $t.StartsWith($r+'\\')) { throw 'Ruta fuera del repositorio' }; if (Test-Path -LiteralPath $t) { throw 'Destino ocupado' }; Move-Item -LiteralPath $s -Destination $t -ErrorAction Stop",
        ],
        {
          windowsHide: true,
          env: {
            ...process.env,
            CURSE_MOVE_SOURCE: move.source,
            CURSE_MOVE_TARGET: move.target,
            CURSE_MOVE_ROOT: root,
          },
          stdio: 'pipe',
        },
      );
    }
  }
  for (const file of files) {
    if (
      createHash('sha256')
        .update(await readFile(file.target))
        .digest('hex') !== file.sha256
    )
      throw new Error('Hash diferente después del traslado: ' + file.target);
  }
  for (const type of ['graficos', 'musica', 'sonidos']) {
    const path = join(oldRoot, type);
    inside(oldRoot, path);
    if (!(await entries(path)).length)
      try {
        await rmdir(path);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
  }
  await writeFile(
    receipt,
    JSON.stringify({ schemaVersion: 1, status: 'verified', plan, files }, null, 2),
  );
  console.log('Todos los archivos conservan su SHA-256. Informe: ' + receipt);
}
