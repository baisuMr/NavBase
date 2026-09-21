// 分类预设图标（Remix Icon 名称，https://remixicon.com/）
// 顺序与语义对应旧版 emoji 预设（📁🏠💻📱🔧📚🎵…），供 IconPicker 与迁移参考
export const CATEGORY_ICONS = [
  'ri-folder-line', 'ri-home-line', 'ri-computer-line', 'ri-smartphone-line',
  'ri-tools-line', 'ri-book-2-line', 'ri-music-2-line', 'ri-palette-line',
  'ri-camera-line', 'ri-shopping-cart-line', 'ri-wallet-3-line', 'ri-bar-chart-box-line',
  'ri-link', 'ri-star-line', 'ri-rocket-line', 'ri-focus-3-line',
  'ri-pushpin-line', 'ri-search-line', 'ri-file-text-line', 'ri-alarm-line',
  'ri-global-line', 'ri-cloud-line', 'ri-lock-line', 'ri-mail-line',
  'ri-chat-3-line', 'ri-team-line', 'ri-building-2-line', 'ri-earth-line',
  'ri-gamepad-line', 'ri-heart-line', 'ri-fire-line', 'ri-lightbulb-line'
]

export const CATEGORY_ICON_DEFAULT = 'ri-folder-line'

// icon 为 ri- 开头的 Remix 名则直接使用；旧数据（emoji 等）回退默认图标
export function resolveCategoryIcon(icon) {
  return typeof icon === 'string' && icon.startsWith('ri-') ? icon : CATEGORY_ICON_DEFAULT
}
