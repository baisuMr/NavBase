import { computed, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'

export function useAuth() {
  const store = useAuthStore()

  const username = computed(() => store.username)

  // 初始化时检查登录状态
  onMounted(() => {
    store.init()
  })

  const login = (username, password, remember) => store.login(username, password, remember)
  const logout = () => store.logout()

  return {
    username,
    login,
    logout
  }
}
