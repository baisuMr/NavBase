import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

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
      path: '/',
      name: 'home',
      component: () => import('../views/Home.vue'),
      meta: { requiresAuth: true }
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
      // 未登录，跳转到登录页
      return { name: 'login' }
    }
  }

  // 已登录时访问登录页，跳转到首页
  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'home' }
  }

  return true
})

export default router
