import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useAuth() {
  const store = useAuthStore()

  const isAuthenticated = computed(() => store.isAuthenticated)
  const username = computed(() => store.username)
  const token = computed(() => store.token)
  const isExpired = computed(() => store.isExpired)

  // 初始化时检查登录状态
  onMounted(() => {
    store.init()
  })

  const login = (username, password) => store.login(username, password)
  const logout = () => store.logout()

  return {
    isAuthenticated,
    username,
    token,
    isExpired,
    login,
    logout
  }
}
