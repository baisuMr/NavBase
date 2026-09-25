<template>
  <Modal title="设置" @close="$emit('close')">
    <div class="settings">
      <!-- 网站名称 -->
      <section class="settings-section">
        <label class="form-label" for="settings-site-name">网站名称</label>
        <div class="settings-row">
          <input
            id="settings-site-name"
            v-model="nameInput"
            type="text"
            class="input"
            maxlength="30"
            placeholder="NavBase"
          />
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="!nameChanged || nameSaving"
            @click="saveSiteName"
          >
            保存
          </button>
        </div>
      </section>

      <!-- 头像 -->
      <section class="settings-section">
        <span class="form-label">头像</span>
        <div class="settings-row">
          <div class="settings-avatar-preview">
            <img v-if="settings.avatar" :src="settings.avatar" alt="当前头像" />
            <i v-else class="ri-user-line"></i>
          </div>
          <div class="settings-avatar-actions">
            <button type="button" class="btn btn-secondary" :disabled="avatarSaving" @click="triggerAvatarUpload">
              <i class="ri-image-add-line" style="font-size:var(--icon-size-md);"></i>
              <span>{{ avatarSaving ? '上传中…' : '上传图片' }}</span>
            </button>
            <button
              v-if="settings.avatar"
              type="button"
              class="btn btn-ghost"
              :disabled="avatarSaving"
              @click="removeAvatar"
            >
              移除
            </button>
          </div>
        </div>
        <p class="form-hint">支持 png / jpeg / webp，自动裁剪压缩为 128×128。</p>
        <input
          ref="avatarInputRef"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style="display:none"
          @change="handleAvatarFile"
        />
      </section>

      <!-- 数据管理 -->
      <section class="settings-section">
        <span class="form-label">数据管理</span>
        <div class="settings-data-actions">
          <button type="button" class="btn btn-secondary" @click="triggerImport">
            <i class="ri-upload-line" style="font-size:var(--icon-size-md);"></i>
            <span>导入书签</span>
          </button>
          <button type="button" class="btn btn-secondary" @click="exportBookmarks">
            <i class="ri-download-line" style="font-size:var(--icon-size-md);"></i>
            <span>导出书签</span>
          </button>
        </div>
        <p class="form-hint">
          导入支持 Chrome、Edge、Firefox 等浏览器书签管理器导出的 HTML 文件
          （Netscape 书签格式）：文件夹会展开为分类，非网页链接自动跳过，重复书签自动去重；
          导出为 JSON 备份文件。
        </p>
        <input
          ref="importInputRef"
          type="file"
          accept=".html,text/html"
          style="display:none"
          @change="handleImportFile"
        />
      </section>

      <!-- 账号 -->
      <section class="settings-section">
        <span class="form-label">账号</span>
        <div class="settings-row settings-account">
          <span class="settings-username">{{ username }}</span>
          <button type="button" class="btn btn-danger btn-sm" @click="handleLogout">
            <i class="ri-logout-box-r-line" style="font-size:var(--icon-size-sm);"></i>
            <span>退出登录</span>
          </button>
        </div>
      </section>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

import Modal from './Modal.vue'
import { useSettingsStore } from '../../stores/settings'
import { useBookmarks } from '../../composables/useBookmarks'
import { useCategories } from '../../composables/useCategories'
import { useAuth } from '../../composables/useAuth'
import { useToast } from '../../composables/useToast'
import { parseNetscapeBookmarks } from '../../utils/importBookmarks'
import { chunkArray } from '../../utils/chunk'

defineEmits(['close'])

const router = useRouter()
const settings = useSettingsStore()
const { bookmarks, importBookmarks } = useBookmarks()
const { categories, createCategory } = useCategories()
const { username, logout } = useAuth()
const { success, error: showError } = useToast()

// ── 网站名称 ──
const nameInput = ref(settings.siteName)
const nameSaving = ref(false)
const nameChanged = computed(() => nameInput.value.trim() !== settings.siteName)

async function saveSiteName() {
  nameSaving.value = true
  try {
    await settings.updateSettings({ site_name: nameInput.value.trim() })
    nameInput.value = settings.siteName
    success(settings.siteName ? '网站名称已更新' : '已恢复默认名称')
  } catch (err) {
    showError('保存失败: ' + err.message)
  } finally {
    nameSaving.value = false
  }
}

// ── 头像 ──
const avatarInputRef = ref(null)
const avatarSaving = ref(false)

function triggerAvatarUpload() {
  avatarInputRef.value?.click()
}

// 图片居中裁剪压缩为 128×128 dataURL，控制入库体积
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const ctx = canvas.getContext('2d')
      const side = Math.min(img.width, img.height)
      ctx.drawImage(
        img,
        (img.width - side) / 2, (img.height - side) / 2, side, side,
        0, 0, 128, 128
      )
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片读取失败'))
    }
    img.src = url
  })
}

async function handleAvatarFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  avatarSaving.value = true
  try {
    const dataUrl = await compressImage(file)
    await settings.updateSettings({ avatar: dataUrl })
    success('头像已更新')
  } catch (err) {
    showError('头像上传失败: ' + err.message)
  } finally {
    avatarSaving.value = false
  }
}

async function removeAvatar() {
  avatarSaving.value = true
  try {
    await settings.updateSettings({ avatar: '' })
    success('头像已移除')
  } catch (err) {
    showError('移除失败: ' + err.message)
  } finally {
    avatarSaving.value = false
  }
}

// ── 导入书签 ──
const importInputRef = ref(null)

function triggerImport() {
  importInputRef.value?.click()
}

async function handleImportFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  try {
    const html = await file.text()
    const { categories: importCats, roots } = parseNetscapeBookmarks(html)

    if (!importCats.length && !roots.length) {
      showError('未从文件中解析到任何书签')
      return
    }

    // 创建缺失的分类（同名分类自动复用）
    const catIdByName = new Map(categories.value.map(c => [c.name, c.id]))
    let newCatCount = 0
    for (const cat of importCats) {
      if (catIdByName.has(cat.name)) continue
      const id = await createCategory({ name: cat.name })
      catIdByName.set(cat.name, id)
      newCatCount++
    }

    const items = [
      ...roots,
      ...importCats.flatMap(cat =>
        cat.links.map(link => ({ ...link, category_id: catIdByName.get(cat.name) }))
      )
    ]

    // 按 500/批 分块顺序提交，避免超出服务端单批上限导致整批失败
    const chunks = chunkArray(items, 500)
    let count = 0
    let skipped = 0
    let completedBatches = 0
    try {
      for (const chunk of chunks) {
        const r = await importBookmarks(chunk)
        count += r.count
        skipped += r.skipped
        completedBatches++
      }
    } catch (err) {
      showError(
        `已导入前 ${completedBatches} 批，第 ${completedBatches + 1} 批失败: ` + err.message
      )
      return
    }

    success(
      `已导入 ${count} 个书签` +
      (skipped ? `（跳过 ${skipped} 条重复）` : '') +
      (newCatCount ? `、新建 ${newCatCount} 个分类` : '')
    )
  } catch (err) {
    showError('导入失败: ' + err.message)
  }
}

// ── 导出书签 ──
function exportBookmarks() {
  const data = JSON.stringify(bookmarks.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `navbase-bookmarks-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  success('已导出书签')
}

// ── 退出登录 ──
function handleLogout() {
  logout()
  router.push('/login')
}
</script>
