// 日期问候 / 农历 / 周数计算单测
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useDateInfo } from './useLunar'

afterEach(() => {
  vi.doUnmock('lunar-javascript')
  vi.resetModules()
})

const { getLunarText, getWeekOfYear, getGregorianText, getWeekdayText } = useDateInfo()

describe('getGregorianText 公历文案', () => {
  it('格式为 YYYY年M月D日', () => {
    expect(getGregorianText(new Date(2026, 8, 18))).toBe('2026年9月18日')
    expect(getGregorianText(new Date(2025, 0, 29))).toBe('2025年1月29日')
  })
})

describe('getWeekdayText 星期文案', () => {
  it('格式为 星期X', () => {
    expect(getWeekdayText(new Date(2026, 8, 18))).toBe('星期五')
    expect(getWeekdayText(new Date(2025, 0, 29))).toBe('星期三')
  })
})

describe('getWeekOfYear ISO 周数', () => {
  it('2026-01-01（周四）为第 1 周', () => {
    expect(getWeekOfYear(new Date(2026, 0, 1))).toBe(1)
  })
  it('2026-01-05（周一）进入第 2 周', () => {
    expect(getWeekOfYear(new Date(2026, 0, 5))).toBe(2)
  })
  it('以周一为一周起点（周日属于前一周）', () => {
    expect(getWeekOfYear(new Date(2026, 0, 4))).toBe(1)
  })
})

describe('getLunarText 农历（动态加载 lunar-javascript）', () => {
  it('2025-01-29 春节 → 乙巳年 农历正月初一', async () => {
    expect(await getLunarText(new Date(2025, 0, 29))).toBe('乙巳年 农历正月初一')
  })

  it('闰月年份输出正常（2023 存在闰二月）', async () => {
    const text = await getLunarText(new Date(2023, 7, 16)) // 2023-08-16 农历七月初一
    expect(text).toBe('癸卯年 农历七月初一')
  })

  it('异常输入返回空字符串而非抛错', async () => {
    expect(await getLunarText('not-a-date')).toBe('')
  })

  it('动态加载失败后下次调用重试（不永久缓存 rejected promise）', async () => {
    // 动态 import 失败 mock：工厂抛错使 import('lunar-javascript') reject
    vi.doMock('lunar-javascript', () => { throw new Error('chunk load fail') })
    vi.resetModules()
    const mod = await import('./useLunar')
    const { getLunarText } = mod.useDateInfo()
    // 首次加载失败 → 返回空字符串
    await expect(getLunarText(new Date(2025, 0, 29))).resolves.toBe('')
    // 恢复真实模块后，同一模块实例下次调用应重试成功（修复前 rejected promise 被永久缓存，仍返回 ''）
    vi.doUnmock('lunar-javascript')
    expect(await getLunarText(new Date(2025, 0, 29))).toBe('乙巳年 农历正月初一')
  })
})
