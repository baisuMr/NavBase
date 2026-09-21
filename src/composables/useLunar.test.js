// 日期问候 / 农历 / 周数计算单测
import { describe, it, expect } from 'vitest'
import { useDateInfo } from './useLunar'

const { getLunarText, getWeekOfYear, getGregorianText, getWeekdayText, getGreeting } = useDateInfo()

describe('getGreeting 时段问候', () => {
  const cases = [
    [3, '夜深了，注意休息与充电'],
    [7, '早上好，迎接清晰而高效的一天'],
    [12, '中午好，适度小憩片刻'],
    [15, '下午好，保持专注与敏锐'],
    [21, '晚上好，整理今日的收获与沉淀']
  ]
  for (const [h, expected] of cases) {
    it(`${h}点 → ${expected.slice(0, 4)}`, () => {
      expect(getGreeting(new Date(2026, 0, 1, h, 0))).toBe(expected)
    })
  }
})

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
})
