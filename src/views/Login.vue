<template>
  <div class="login-page">
    <main class="login-card">
      <!-- 品牌头 -->
      <div class="login-brand">
        <div class="login-brand-icon">
          <i class="ri-flash-fill"></i>
        </div>
        <h1 class="login-brand-title">欢迎登录 {{ siteName }}</h1>
        <p class="login-brand-subtitle">同步你的书签资料库，打造极致纯净的起始页</p>
      </div>

      <!-- 登录表单 -->
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="login-field">
          <label class="login-label" for="login-username">用户名</label>
          <input
            id="login-username"
            v-model="form.username"
            type="text"
            class="login-input"
            placeholder="username"
            required
            autocomplete="username"
          />
        </div>

        <div class="login-field">
          <label class="login-label" for="login-password">密码</label>
          <div class="login-input-wrap">
            <input
              id="login-password"
              v-model="form.password"
              :type="showPwd ? 'text' : 'password'"
              class="login-input has-password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
            />
            <button
              type="button"
              class="login-password-toggle"
              :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              @click="showPwd = !showPwd"
            >
              <i :class="showPwd ? 'ri-eye-off-line' : 'ri-eye-line'"></i>
            </button>
          </div>
        </div>

        <label class="login-remember">
          <input v-model="remember" type="checkbox" />
          <span class="login-checkbox"><i class="ri-check-line"></i></span>
          <span class="login-remember-text">记住此设备（30天内免登录）</span>
        </label>

        <div v-if="error" class="login-error" role="alert">{{ error }}</div>

        <button type="submit" class="login-submit" :disabled="loading || success">
          <template v-if="loading">
            <span class="login-spinner"></span>
            <span>正在登录...</span>
          </template>
          <template v-else-if="success">
            <i class="ri-check-line"></i>
            <span>登录成功</span>
          </template>
          <template v-else>
            <span>立即登录</span>
            <i class="ri-arrow-right-line"></i>
          </template>
        </button>
      </form>
    </main>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useSettingsStore } from '../stores/settings'
import { safeRedirectPath } from '../utils/redirect'

const router = useRouter()
const route = useRoute()
const { login } = useAuth()
const settings = useSettingsStore()

const siteName = computed(() => settings.displayName)

const form = reactive({ username: '', password: '' })
const remember = ref(true)
const showPwd = ref(false)
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    await login(form.username, form.password, remember.value)
    success.value = true
    // 回跳来源页（如书签栏快捷添加），无来源则回首页
    setTimeout(() => router.push(safeRedirectPath(route.query.redirect)), 500)
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
