import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
/** El nombre numérico identifica el argumento del evento original, no una escena. */
export async function soundsCatalog(root) {
  let files;
  try {
    files = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { schemaVersion: 1, events: {} };
    throw error;
  }
  const media = files.filter(
    (f) => f.isFile() && /\.(ogg|opus|mp3|m4a|wav|flac|aac)$/i.test(f.name),
  );
  let mapping = {};
  try {
    mapping = JSON.parse(
      (await readFile(join(root, 'sounds.json'), 'utf8')).replace(/^\uFEFF/, ''),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const events = {};
  for (const file of media) {
    const base = file.name.replace(/\.[^.]+$/, '');
    if (/^\d{1,3}$/.test(base) && Number(base) < 256) events[String(Number(base))] = file.name;
  }
  for (const [id, file] of Object.entries(mapping.events ?? {}))
    if (/^\d{1,3}$/.test(id) && Number(id) < 256 && media.some((f) => f.name === file))
      events[String(Number(id))] = file;
  return {
    schemaVersion: 1,
    events: Object.fromEntries(
      Object.entries(events).map(([id, file]) => [
        id,
        `/sonidos/original/${encodeURIComponent(file)}`,
      ]),
    ),
  };
}
