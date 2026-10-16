import process from 'node:process';
import console from 'node:console';
import { execFileSync } from 'node:child_process';
const files = execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const permitted = new Set(['reports/.gitignore', 'mods/README.md']);
const forbidden = files.filter(
  (file) =>
    !permitted.has(file) &&
    (/^(original|reports|mods)\//i.test(file) ||
      /\.(png|jpe?g|gif|webp|avif|bmp|pcx|exe|com|dat|map|spr|brd|pal|sfx|rs[1-5]|wav|ogg|mp3|flac|m4a|aac|opus|mid|midi|sf2|sf3|dls|syx|rom|dll|rgba|bin)$/i.test(
        file,
      )),
);
if (forbidden.length) {
  console.error(
    'No se pueden guardar recursos originales, gráficos ni derivados en Git:\n' +
      forbidden.join('\n'),
  );
  process.exitCode = 1;
} else
  console.log('Git contiene solo código y documentación; no hay recursos del juego ni gráficos.');
