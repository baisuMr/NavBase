import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Remix Icon 图标子集（scripts/generate-icon-subset.mjs 生成，新增图标后需重跑）
import './styles/remixicon-subset.css'
import './styles/fonts.css'
import './styles/global.css'
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
