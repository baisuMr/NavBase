import { defineStore } from 'pinia'
import { initFaviconKey, clearFaviconKey } from '../utils/faviconKey'

const TOKEN_KEY = 'auth_token'
const USERNAME_KEY = 'auth_username'
const EXPIRES_KEY = 'auth_expires_at'

// 记住设备：勾选 → localStorage（30 天）；不勾选 → sessionStorage（关浏览器即失效）
function authStorage(remember) {
  return remember ? localStorage : sessionStorage
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    username: '',
    expiresAt: 0
  }),

  getters: {
    // 由 token 推导登录标记，避免与凭据双写不同步
    isAuthenticated: (state) => !!state.token
  },

  actions: {
    // 初始化时检查登录状态（localStorage 优先，其次 sessionStorage）
    init() {
      if (this.restoreFrom(localStorage) || this.restoreFrom(sessionStorage)) {
        // fire-and-forget 派生 favicon key（init 保持同步，k 就绪后由 ref 触发重渲染）
        initFaviconKey(this.token).catch(() => {})
        return
      }
      this.clearAuth()
    },

    // 从指定存储恢复登录态；过期残留会被清理。成功返回 true
    restoreFrom(storage) {
      const token = storage.getItem(TOKEN_KEY)
      const expiresAt = parseInt(storage.getItem(EXPIRES_KEY) || '0')

      if (token && expiresAt && Date.now() < expiresAt) {
        this.token = token
        this.username = storage.getItem(USERNAME_KEY) || ''
        this.expiresAt = expiresAt
        return true
      }

      if (token) {
        storage.removeItem(TOKEN_KEY)
        storage.removeItem(USERNAME_KEY)
        storage.removeItem(EXPIRES_KEY)
      }
      return false
    },

    // 登录；remember=true 时凭据持久化到 localStorage
    async login(username, password, remember = false) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password, remember })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '登录失败')
        }

        const data = await response.json()
        const rememberMe = data.remember === true

        // 保存登录状态
        this.token = data.token
        this.username = data.username
        this.expiresAt = data.expiresAt

        // 派生 favicon 持证 URL 的 k（与登录态同步就绪）
        await initFaviconKey(data.token)

        // 写入所选存储并清理另一处，避免两处残留不同凭据
        const target = authStorage(rememberMe)
        const other = target === localStorage ? sessionStorage : localStorage
        other.removeItem(TOKEN_KEY)
        other.removeItem(USERNAME_KEY)
        other.removeItem(EXPIRES_KEY)
        target.setItem(TOKEN_KEY, data.token)
        target.setItem(USERNAME_KEY, data.username)
        target.setItem(EXPIRES_KEY, String(data.expiresAt))

        return {
          success: true,
          durationDays: data.durationDays,
          remember: rememberMe
        }
      } catch (error) {
        console.error('Login error:', error)
        throw error
      }
    },

    // 登出
    logout() {
      this.clearAuth()
    },

    // 清除认证信息
    clearAuth() {
      this.token = ''
      this.username = ''
      this.expiresAt = 0

      for (const storage of [localStorage, sessionStorage]) {
        storage.removeItem(TOKEN_KEY)
        storage.removeItem(USERNAME_KEY)
        storage.removeItem(EXPIRES_KEY)
      }

      // 登出/清理时同步清空 favicon key
      clearFaviconKey()
    },

    // 获取认证头
    getAuthHeaders() {
      return this.token ? { Authorization: `Basic ${this.token}` } : {}
    }
  }
})
