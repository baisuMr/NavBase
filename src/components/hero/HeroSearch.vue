<template>
  <div class="hero-search-block">
    <!-- 引擎切换 -->
    <SearchEngineTabs
      :engines="engines"
      :current-id="currentEngineId"
      @select="onSelectEngine"
    />

    <!-- 搜索框 -->
    <form class="hero-search-bar" @submit.prevent="onSubmit">
      <div class="hero-search-input-wrap">
        <span class="search-icon">
          <span class="material-symbols-outlined">search</span>
        </span>
        <input
          ref="inputEl"
          v-model="query"
          type="text"
          class="hero-search-input"
          :placeholder="placeholder"
          autocomplete="off"
          @input="onInput"
          @focus="hasFocus = true"
          @blur="onBlur"
        />
        <button
          v-if="query"
          type="button"
          class="hero-search-clear"
          @click="onClear"
          aria-label="清空"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
        <button
          v-if="query"
          type="submit"
          class="hero-search-submit-hint"
          aria-label="搜索"
        >
          <span>↵</span>
          <span>搜索</span>
        </button>
      </div>

      <!-- 站内结果下拉 -->
      <div
        v-if="showDropdown && (internalResults.length > 0 || showEngineHint)"
        class="hero-search-results"
        @mousedown.prevent
      >
        <a
          v-for="bm in internalResults"
          :key="bm.id"
          :href="bm.url"
          target="_blank"
          rel="noopener noreferrer"
          class="hero-search-result"
          @click="onResultClick"
        >
          <span class="hero-search-result-favicon">
            <img v-if="bm.icon_url" :src="bm.icon_url" :alt="bm.title" loading="lazy" @error="hideImg" />
            <span v-else class="material-symbols-outlined" style="font-size:var(--icon-size-sm);color:var(--color-on-surface-variant)">link</span>
          </span>
          <span class="hero-search-result-info">
            <span class="hero-search-result-title">{{ bm.title }}</span>
            <span class="hero-search-result-url">{{ bm.url }}</span>
          </span>
        </a>

        <div v-if="internalResults.length > 0 && showEngineHint" class="hero-search-engine-hint">
          <span class="hero-search-result-engine-hint">
            ↵ 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
          </span>
        </div>

        <div v-if="internalResults.length === 0 && showEngineHint" class="hero-search-empty">
          无站内匹配，按 <strong style="color:var(--color-primary)">↵</strong> 用 {{ currentEngineLabel }} 搜索 "{{ query }}"
        </div>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SearchEngineTabs from '../common/SearchEngineTabs.vue'
import { useSearchEngines } from '../../composables/useSearchEngines'

const props = defineProps({
  bookmarks: {
    type: Array,
    default: () => []
  },
  username: {
    type: String,
    default: ''
  }
})

const inputEl = ref(null)
const query = ref('')
const hasFocus = ref(false)

const { engines, currentEngineId, setEngine, resolveAndOpen } = useSearchEngines()

const currentEngineLabel = computed(() => engines.find(e => e.id === currentEngineId.value)?.label || '')

const placeholder = computed(() => {
  const name = props.username || '管理员'
  return `${name}，键入关键词或粘贴网页链接…`
})

// 站内匹配：标题 / URL / 域名
const internalResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return props.bookmarks
    .filter(b =>
      b.title.toLowerCase().includes(q) ||
      b.url.toLowerCase().includes(q)
    )
    .slice(0, 6)
})

// 仅当有输入且失焦状态下也保留
const showDropdown = computed(() => query.value.trim() && hasFocus.value)

// 当有输入且回车可触发引擎搜索
const showEngineHint = computed(() => query.value.trim().length > 0)

function onInput() {
  hasFocus.value = true
}

function onBlur() {
  // 延迟关闭，避免点击下拉时先失焦
  setTimeout(() => { hasFocus.value = false }, 150)
}

function onClear() {
  query.value = ''
  inputEl.value?.focus()
}

function onSelectEngine(id) {
  setEngine(id)
  inputEl.value?.focus()
}

function onResultClick() {
  // 站内命中点击后清理
  query.value = ''
  hasFocus.value = false
}

function onSubmit() {
  const result = resolveAndOpen(query.value)
  if (!result) return
  // 回车一律按当前规则跳转：域名直达或当前引擎搜索（即使站内有匹配结果）
  window.open(result.target, '_blank', 'noopener,noreferrer')
  query.value = ''
  hasFocus.value = false
}

function hideImg(e) {
  e.target.style.display = 'none'
}

function focus() {
  inputEl.value?.focus()
  inputEl.value?.select()
}

defineExpose({ focus })
</script>
