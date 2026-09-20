import { ref } from 'vue'

// 主题偏好：纯本地 UI 设置，存 localStorage（不进服务端 settings 白名单）
const THEME_KEY = 'nav-theme'

function initialTheme() {
  return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
}

// 模块级单例；副作用在 main.js import 时即应用 data-theme，避免挂载后闪色
const theme = ref(initialTheme())

function applyTheme() {
  document.documentElement.dataset.theme = theme.value
}

applyTheme()

export function useTheme() {
  function setTheme(mode) {
    if (mode !== 'light' && mode !== 'dark') return
    theme.value = mode
    localStorage.setItem(THEME_KEY, mode)
    applyTheme()
  }

  return { theme, setTheme }
}
