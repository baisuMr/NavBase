import { ref } from 'vue'

const toast = ref({
  visible: false,
  message: '',
  type: 'success',
  seq: 0 // 触发序号：同文案连续触发时 message 不变，靠 seq 变化驱动组件重置计时器
})

export function useToast() {
  function showToast(message, type = 'success') {
    toast.value = {
      visible: true,
      message,
      type,
      seq: toast.value.seq + 1
    }
  }

  function hideToast() {
    toast.value.visible = false
  }

  function success(message) {
    showToast(message, 'success')
  }

  function error(message) {
    showToast(message, 'error')
  }

  function warning(message) {
    showToast(message, 'warning')
  }

  function info(message) {
    showToast(message, 'info')
  }

  return {
    toast,
    showToast,
    hideToast,
    success,
    error,
    warning,
    info
  }
}
