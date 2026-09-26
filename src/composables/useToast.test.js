import { describe, it, expect } from 'vitest'
import { useToast } from './useToast'

describe('useToast seq 计时序号', () => {
  it('同文案连续触发时 seq 递增（供组件重置计时器）', () => {
    const { toast, showToast } = useToast()
    showToast('链接已复制')
    // 初始 seq 应为数字，修复前 state 中无 seq 字段
    expect(typeof toast.value.seq).toBe('number')
    const first = toast.value.seq
    showToast('链接已复制')
    expect(toast.value.seq).toBe(first + 1)
  })
})
