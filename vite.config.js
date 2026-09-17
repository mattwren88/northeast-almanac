import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves from a subpath; local dev serves from the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/northeast-almanac/' : '/',
  plugins: [react()],
}));
