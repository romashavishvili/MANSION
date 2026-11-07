import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5173, strictPort: false, host: true },
  preview: { port: 4173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500, sourcemap: false },
  assetsInclude: ['**/*.glb'],
  base:'/MANSION/',
});
