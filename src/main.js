import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/fonts.css'
import './styles/global.css'
// 副作用：在挂载前应用本地主题偏好（data-theme），避免闪色
import './composables/useTheme'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
