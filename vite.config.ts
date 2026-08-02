import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import cssInjectedByJs from 'vite-plugin-css-injected-by-js';

// Library build: ESM + CJS dual output with bundled type declarations.
// The single SCSS module is inlined into the JS (cssInjectedByJs) so
// consumers get the structural layout with zero extra imports; the same CSS
// is also emitted to dist/style.css for manual use.
export default defineConfig({
  plugins: [
    react(),
    cssInjectedByJs(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      include: ['src'],
      exclude: ['stories', 'test', 'src/vite-env.d.ts'],
      bundleTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
      cssFileName: 'style',
    },
    cssCodeSplit: false,
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // Interop-friendly globals for the CJS build.
        exports: 'named',
      },
    },
  },
});
