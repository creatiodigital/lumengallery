import { test, expect } from '@playwright/test'

import { isValidVideoType } from '@/lib/videoType'

/**
 * The video upload route allowlists content-types, but a content-type is a
 * string the client chooses. These files land in a PUBLIC bucket on a domain we
 * own, so what actually matters is the bytes.
 */
test.describe('isValidVideoType', () => {
  const withPrefix = (bytes: number[]) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(16)])

  test('accepts an MP4, whose ftyp box starts at offset 4', () => {
    // 4-byte big-endian box size, then "ftyp".
    expect(isValidVideoType(withPrefix([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70]))).toBe(true)
  })

  test('accepts a WebM by its EBML header', () => {
    expect(isValidVideoType(withPrefix([0x1a, 0x45, 0xdf, 0xa3]))).toBe(true)
  })

  test('rejects HTML dressed as a video — the stored-XSS case', () => {
    expect(isValidVideoType(Buffer.from('<html><script>alert(1)</script></html>'))).toBe(false)
  })

  test('rejects an SVG, which browsers will happily execute', () => {
    expect(isValidVideoType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
      false,
    )
  })

  test('rejects a JPEG — a real media file, but not one this route accepts', () => {
    expect(isValidVideoType(withPrefix([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
  })

  test('rejects a truncated file too short to carry a signature', () => {
    expect(isValidVideoType(Buffer.from([0x1a, 0x45]))).toBe(false)
  })

  test('rejects an empty buffer', () => {
    expect(isValidVideoType(Buffer.alloc(0))).toBe(false)
  })
})
