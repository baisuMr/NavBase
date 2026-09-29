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
          :style="{ '--cat-color': cat.color }"
          @click="$emit('select-category', cat.id)"
          @contextmenu.prevent="$emit('category-menu', $event, cat)"
        >
          <!-- 分类图标：颜色由样式表按 --cat-color 统一消费；非 ri- 前缀（旧数据 emoji 等）回退默认图标 -->
          <i v-if="cat.icon" :class="resolveCategoryIcon(cat.icon)"></i>
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

    <!-- 书签列表：统一分类块（「全部」= 多块；单分类/未分类 = 单块），块内无书签时出空态 -->
    <div v-if="displayGroups.length > 0" ref="blocksRef" class="bookmark-blocks">
      <div
        v-for="group in displayGroups"
        :key="group.type === 'category' ? group.category.id : 'uncategorized'"
        class="category-block"
        :style="group.category ? { '--cat-color': group.category.color } : null"
      >
        <!-- 标题行：纯展示（分类操作仍走 tab pill 右键），图标着分类色与 tab 一致 -->
        <h3 class="category-block-title">
          <i v-if="group.category" :class="resolveCategoryIcon(group.category.icon)"></i>
          <i v-else class="ri-inbox-line"></i>
          <span>{{ group.category ? group.category.name : '未分类' }}</span>
        </h3>
        <div class="bookmark-grid">
          <BookmarkCard
            v-for="bm in group.bookmarks"
            :key="bm.id"
            :bookmark="bm"
            @menu="$emit('menu', $event, bm)"
          />
          <div v-if="group.bookmarks.length === 0 && !loading && !error" class="bookmark-empty">
            <i class="ri-bookmark-line"></i>
            <div>{{ emptyText }}</div>
          </div>
        </div>
      </div>
    </div>
    <!-- 无块可渲染（「全部」一个书签都没有 / 未知分类）：无块空态 -->
    <div v-else class="bookmark-grid">
      <div v-if="!loading && !error" class="bookmark-empty">
        <i class="ri-bookmark-line"></i>
        <div>{{ emptyText }}</div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BookmarkCard from './BookmarkCard.vue'
import { moveInArray } from '../../utils/reorder'
import { groupsForView } from '../../utils/groupBookmarks'
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

const emit = defineEmits(['add-bookmark', 'add-category', 'select-category', 'category-menu', 'menu', 'reorder', 'bookmark-reorder'])

// ── 分类 tab 拖动排序（仅分类 tab 可拖；「全部」钉首位、操作按钮钉末尾） ──
const tabsRef = ref(null)
let sortable = null
let dragStartNext = null

// ── 书签拖动排序（仅限所属分类内）：每个块的书签网格各挂一个 Sortable ──
const blocksRef = ref(null)
let SortableCtor = null
const gridSortables = []

// 拖完松手会误触发 click 打开链接：吞掉拖拽结束后短暂窗口内的点击
function swallowClick(e) {
  e.preventDefault()
  e.stopPropagation()
}
function armClickSwallow() {
  document.addEventListener('click', swallowClick, { capture: true, once: true })
  setTimeout(() => document.removeEventListener('click', swallowClick, { capture: true }), 300)
}

function bindGridSortables() {
  gridSortables.forEach((s) => s.destroy())
  gridSortables.length = 0
  if (!SortableCtor || !blocksRef.value) return
  for (const grid of blocksRef.value.querySelectorAll('.bookmark-grid')) {
    gridSortables.push(
      SortableCtor.create(grid, {
        animation: 150,
        draggable: '.bookmark-card',
        ghostClass: 'bookmark-card-ghost',
        // 各块独立列表（pull/put 关闭）：跨块拖不动，只在所属分类内重排
        group: { name: 'bookmark-grid', pull: false, put: false },
        // 触屏长按再拖，避免与页面滚动冲突
        delay: 150,
        delayOnTouchOnly: true,
        onStart(evt) {
          dragStartNext = evt.item.nextSibling
        },
        onEnd(evt) {
          // 新顺序在还原 DOM 前取出（此时节点已被 Sortable 搬到新位置）
          const ids = [...evt.from.querySelectorAll(':scope > .bookmark-card')].map((el) => Number(el.dataset.id))
          // 还原 DOM：SortableJS 直接搬动了节点，交回 Vue 按数据渲染，避免虚拟 DOM 对不齐
          evt.from.insertBefore(evt.item, dragStartNext)
          dragStartNext = null
          const { oldDraggableIndex, newDraggableIndex } = evt
          if (oldDraggableIndex !== newDraggableIndex) emit('bookmark-reorder', ids)
          armClickSwallow()
        }
      })
    )
  }
}

onMounted(async () => {
  // sortablejs 体积较大且登录后才可能用到，动态加载移出首屏主包
  const { default: Sortable } = await import('sortablejs')
  SortableCtor = Sortable
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
  bindGridSortables()
})

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
  gridSortables.forEach((s) => s.destroy())
  gridSortables.length = 0
  document.removeEventListener('click', swallowClick, { capture: true })
})

const uncategorizedCount = computed(() => props.bookmarks.filter(b => !b.category_id).length)

// 列表分块数据：「全部」多块（分类序在前、未分类垫后、空分类跳过）；单分类/未分类单块（空也出块）
const displayGroups = computed(() => groupsForView(props.bookmarks, props.categories, props.activeCat))

// 块随 tab 切换/增删变化后重建书签网格 Sortable（flush post：等 DOM 更新完）
watch(displayGroups, bindGridSortables, { flush: 'post' })

const emptyText = computed(() => {
  if (props.activeCat === 'uncategorized') return '暂无未分类书签'
  if (props.activeCat !== 'all') return '该分类下暂无书签'
  return '暂无书签，点击「添加网址」添加'
})
</script>
