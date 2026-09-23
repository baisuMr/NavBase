import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['worker/**/*.test.js', 'src/**/*.test.js']
    // 需要 DOM 的测试文件在顶部标注：// @vitest-environment happy-dom
  }
})
