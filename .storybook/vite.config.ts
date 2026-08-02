import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Storybook-only Vite config. The library build (vite.config.ts) uses
// vite-plugin-dts + css-injected-by-js which require dist/ artifacts that
// don't exist in a fresh CI checkout. Storybook needs neither, so keep this
// config minimal — the demo build must be self-contained.
export default defineConfig({
  plugins: [react()],
});
