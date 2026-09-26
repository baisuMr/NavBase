import { onMounted, onUnmounted } from 'vue'

export function useKeyboard(handlers) {
  function handleKeydown(e) {
    // Alt + K: 聚焦搜索框（原 Ctrl+K 与输入法/浏览器扩展冲突，改 Alt 系与 Alt+N 一致）
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.code === 'KeyK') {
      e.preventDefault()
      handlers.search?.()
    }

    // Alt + N: 添加书签
    // 注意：Ctrl+N / Ctrl+Shift+N 是浏览器保留快捷键（新建窗口/无痕窗口），
    // 网页无法拦截，因此使用 Alt 组合键；用 e.code 判定可兼容大小写锁定与输入法
    // 排除 Ctrl：AltGr（欧洲键盘 Ctrl+Alt 组合）输入字符时误触发，且会吞掉输入
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.code === 'KeyN') {
      e.preventDefault()
      handlers.addBookmark?.()
    }

    // Alt + Shift + N: 添加分类（同样排除 Ctrl/AltGr）
    if (e.altKey && !e.ctrlKey && e.shiftKey && e.code === 'KeyN') {
      e.preventDefault()
      handlers.addCategory?.()
    }

    // Escape: 关闭模态框/菜单
    if (e.key === 'Escape') {
      handlers.close?.()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown)
  })
}
