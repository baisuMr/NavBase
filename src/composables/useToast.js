import { ref } from 'vue'

const toast = ref({
  visible: false,
  message: '',
  type: 'success'
})

export function useToast() {
  function showToast(message, type = 'success') {
    toast.value = {
      visible: true,
      message,
      type
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
