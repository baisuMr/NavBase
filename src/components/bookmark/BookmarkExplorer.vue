<template>
  <section id="explorer-section" class="explorer">
    <!-- 工具栏：分类 tabs + 添加 -->
    <div class="explorer-toolbar">
      <div ref="tabsRef" class="category-tabs">
        <button
          type="button"
          class="category-tab category-tab-all"
          :class="{ active: activeCat === 'all' }"
          @click="$emit('select-category', 'all')"
        >
          <span>全部</span>
          <span class="category-tab-count">{{ bookmarks.length }}</span>
        </button>
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="category-tab category-tab-cat"
          :class="{ active: activeCat === cat.id }"
          :style="activeCat === cat.id ? { backgroundColor: cat.color, borderColor: cat.color } : { borderColor: cat.color }"
          @click="$emit('select-category', cat.id)"
          @contextmenu.prevent="$emit('category-menu', $event, cat)"
        >
          <!-- 分类图标：未激活用分类色，激活继承白色文字色；非 ri- 前缀（旧数据 emoji 等）回退默认图标 -->
          <i
            v-if="cat.icon"
            :class="resolveCategoryIcon(cat.icon)"
            :style="activeCat !== cat.id ? { color: cat.color } : null"
          ></i>
          <span>{{ cat.name }}</span>
          <span class="category-tab-count">{{ cat.count }}</span>
        </button>
        <!-- 未分类 tab：钉在分类区末尾（非真实分类：无右键菜单、不可拖），样式同「全部」 -->
        <button
          type="button"
          class="category-tab category-tab-uncat"
          :class="{ active: activeCat === 'uncategorized' }"
          @click="$emit('select-category', 'uncategorized')"
        >
          <i class="ri-inbox-line"></i>
          <span>未分类</span>
          <span class="category-tab-count">{{ uncategorizedCount }}</span>
        </button>
        <!-- 操作按钮：添加分类（分类 tab 同款白底描边）+ 添加网址（主色实底），与 tab 等高连排 -->
        <button
          type="button"
          class="category-tab category-tab-add"
          @click="$emit('add-category')"
        >
          <i class="ri-add-line"></i>
          <span>添加分类</span>
        </button>
        <button class="explorer-add-btn" type="button" @click="$emit('add-bookmark')">
          <i class="ri-add-line"></i>
          <span>添加网址</span>
        </button>
      </div>
    </div>

    <!-- 网格 -->
    <div class="bookmark-grid">
      <template v-if="visibleBookmarks.length > 0">
        <BookmarkCard
          v-for="bm in visibleBookmarks"
          :key="bm.id"
          :bookmark="bm"
          @menu="$emit('menu', $event, bm)"
        />
      </template>
      <div v-else-if="!loading && !error" class="bookmark-empty">
        <i class="ri-bookmark-line"></i>
        <div>{{ emptyText }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import BookmarkCard from './BookmarkCard.vue'
import { moveInArray } from '../../utils/reorder'
import { filterBookmarks } from '../../utils/filterBookmarks'
import { resolveCategoryIcon } from '../../constants/categoryIcons'

const props = defineProps({
  bookmarks: {
    type: Array,
    required: true
  },
  categories: {
    type: Array,
    required: true
  },
  activeCat: {
    type: [String, Number],
    default: 'all'
  },
  // 加载中/加载失败时不显示「暂无书签」空态，避免误导（失败提示由外层横幅承担）
  loading: {
    type: Boolean,
    default: false
  },
  error: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['add-bookmark', 'add-category', 'select-category', 'category-menu', 'menu', 'reorder'])

// ── 分类 tab 拖动排序（仅分类 tab 可拖；「全部」钉首位、操作按钮钉末尾） ──
const tabsRef = ref(null)
let sortable = null
let dragStartNext = null

onMounted(async () => {
  // sortablejs 体积较大且登录后才可能用到，动态加载移出首屏主包
  const { default: Sortable } = await import('sortablejs')
  // 动态加载期间组件可能已卸载（模板引用会被置空）
  if (!tabsRef.value) return
  sortable = Sortable.create(tabsRef.value, {
    animation: 150,
    draggable: '.category-tab-cat',
    ghostClass: 'category-tab-ghost',
    onMove(evt) {
      const related = evt.related
      if (!related) return
      // 「全部」只允许落到其后
      if (related.classList.contains('category-tab-all')) return evt.willInsertAfter ? true : false
      // 未分类钉在分类区末尾：只允许落到其前，其后 = 操作按钮区（禁止）
      if (related.classList.contains('category-tab-uncat')) return evt.willInsertAfter ? false : true
      // 添加分类之前 = 分类区末尾（允许）；其后 = 两按钮之间（禁止）
      if (related.classList.contains('category-tab-add')) return evt.willInsertAfter ? false : true
      // 添加网址前后均为按钮区（禁止）
      if (related.classList.contains('explorer-add-btn')) return false
    },
    onStart(evt) {
      dragStartNext = evt.item.nextSibling
    },
    onEnd(evt) {
      // 先还原 DOM：SortableJS 直接搬动了节点，交回 Vue 按数据渲染，避免虚拟 DOM 对不齐
      evt.from.insertBefore(evt.item, dragStartNext)
      dragStartNext = null
      const { oldDraggableIndex, newDraggableIndex } = evt
      if (oldDraggableIndex === newDraggableIndex) return
      const ids = props.categories.map(c => c.id)
      emit('reorder', moveInArray(ids, oldDraggableIndex, newDraggableIndex))
    }
  })
})

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
})

const uncategorizedCount = computed(() => props.bookmarks.filter(b => !b.category_id).length)

const visibleBookmarks = computed(() => filterBookmarks(props.bookmarks, props.activeCat))

const emptyText = computed(() => {
  if (props.activeCat === 'uncategorized') return '暂无未分类书签'
  if (props.activeCat !== 'all') return '该分类下暂无书签'
  return '暂无书签，点击「添加网址」添加'
})
</script>
