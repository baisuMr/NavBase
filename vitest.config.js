import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 让测试中以文本形式 import .sql（与 wrangler.toml [[rules]] Text 对齐）；
  // vue 插件用于编译组件测试（Home / ToastMessage / BookmarkForm）中的 SFC
  plugins: [
    vue(),
    {
      name: 'import-sql-as-text',
      transform(code, id) {
        if (id.endsWith('.sql')) {
          return { code: `export default ${JSON.stringify(code)}`, map: null }
        }
      }
    }
  ],
  test: {
    environment: 'node',
    include: ['worker/**/*.test.js', 'src/**/*.test.js']
    // 需要 DOM 的测试文件在顶部标注：// @vitest-environment happy-dom
  }
})
