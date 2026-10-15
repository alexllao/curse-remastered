import { defineConfig, type Plugin } from 'vite';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const modsRoot = fileURLToPath(new URL('../../mods', import.meta.url));
async function packs() {
  const entries = await readdir(modsRoot, { withFileTypes: true });
  const excluded = new Set(['original', 'referencias', 'escalado']);
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
        fileName: '__mods/packs.json',
        source: JSON.stringify(await packs()),
      });
    },
  };
}
export default defineConfig({
  publicDir: '../../mods',
  plugins: [localPacks()],
  server: { host: '127.0.0.1', port: 8787 },
});
