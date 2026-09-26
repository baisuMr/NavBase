// worker/utils/imageType.test.js
import { describe, it, expect } from 'vitest'
import { detectImageType } from './imageType.js'

const buf = (arr) => new Uint8Array(arr).buffer
const text = (s) => new TextEncoder().encode(s).buffer

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const ICO_HEAD = [0x00, 0x00, 0x01, 0x00, 0x01, 0x00]
const GIF_HEAD = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]
const BMP_HEAD = [0x42, 0x4d, 0x00, 0x00]
const RIFF_HEAD = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]

describe('detectImageType 二进制魔数', () => {
  it.each([
    ['PNG', PNG_HEAD, 'image/png'],
    ['ICO', ICO_HEAD, 'image/x-icon'],
    ['GIF', GIF_HEAD, 'image/gif'],
    ['JPEG', JPEG_HEAD, 'image/jpeg'],
    ['BMP', BMP_HEAD, 'image/bmp'],
    ['RIFF/WebP', RIFF_HEAD, 'image/webp']
  ])('%s 命中 %s', (_n, head, mime) => {
    expect(detectImageType(buf(head))).toBe(mime)
  })
})

describe('detectImageType SVG 文本嗅探', () => {
  it('带 XML 声明的良性 SVG → image/svg+xml', () => {
    const b = text('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>')
    expect(detectImageType(b)).toBe('image/svg+xml')
  })

  it('裸 <svg> 开头 → image/svg+xml', () => {
    expect(detectImageType(text('<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="8"/></svg>'))).toBe('image/svg+xml')
  })

  it('前导空白/换行容忍', () => {
    expect(detectImageType(text('\n  <svg></svg>'))).toBe('image/svg+xml')
  })

  it('HTML 冒充拒绝（<html> / <!doctype html> 开头）', () => {
    expect(detectImageType(text('<!DOCTYPE html><html><svg></svg></html>'))).toBeNull()
    expect(detectImageType(text('<html><body><svg></svg></body></html>'))).toBeNull()
  })

  it('UTF-16 BOM 拒绝（UTF-8 解码会变乱码导致扫描失效）', () => {
    expect(detectImageType(buf([0xff, 0xfe, 0x3c, 0x00]))).toBeNull()
    expect(detectImageType(buf([0xfe, 0xff, 0x00, 0x3c]))).toBeNull()
  })

  it('其它文本与随机字节拒绝', () => {
    expect(detectImageType(text('hello world'))).toBeNull()
    expect(detectImageType(buf([0x01, 0x02, 0x03, 0x04]))).toBeNull()
    expect(detectImageType(buf([]))).toBeNull()
  })
})
