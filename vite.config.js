import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// remixicon 全量 CSS 会把 eot/ttf/svg/woff 旧格式字体一并打包（约 4.5MB 产物），
// 现代浏览器均支持 woff2，裁掉其余格式的 @font-face src，产物只保留 woff2
function remixiconWoff2Only() {
  return {
    name: 'remixicon-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0].endsWith('remixicon.css')) return
      // 提取原 woff2 的 url(...)-format(...) 项（含 query），整体替换两段 src 声明；
      // 结构变化匹配不到时保持原样（fail-open，不影响构建）
      const woff2 = code.match(/url\((["'])remixicon\.woff2[^)]+\)\s*format\((["'])woff2\2\)/)
      if (!woff2) return
      return {
        code: code.replace(/src:[\s\S]*?format\((["'])svg\1\);/, `src: ${woff2[0]};`),
        map: null
      }
    }
  }
}

// dev 与 preview 共用的 API 代理（vite preview 读 preview.proxy 而非 server.proxy）
const apiProxy = {
  '/api': {
    target: 'http://localhost:8788',
    changeOrigin: true
  }
}

export default defineConfig({
  plugins: [vue(), remixiconWoff2Only()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy }
})
