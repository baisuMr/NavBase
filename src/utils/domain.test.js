import { describe, it, expect } from 'vitest'
import { isAllowedDomain } from './domain'
// 跨端口径一致性：worker 侧实现必须与前端判定完全一致（同 faviconKey 双端向量惯例）
import { isAllowedDomain as workerIsAllowedDomain } from '../../worker/utils/domain.js'

const VALID = ['example.com', 'sub.example.co.uk', 'a-b.c-d.io', 'navbase.pages.dev']
const INVALID = [
  '',
  'localhost',
  '192.168.1.1',
  'evil.com/path',
  'ev il.com',
  '..',
  '单段主机名',
  '例子.com',
  'a'.repeat(250) + '.com' // 254 字符，超 253 上限
]

describe('isAllowedDomain', () => {
  it('公共域名格式合法', () => {
    for (const domain of VALID) {
      expect(isAllowedDomain(domain), domain).toBe(true)
    }
  })

  it('localhost / 内网 IP / 非法格式 / 超长域名一律拒绝', () => {
    for (const domain of INVALID) {
      expect(isAllowedDomain(domain), domain).toBe(false)
    }
  })

  it('长度恰为 253 的域名放行（上限含本数）', () => {
    expect(isAllowedDomain('a'.repeat(249) + '.com')).toBe(true)
  })

  it('与 worker/utils/domain.js 判定口径完全一致', () => {
    for (const domain of [...VALID, ...INVALID, 'a'.repeat(249) + '.com']) {
      expect(workerIsAllowedDomain(domain), domain).toBe(isAllowedDomain(domain))
    }
  })
})
