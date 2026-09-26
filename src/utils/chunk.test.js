import { describe, it, expect } from 'vitest'
import { chunkArray } from './chunk'

describe('chunkArray', () => {
  it('按尺寸切块且不丢元素', () => {
    const arr = Array.from({ length: 8 }, (_, i) => i)
    const chunks = chunkArray(arr, 3)
    expect(chunks.map(c => c.length)).toEqual([3, 3, 2])
    expect(chunks.flat()).toEqual(arr)
  })
  it('空数组返回空', () => {
    expect(chunkArray([], 3)).toEqual([])
  })
})
