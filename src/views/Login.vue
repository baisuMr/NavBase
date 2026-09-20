<template>
  <div class="login-page">
    <main class="login-main">
      <div class="login-card">
        <!-- 品牌头 -->
        <div class="login-brand">
          <div class="login-brand-icon">
            <span class="material-symbols-outlined">bookmarks</span>
          </div>
          <h1 class="login-brand-title">欢迎登录</h1>
          <p class="login-brand-sub">登录您的栞记空间</p>
        </div>

        <!-- 登录表单 -->
        <form class="login-form" @submit.prevent="handleLogin">
          <div class="login-input-wrap">
            <label class="form-label" for="login-username">账号</label>
            <div class="login-input-inner">
              <span class="login-input-icon">
                <span class="material-symbols-outlined">alternate_email</span>
              </span>
              <input
                id="login-username"
                v-model="form.username"
                type="text"
                class="input"
                placeholder="name@domain.com"
                required
                autocomplete="username"
              />
            </div>
          </div>

          <div class="login-input-wrap">
            <label class="form-label" for="login-password">密码</label>
            <div class="login-input-inner">
              <span class="login-input-icon">
                <span class="material-symbols-outlined">lock</span>
              </span>
              <input
                id="login-password"
                v-model="form.password"
                :type="showPwd ? 'text' : 'password'"
                class="input"
                placeholder="••••••••••••"
                required
                autocomplete="current-password"
              />
              <button
                type="button"
                class="login-input-toggle"
                @click="showPwd = !showPwd"
                :aria-label="showPwd ? '隐藏密码' : '显示密码'"
              >
                <span class="material-symbols-outlined">
                  {{ showPwd ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <div v-if="error" class="form-error">{{ error }}</div>

          <button
            type="submit"
            class="btn btn-primary login-submit"
            :disabled="loading"
          >
            <template v-if="loading">
              <span class="login-loading-spinner"></span>
              <span>登录中…</span>
            </template>
            <template v-else-if="success">
              <span class="material-symbols-outlined" style="font-size:var(--icon-size-md);">check_circle</span>
              <span>登录成功</span>
            </template>
            <template v-else>
              <span>登 录</span>
              <span class="material-symbols-outlined" style="font-size:var(--icon-size-md);">arrow_forward</span>
            </template>
          </button>
        </form>
      </div>
    </main>

    <div class="login-footer">
      <span style="font-family:var(--font-mono);font-size:var(--fs-label-sm);opacity:0.6;letter-spacing:0.04em;">
        栞记
      </span>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { login } = useAuth()

const form = reactive({ username: '', password: '' })
const showPwd = ref(false)
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function handleLogin() {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    await login(form.username, form.password)
    success.value = true
    setTimeout(() => router.push('/'), 500)
  } catch (err) {
    error.value = err.message || '登录失败'
  } finally {
    loading.value = false
  }
}
</script>
