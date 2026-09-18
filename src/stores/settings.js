import { defineStore } from 'pinia'
import { settingsApi } from '../api/settings'

// 站点名称的默认值（设置表为空或已清除时生效，可在设置面板修改）
export const DEFAULT_SITE_NAME = '栞记'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    siteName: '',
    avatar: '',
    loaded: false
  }),

  getters: {
    displayName: (state) => state.siteName || DEFAULT_SITE_NAME
  },

  actions: {
    async fetchSettings() {
      try {
        const data = await settingsApi.get()
        this.applySettings(data)
        this.loaded = true
      } catch (error) {
        console.error('Failed to fetch settings:', error)
      }
    },

    async updateSettings(partial) {
      const data = await settingsApi.update(partial)
      this.applySettings(data)
    },

    // 以服务端返回值为准同步本地状态与浏览器标签标题
    applySettings(data) {
      this.siteName = data.site_name || ''
      this.avatar = data.avatar || ''
      document.title = this.displayName
    }
  }
})
