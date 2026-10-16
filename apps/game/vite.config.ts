import { graphicsCatalog } from '../../tools/graphics-catalog.mjs';
import { defineConfig, type Plugin } from 'vite';
import { soundPacksCatalog } from '../../tools/sounds-catalog.mjs';
import { framesCatalog } from '../../tools/frames-catalog.mjs';
import { musicCatalog } from '../../tools/music-catalog.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const packageInfo = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
) as { version: string };
const buildTimestamp = new Date().toISOString();

const assetsRoot = fileURLToPath(new URL('../../assets', import.meta.url));
const packs = () => graphicsCatalog(assetsRoot);
// Paquetes musicales Remaster/Amiga conservados, desactivados hasta nueva revisión.
// Solo se publican capturas de controladores originales; «Sin música» sigue disponible en la interfaz.
const music = () => musicCatalog(assetsRoot, { enabledVersions: ['dosbox-mt32', 'dosbox-adlib'] });
function localPacks(): Plugin {
  return {
    name: 'curse-local-graphics-packs',
    configureServer(server) {
      server.middlewares.use('/__assets/game.json', (_req, res) => {
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
      server.middlewares.use('/__assets/sounds.json', (_req, res) => {
        void soundPacksCatalog(assetsRoot)
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
      server.middlewares.use('/__assets/music.json', (_req, res) => {
        void music()
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
      server.middlewares.use('/__assets/frames.json', (_req, res) => {
        void framesCatalog(assetsRoot)
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
      server.middlewares.use('/__assets/packs.json', (_req, res) => {
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
        fileName: '__assets/frames.json',
        source: JSON.stringify(await framesCatalog(assetsRoot)),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__assets/game.json',
        source: await readFile(
          fileURLToPath(new URL('../../reports/playtest/manifest.json', import.meta.url)),
          'utf8',
        ),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__assets/sounds.json',
        source: JSON.stringify(await soundPacksCatalog(assetsRoot)),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__assets/music.json',
        source: JSON.stringify(await music()),
      });
      this.emitFile({
        type: 'asset',
        fileName: '__assets/packs.json',
        source: JSON.stringify(await packs()),
      });
    },
  };
}
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageInfo.version),
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
  publicDir: '../../assets',
  plugins: [localPacks()],
  server: { host: '127.0.0.1', port: 8787, allowedHosts: ['8a7f-95-129-254-159.ngrok-free.app'] },
});
