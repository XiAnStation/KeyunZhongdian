import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { join } from 'path'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: {
      '@': join(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    host: true,
    cors: true,
    strictPort: true,
    hmr: {
      port: 3000
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'cjs'
      }
    }
  }
}) 