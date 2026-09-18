import { ref } from 'vue'

export function useContextMenu() {
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    items: [],
    target: null
  })

  function showContextMenu(event, items, target = null) {
    // 阻止默认右键菜单
    event.preventDefault()

    // 计算菜单位置，确保不超出视窗
    const x = Math.min(event.clientX, window.innerWidth - 200)
    const y = Math.min(event.clientY, window.innerHeight - 200)

    contextMenu.value = {
      visible: true,
      x,
      y,
      items,
      target
    }
  }

  function hideContextMenu() {
    contextMenu.value.visible = false
  }

  function handleMenuSelect(action) {
    const { target } = contextMenu.value
    hideContextMenu()
    return { action, target }
  }

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
    handleMenuSelect
  }
}
