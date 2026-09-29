import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { main: 'src/main/main.ts', preload: 'src/main/preload.ts' },
  // Sandboxed preload scripts must be CommonJS, so both bundles use it.
  format: ['cjs'],
  outExtension: () => ({ js: '.cjs' }),
  target: 'node22',
  platform: 'node',
  outDir: 'dist/main',
  external: ['electron'],
  clean: true,
  bundle: true,
  splitting: false,
});
