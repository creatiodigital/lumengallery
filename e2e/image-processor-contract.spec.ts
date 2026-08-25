import { test, expect } from '@playwright/test'
import sharp from 'sharp'

import { processImage } from '@/lib/imageProcessor'
import { STORED_IMAGE } from '@/lib/imageConfig'

/**
 * The contract `processImage` owes the rest of the app, pinned so the encoder
 * can be tuned for speed without anyone having to trust that it still behaves.
 *
 * Written during the 2026-08-25 production incident: a 6000×6000 JPEG 504'd on
 * Vercel while taking ~1.9 s locally. The cost of this function scales with
 * MEGAPIXELS, not file bytes — JPEG decode uses shrink-on-load, so a 160 MB
 * TIFF of modest dimensions is cheaper than a 8.5 MB 36 MP JPEG. That is why
 * the failure looked size-independent and went unnoticed until an unusually
 * large-by-pixels image arrived.
 *
 * The speed fix lowers WebP `effort`, which trades compression ratio for encode
 * time and does NOT change visual quality at a fixed `quality`. These tests
 * assert the two properties consumers actually depend on — bounded dimensions
 * and bounded file size — so that tuning is safe to do.
 */

/** 36 MP, the size that broke production. Detailed enough to exercise the
 *  adaptive-quality loop rather than compressing under target on pass one. */
async function detailedSource(n = 6000) {
  const raw = Buffer.allocUnsafe(n * n * 3)
  for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0
  return sharp(raw, { raw: { width: n, height: n, channels: 3 } })
    .jpeg({ quality: 92 })
    .toBuffer()
}

test('a 36-megapixel source comes back bounded in both dimensions and bytes', async () => {
  test.setTimeout(120_000)

  const out = await processImage(await detailedSource())
  const md = await sharp(out).metadata()

  expect(md.format, 'stored images are WebP for the Vercel optimizer').toBe('webp')

  expect(
    Math.max(md.width ?? 0, md.height ?? 0),
    'longest side must be capped at MAX_DIMENSION',
  ).toBeLessThanOrEqual(STORED_IMAGE.MAX_DIMENSION)

  // The adaptive loop stops at MIN_QUALITY whether or not it reached the target,
  // so this is a ceiling on what the loop can produce, not a strict guarantee of
  // MAX_FILE_SIZE. Pinned generously: the point is that output stays in the
  // megabyte range and never balloons when the encoder is retuned.
  expect(out.length, 'stored WebP must stay small enough to serve').toBeLessThan(
    STORED_IMAGE.MAX_FILE_SIZE * 2,
  )
})

test('an image already under the cap is not upscaled', async () => {
  const small = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 10, g: 90, b: 120 } },
  })
    .jpeg()
    .toBuffer()

  const md = await sharp(await processImage(small)).metadata()

  // Resizing only ever shrinks — a small source must pass through at its own
  // size rather than being blown up to MAX_DIMENSION.
  expect(md.width).toBe(800)
  expect(md.height).toBe(600)
})
