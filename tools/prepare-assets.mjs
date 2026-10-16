import process from 'node:process';
import console from 'node:console';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const executable = join(root, 'original/CURSE.EXE');
const pnpm = process.env.npm_execpath;
function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Preparación detenida: ${command} ${args.join(' ')}`);
}
function packageStep(name) {
  console.log(`\nPreparando recursos: ${name}`);
  run(process.execPath, [pnpm, '--filter', '@curse/asset-extractor', name]);
}
try {
  if (!pnpm) throw new Error('Ejecuta este script mediante pnpm assets:prepare.');
  if (Number(process.versions.node.split('.')[0]) < 22)
    throw new Error('Se necesita Node.js 22 o superior.');
  if (!existsSync(executable) || !existsSync(join(root, 'original/DATA/BOXDET.DAT')))
    throw new Error('Copia tu juego en original/: deben existir CURSE.EXE y DATA/BOXDET.DAT.');
  const hash = createHash('sha256').update(readFileSync(executable)).digest('hex');
  if (hash !== 'f2c0046e07b25f408516edae5d6a66c06107971fb95c55ed770fa52a6b4ecd8d')
    throw new Error(
      'La revisión de CURSE.EXE todavía no está contrastada; no se prepararán asociaciones supuestas.',
    );
  let python = process.env.CURSE_PYTHON || 'python';
  const probe = () =>
    spawnSync(
      python,
      [
        '-c',
        "import unicorn, capstone; assert unicorn.__version__ == '2.1.4'; assert capstone.__version__ == '5.0.9'",
      ],
      {
        cwd: root,
        env: process.env,
        stdio: 'ignore',
      },
    );
  if (probe().status !== 0) {
    const folder = join(root, 'reports/tool-venv');
    mkdirSync(join(root, 'reports'), { recursive: true });
    if (!existsSync(folder)) run(python, ['-m', 'venv', folder]);
    python = join(folder, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    run(python, ['-m', 'pip', 'install', '-r', 'tools/reverse-engineering/requirements.txt']);
    if (probe().status !== 0) throw new Error('No se ha podido preparar Python/Unicorn.');
  }
  for (const name of [
    'extract-all',
    'images-png',
    'title-png',
    'scene-backgrounds',
    'brd-extract',
    'boxdet-extract',
  ])
    packageStep(name);
  for (const name of [
    'trace-boxdet',
    'trace-navigation',
    'trace-room-entries',
    'trace-scene-order',
    'trace-presentation',
    'trace-startup',
    'trace-dungeon',
    'trace-original-hud',
    'trace-dungeon-actions',
    'trace-dungeon-boundaries',
    'trace-dungeon-sounds',
    'trace-game-clock',
    'trace-ambient',
  ]) {
    console.log(`\nContrastando instrucciones originales: ${name}`);
    run(python, [`tools/reverse-engineering/${name}.py`]);
  }
  run(process.execPath, [
    pnpm,
    '--filter',
    '@curse/asset-extractor',
    'exec',
    'tsx',
    '../../tools/reverse-engineering/verify-dungeon.mts',
  ]);
  run(process.execPath, [
    pnpm,
    '--filter',
    '@curse/asset-extractor',
    'exec',
    'tsx',
    '../../tools/reverse-engineering/verify-ambient.mts',
  ]);
  run(process.execPath, [
    pnpm,
    '--filter',
    '@curse/asset-extractor',
    'exec',
    'tsx',
    '../../tools/reverse-engineering/verify-dungeon-actions.mts',
  ]);
  run(python, ['tools/extract-dungeon-sounds.py']);
  run(python, ['tools/reverse-engineering/trace-corridor.py']);
  run(python, ['tools/reverse-engineering/trace-drop.py']);
  run(python, ['tools/reverse-engineering/trace-lakebed.py']);
  run(python, ['tools/reverse-engineering/trace-lakebed-sounds.py']);
  run(python, ['tools/extract-lakebed-sounds.py']);
  run(process.execPath, [
    '--experimental-strip-types',
    'tools/reverse-engineering/verify-lakebed.mjs',
  ]);
  run(process.execPath, [
    '--experimental-strip-types',
    'tools/reverse-engineering/verify-drop.mjs',
  ]);
  run(process.execPath, [
    '--experimental-strip-types',
    'tools/reverse-engineering/verify-corridor.mjs',
  ]);
  for (const name of ['scene-layers', 'navigation-verify', 'prepare-playtest']) packageStep(name);
  console.log('\nRecursos locales preparados. Ejecuta pnpm dev. Tus remasters se han conservado.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
