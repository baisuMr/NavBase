import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { safeRedirectPath } from '../utils/redirect'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/quick-add',
      name: 'quick-add',
      component: () => import('../views/QuickAdd.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }
    },
    {
      // 兜底：站内未知路径一律回首页，避免渲染空白页
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// 路由守卫
router.beforeEach((to) => {
  const authStore = useAuthStore()

  // 初始化登录状态
  authStore.init()

  // 检查是否需要认证
  if (to.meta.requiresAuth !== false) {
    // 需要认证的页面
    if (!authStore.isAuthenticated) {
      // 未登录，跳转到登录页并记住来源（如书签栏快捷添加弹窗），登录后回跳
      return { name: 'login', query: { redirect: to.fullPath } }
    }
  }

  // 已登录时访问登录页，跳转到来源页（校验仅允许站内路径，防开放重定向）
  if (to.name === 'login' && authStore.isAuthenticated) {
    return safeRedirectPath(to.query.redirect)
  }

  return true
})

export default router
