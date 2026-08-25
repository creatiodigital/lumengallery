import sharp from 'sharp'

import { STORED_IMAGE } from './imageConfig'

const MAX_DIMENSION = STORED_IMAGE.MAX_DIMENSION
const WEBP_QUALITY_INITIAL = STORED_IMAGE.WEBP_QUALITY
const MAX_FILE_SIZE = STORED_IMAGE.MAX_FILE_SIZE
const MIN_QUALITY = STORED_IMAGE.MIN_QUALITY

/**
 * Process an image buffer:
 * - Resize to max 4096px (longest side) for high-quality source
 * - Convert to WebP with adaptive quality to stay under 2MB
 * - Returns processed buffer suitable for Vercel Image Optimization
 */
export async function processImage(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer)
  const metadata = await image.metadata()

  let resized = image

  // Resize if larger than max dimension
  if (metadata.width && metadata.height) {
    const longestSide = Math.max(metadata.width, metadata.height)

    if (longestSide > MAX_DIMENSION) {
      if (metadata.width > metadata.height) {
        resized = image.resize({ width: MAX_DIMENSION })
      } else {
        resized = image.resize({ height: MAX_DIMENSION })
      }
    }
  }

  // WebP `effort` tunes how hard the encoder searches for a smaller file. It
  // trades encode TIME for compression ratio and does not affect visual quality
  // at a fixed `quality` — the same q=70 image, a few percent larger on disk.
  //
  // sharp defaults to 4. Measured on the 6000×6000 JPEG that 504'd production
  // on 2026-08-25, across the full adaptive loop below:
  //   effort 4 (default) → 1505 ms → 1013 KB
  //   effort 2           → 1027 ms → 1041 KB   (−32% time, +28 KB)
  //   effort 0           →  853 ms → 1126 KB   (−43% time, +113 KB)
  // Two is the knee: a third of the time back for 3% more bytes on an image
  // Vercel re-optimizes per request anyway.
  const EFFORT = 2

  // Each `toBuffer()` re-runs this pipeline from the source, so every retry
  // below costs a full encode. Decode is cheap (JPEG shrink-on-load makes it
  // ~110 ms even at 36 MP) — the encodes are what the loop multiplies, which is
  // why `effort` is the lever that matters here and caching the decode is not.
  let quality = WEBP_QUALITY_INITIAL
  let processed = await resized.webp({ quality, effort: EFFORT }).toBuffer()

  // Iteratively reduce quality if file is too large
  while (processed.length > MAX_FILE_SIZE && quality > MIN_QUALITY) {
    quality -= 5
    processed = await resized.webp({ quality, effort: EFFORT }).toBuffer()
  }

  return processed
}

/**
 * Get image metadata
 */
export async function getImageMetadata(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata()
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    size: buffer.length,
  }
}

/**
 * Validate image file type by checking magic bytes
 */
export function isValidImageType(buffer: Buffer): boolean {
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true
  }

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true
  }

  // WebP: 52 49 46 46 ... 57 45 42 50
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return true
    }
  }

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true
  }

  // TIFF (little-endian, "II*\0"): 49 49 2A 00
  if (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) {
    return true
  }

  // TIFF (big-endian, "MM\0*"): 4D 4D 00 2A
  if (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a) {
    return true
  }

  return false
}
