/**
 * Validate a video by its actual bytes, not by what the client claimed.
 *
 * The upload route allowlists `video/mp4` and `video/webm`, but a content-type
 * is just a string the browser sends — and the file lands in a PUBLIC R2 bucket
 * served from a domain we own. An HTML document uploaded as `video/mp4` would
 * sit there, fetchable, and be rendered as markup by anything that sniffs it.
 * The image route has always checked magic bytes for exactly this reason; the
 * video route did not, and this closes that gap.
 *
 * Only two containers are accepted, matching the allowlist:
 *
 *   MP4/ISO-BMFF  bytes 4..7 spell `ftyp`. The first four are a big-endian box
 *                 size, so the signature deliberately starts at offset 4.
 *   WebM/Matroska an EBML header: 1A 45 DF A3.
 */
export function isValidVideoType(buffer: Buffer): boolean {
  if (buffer.length < 12) return false

  // MP4 / M4V / MOV — any ISO base media file. "ftyp" at offset 4.
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return true
  }

  // WebM / Matroska — EBML magic.
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return true
  }

  return false
}
