import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: '../../mods',
  server: { host: '127.0.0.1', port: 8787 },
});
