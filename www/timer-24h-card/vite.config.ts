import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: {
        'timer-24h-card': 'src/timer-24h-card.ts',
        'timer-24h-card-editor': 'src/timer-24h-card-editor.ts'
      },
      formats: ['es']
    },
    outDir: '.',
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: '[name].js',
        format: 'es'
      }
    },
    target: 'es2020',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
