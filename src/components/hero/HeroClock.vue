<template>
  <div class="hero-center">
    <!-- 时钟 -->
    <div class="hero-clock">
      <span>{{ hhmm }}</span>
      <span class="hero-clock-seconds">:{{ ss }}</span>
    </div>

    <!-- 公历 / 农历 / 周数 -->
    <div class="hero-meta">
      <span class="hero-meta-date">{{ gregorianText }}</span>
      <span class="hero-meta-sep">•</span>
      <span class="hero-meta-lunar">{{ lunarText }}</span>
      <span class="hero-meta-sep">•</span>
      <span class="hero-meta-week">第 {{ weekOfYear }} 周</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDateInfo } from '../../composables/useLunar'

const { getLunarText, getWeekOfYear, getGregorianText } = useDateInfo()

const now = ref(new Date())
let timer = null

const hhmm = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const ss = computed(() => String(now.value.getSeconds()).padStart(2, '0'))

const gregorianText = computed(() => getGregorianText(now.value))
const lunarText = computed(() => getLunarText(now.value))
const weekOfYear = computed(() => getWeekOfYear(now.value))

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
