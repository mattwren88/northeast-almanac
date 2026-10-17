import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from a subpath; local dev serves from the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/northeast-almanac/' : '/',
  plugins: [react()],
  build: {
    // MapLibre's own chunk is ~1 MB (285 kB gzip). It's lazy-loaded by the Map
    // view only (src/lib/basemap.js), so it doesn't cost the first page load.
    chunkSizeWarningLimit: 1100,
  },
}));
