import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('auth_token') || '',
    username: localStorage.getItem('auth_username') || '',
    expiresAt: parseInt(localStorage.getItem('auth_expires_at') || '0'),
    isAuthenticated: false
  }),

  getters: {
    // 检查是否已过期
    isExpired: (state) => {
      if (!state.expiresAt) return true
      return Date.now() > state.expiresAt
    },

    // 剩余天数
    remainingDays: (state) => {
      if (!state.expiresAt) return 0
      const remaining = state.expiresAt - Date.now()
      return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
    }
  },

  actions: {
    // 初始化时检查登录状态
    init() {
      const token = localStorage.getItem('auth_token')
      const expiresAt = parseInt(localStorage.getItem('auth_expires_at') || '0')

      if (token && expiresAt && Date.now() < expiresAt) {
        this.token = token
        this.username = localStorage.getItem('auth_username') || ''
        this.expiresAt = expiresAt
        this.isAuthenticated = true
      } else {
        // 已过期，清除登录状态
        this.clearAuth()
      }
    },

    // 登录
    async login(username, password) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || '登录失败')
        }

        const data = await response.json()

        // 保存登录状态
        this.token = data.token
        this.username = data.username
        this.expiresAt = data.expiresAt
        this.isAuthenticated = true

        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_username', data.username)
        localStorage.setItem('auth_expires_at', String(data.expiresAt))

        return {
          success: true,
          durationDays: data.durationDays
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
      this.isAuthenticated = false

      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_username')
      localStorage.removeItem('auth_expires_at')
    },

    // 获取认证头
    getAuthHeaders() {
      return this.token ? { Authorization: `Basic ${this.token}` } : {}
    }
  }
})
