// 数组移位纯函数：拖动排序 onEnd 后按 oldIndex/newIndex 重排分类列表
import { describe, it, expect } from 'vitest'
import { moveInArray } from './reorder'

describe('moveInArray', () => {
  it('向后移动：元素插入到目标下标处', () => {
    expect(moveInArray(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('向前移动：元素插入到目标下标处', () => {
    expect(moveInArray(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('原地下标返回等价新数组（不改原数组）', () => {
    const src = ['a', 'b', 'c']
    const out = moveInArray(src, 1, 1)
    expect(out).toEqual(['a', 'b', 'c'])
    expect(out).not.toBe(src)
    expect(src).toEqual(['a', 'b', 'c'])
  })

  it('越界下标返回副本不变', () => {
    expect(moveInArray(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(moveInArray(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveInArray(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
})
