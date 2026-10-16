import { defineConfig, type Plugin } from 'vite';
import { soundPacksCatalog } from '../../tools/sounds-catalog.mjs';
import { framesCatalog } from '../../tools/frames-catalog.mjs';
import { musicCatalog } from '../../tools/music-catalog.mjs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const modsRoot = fileURLToPath(new URL('../../mods/graficos', import.meta.url));
async function packs() {
  const entries = await readdir(modsRoot, { withFileTypes: true });
  const excluded = new Set(['original', 'referencias', 'escalado', 'audio']);
  const names = entries
    .filter(
      (entry) => entry.isDirectory() && !entry.name.startsWith('.') && !excluded.has(entry.name),
    )
    .map((entry) => entry.name);
  if (!names.includes('remaster')) names.push('remaster');
  names.sort((a, b) =>
    a === 'remaster' ? -1 : b === 'remaster' ? 1 : a.localeCompare(b, 'es', { numeric: true }),
  );
  return {
    schemaVersion: 1,
    packs: [
      { id: 'original', label: 'Original' },
      ...names.map((id) => ({ id, label: id === 'remaster' ? 'Remaster' : id })),
    ],
  };
}
function localPacks(): Plugin {
  return {
    name: 'curse-local-graphics-packs',
    configureServer(server) {
      server.middlewares.use('/__mods/game.json', (_req, res) => {
        void readFile(
          fileURLToPath(new URL('../../reports/playtest/manifest.json', import.meta.url)),
          'utf8',
        )
          .then((data) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(data);
          })
          .catch(() => {
            res.statusCode = 404;
            res.end('Prepare local game assets');
          });
      });
      server.middlewares.use('/__mods/sounds.json', (_req, res) => {
        void soundPacksCatalog(fileURLToPath(new URL('../../mods/sonidos', import.meta.url)))
          .then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(result));
          })
          .catch(() => {
            res.statusCode = 500;
            res.end('Unable to list local sounds');
          });
      });
      server.middlewares.use('/__mods/music.json', (_req, res) => {
        void musicCatalog(fileURLToPath(new URL('../../mods/musica', import.meta.url)))
          .then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(result));
          })
          .catch(() => {
            res.statusCode = 500;
            res.end('Unable to list local music');
          });
      });
      server.middlewares.use('/__mods/frames.json', (_req, res) => {
        void framesCatalog(modsRoot)
          .then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(result));
          })
          .catch(() => {
            res.statusCode = 500;
            res.end('Unable to list local frames');
          });
      });
      server.middlewares.use('/__mods/packs.json', (_req, res) => {
        void packs()
          .then((result) => {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(JSON.stringify(result));
          })
          .catch(() => {
            res.statusCode = 500;
            res.end('Unable to list local packs');
          });
      });
    },
    async generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: '__mods/frames.json',
        source: JSON.stringify(await framesCatalog(modsRoot)),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__mods/game.json',
        source: await readFile(
          fileURLToPath(new URL('../../reports/playtest/manifest.json', import.meta.url)),
          'utf8',
        ),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__mods/sounds.json',
        source: JSON.stringify(
          await soundPacksCatalog(fileURLToPath(new URL('../../mods/sonidos', import.meta.url))),
        ),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__mods/music.json',
        source: JSON.stringify(
          await musicCatalog(fileURLToPath(new URL('../../mods/musica', import.meta.url))),
        ),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__mods/packs.json',
        source: JSON.stringify(await packs()),
      });
    },
  };
}
export default defineConfig({
  publicDir: '../../mods',
  plugins: [localPacks()],
  server: { host: '127.0.0.1', port: 8787, allowedHosts: ['8a7f-95-129-254-159.ngrok-free.app'] },
});
