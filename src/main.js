import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Remix Icon 图标字体（woff2 由 Vite 自动本地化打包）
import 'remixicon/fonts/remixicon.css'
import './styles/fonts.css'
import './styles/global.css'
const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
