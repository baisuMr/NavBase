import { defineStore } from 'pinia'
import { settingsApi } from '../api/settings'
import { setFaviconCacheVer } from '../utils/faviconKey'

// 站点名称的默认值（设置表为空或已清除时生效，可在设置面板修改）
export const DEFAULT_SITE_NAME = 'NavBase'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    siteName: '',
    avatar: ''
  }),

  getters: {
    displayName: (state) => state.siteName || DEFAULT_SITE_NAME
  },

  actions: {
    async fetchSettings() {
      try {
        const data = await settingsApi.get()
        this.applySettings(data)
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
      // 图标缓存世代换代后图标 URL 变化，浏览器缓存整体作废
      setFaviconCacheVer(data.favicon_cache_ver)
      document.title = this.displayName
    }
  }
})
