/**
 * 农历与周数计算
 * 用法：
 *   const { lunarText, weekOfYear } = useDateInfo()
 *
 * lunar-javascript 体积较大（约占 Home 主包 2/3），故通过动态 import
 * 拆为独立 chunk 按需加载：农历文字稍后异步填充，不影响首屏渲染
 */
let lunarModulePromise = null
function loadLunar() {
  if (!lunarModulePromise) {
    lunarModulePromise = import('lunar-javascript').catch(err => {
      // 加载失败清空缓存：发版瞬间旧页面的动态 import 可能失败，
      // 永久缓存 rejected promise 会导致此后农历一直空白，允许下次调用重试
      lunarModulePromise = null
      throw err
    })
  }
  return lunarModulePromise
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function useDateInfo() {
  /**
   * 当前公历日期对应的农历干支文字
   * 形如："乙巳年 农历四月廿一"
   */
  async function getLunarText(date = new Date()) {
    try {
      const { Solar } = await loadLunar()
      const solar = Solar.fromDate(date)
      const lunar = solar.getLunar()
      const yearGanZhi = lunar.getYearInGanZhi() // 乙巳
      const monthInChinese = lunar.getMonthInChinese() // 四
      const dayInChinese = lunar.getDayInChinese() // 廿一
      return `${yearGanZhi}年 农历${monthInChinese}月${dayInChinese}`
    } catch {
      return ''
    }
  }

  /**
   * 一年中第几周（ISO 周编号）
   * 周一为一周的第一天
   */
  function getWeekOfYear(date = new Date()) {
    const target = new Date(date.valueOf())
    const dayNr = (date.getDay() + 6) % 7 // 周一=0, 周日=6
    target.setDate(target.getDate() - dayNr + 3)
    const firstThursday = target.valueOf()
    target.setMonth(0, 1)
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7)
    }
    return 1 + Math.ceil((firstThursday - target) / 604800000)
  }

  /**
   * 中文格式的公历日期："2025年5月18日"
   */
  function getGregorianText(date = new Date()) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  /**
   * 中文格式的星期："星期日"
   */
  function getWeekdayText(date = new Date()) {
    return WEEKDAYS[date.getDay()]
  }

  /**
   * 根据小时返回问候文案
   */
  function getGreeting(date = new Date()) {
    const h = date.getHours()
    if (h < 6) return '夜深了，注意休息与充电'
    if (h < 11) return '早上好，迎接清晰而高效的一天'
    if (h < 13) return '中午好，适度小憩片刻'
    if (h < 18) return '下午好，保持专注与敏锐'
    return '晚上好，整理今日的收获与沉淀'
  }

  return {
    getLunarText,
    getWeekOfYear,
    getGregorianText,
    getWeekdayText,
    getGreeting
  }
}
