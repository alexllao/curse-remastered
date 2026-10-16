import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { executableSha256, sha256 } from './scene-palette.js';

/** Selector RS/MPU de 0x4FD5–0x5098. Solo exporta asociaciones de recursos verificadas. */
export async function prepareOriginalMusic(root: string) {
  const exe = await readFile(join(root, 'original/CURSE.EXE'));
  if (sha256(exe) !== executableSha256) throw new Error('Unverified music executable');
  const data = exe.subarray(exe.readUInt16LE(8) * 16 + 0xf310);
  const contexts: Record<string, string> = {};
  for (let resource = 0; resource < 78; resource++) {
    const index = data[0x80cd + resource];
    if (index > 4) throw new Error('Invalid original music index');
    const pointer = data.readUInt16LE(0x80b9 + index * 4 + 1);
    const track = data.subarray(pointer, data.indexOf(0, pointer)).toString('ascii').toUpperCase();
    if (!/^CURSE\.RS[1-5]$/.test(track)) throw new Error('Invalid original music filename');
    contexts[`scene:${resource}`] = track;
  }
  const folder = join(root, 'assets/original/musica');
  await mkdir(folder, { recursive: true });
  await writeFile(
    join(folder, 'native-contexts.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        executableSha256,
        contexts,
      },
      null,
      2,
    ) + '\n',
  );
}
