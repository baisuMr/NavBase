import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// dev 与 preview 共用的 API 代理（vite preview 读 preview.proxy 而非 server.proxy）
const apiProxy = {
  '/api': {
    target: 'http://localhost:8788',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy }
})
