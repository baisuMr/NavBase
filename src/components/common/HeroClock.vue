<template>
  <!-- 时钟 -->
  <div class="hero-clock">
    <span class="hero-clock-hm">{{ hhmm }}</span>
    <span class="hero-clock-sec">:{{ ss }}</span>
  </div>

  <!-- 日期行 -->
  <div class="hero-meta">
    <span class="hero-meta-date">{{ gregorianText }}</span>
    <span class="badge badge-primary">{{ weekdayText }}</span>
    <span class="hero-meta-dot">•</span>
    <span>{{ lunarText }}</span>
    <span class="hero-meta-dot">•</span>
    <span class="badge badge-mono">第 {{ weekOfYear }} 周</span>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDateInfo } from '../../composables/useLunar'

// 时钟/日期行独立成组件：秒级 tick 只重渲染本子树，
// 不牵动 Home 整页（搜索框/固定卡片/弹窗）每秒 diff
// （农历每分钟异步刷新）
const { getLunarText, getWeekOfYear, getGregorianText, getWeekdayText } = useDateInfo()

const now = ref(new Date())
let clockTimer = null
let lunarTimer = null

const hhmm = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const ss = computed(() => String(now.value.getSeconds()).padStart(2, '0'))
const gregorianText = computed(() => getGregorianText(now.value))
const weekdayText = computed(() => getWeekdayText(now.value))
const weekOfYear = computed(() => getWeekOfYear(now.value))
// 农历依赖较大，动态加载后异步填充
const lunarText = ref('')

async function refreshLunar() {
  lunarText.value = await getLunarText(now.value)
}

onMounted(() => {
  refreshLunar()
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
  // 农历一天才变一次，每分钟刷新足够
  lunarTimer = setInterval(refreshLunar, 60000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (lunarTimer) clearInterval(lunarTimer)
})
</script>
