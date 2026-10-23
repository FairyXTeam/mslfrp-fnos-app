import { defineConfig } from 'vite';
import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/app/mslfrp/',
  plugins: [
    tailwindcss(),
    vue()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: '../app/ui/dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000
  }
});
