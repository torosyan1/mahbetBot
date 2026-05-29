import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Set BACKEND_PORT in your shell to match your Express server PORT (default 3000)
const BACKEND = `http://localhost:${process.env.BACKEND_PORT || 3000}`

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5991,
    proxy: {
      '/panel-login':    { target: BACKEND, changeOrigin: true },
      '/upload':         { target: BACKEND, changeOrigin: true },
      '/trigger':        { target: BACKEND, changeOrigin: true },
      '/trigger-stream': { target: BACKEND, changeOrigin: true },
      '/uploads':        { target: BACKEND, changeOrigin: true },
    }
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
  }
})
