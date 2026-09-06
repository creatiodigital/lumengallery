'use client'

/**
 * Development-only GPU texture accounting for the 3D scene.
 *
 * `renderer.info.memory.textures` counts OBJECTS, not bytes, so it cannot tell a
 * 4096² RGBA8 texture (85 MB) from the same image as BC7 (21 MB) — and bytes are
 * the figure that decides whether a visitor's machine can open an exhibition at
 * all. So walk the scene, collect unique textures, and size each from its actual
 * upload format.
 *
 * Renders nothing and is compiled out of production builds (`NODE_ENV` check
 * below, which bundlers fold to a constant). Mounted inside each space so any
 * exhibition can be measured by opening the console.
 *
 * Also exposes the raw rows on `window.__textureRows` so an automated run
 * (Playwright, a perf check) can read the same numbers the console prints.
 */

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { Material, Texture, CompressedTexture } from 'three'

type Row = {
  name: string
  src: string
  w: number
  h: number
  mb: number
  compressed: boolean
}

const IS_DEV = process.env.NODE_ENV === 'development'

const textureBytes = (t: Texture): { bytes: number; compressed: boolean } => {
  const ct = t as CompressedTexture
  const isCompressed = (ct as unknown as { isCompressedTexture?: boolean }).isCompressedTexture
  if (isCompressed && Array.isArray(ct.mipmaps) && ct.mipmaps.length > 0) {
    // Every mip level carries its own byte length, already in the GPU's block
    // format — this is exactly what gets uploaded.
    const bytes = ct.mipmaps.reduce(
      (sum, m) => sum + ((m as unknown as { data?: { byteLength: number } }).data?.byteLength ?? 0),
      0,
    )
    return { bytes, compressed: true }
  }
  const img = t.image as { width?: number; height?: number } | undefined
  const w = img?.width ?? 0
  const h = img?.height ?? 0
  // RGBA8, plus the mip chain the GPU generates (≈ +33%).
  return { bytes: w * h * 4 * (t.generateMipmaps ? 4 / 3 : 1), compressed: false }
}

export function TextureMemoryReadout() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    if (!IS_DEV) return

    const run = () => {
      const seen = new Map<Texture, Row>()

      scene.traverse((obj) => {
        const mat = (obj as unknown as { material?: Material | Material[] }).material
        if (!mat) return
        const mats = Array.isArray(mat) ? mat : [mat]
        for (const m of mats) {
          for (const [slot, val] of Object.entries(m as unknown as Record<string, unknown>)) {
            const tex = val as Texture | null
            if (!tex || !(tex as unknown as { isTexture?: boolean }).isTexture) continue
            if (seen.has(tex)) continue
            const { bytes, compressed } = textureBytes(tex)
            if (bytes === 0) continue
            const img = tex.image as
              | { width?: number; height?: number; src?: string; currentSrc?: string }
              | undefined
            seen.set(tex, {
              name: tex.name || slot,
              src: (img?.currentSrc || img?.src || '(generated)')
                .split('/')
                .slice(-2)
                .join('/')
                .split('?')[0],
              w: img?.width ?? 0,
              h: img?.height ?? 0,
              mb: bytes / 1048576,
              compressed,
            })
          }
        }
      })

      // Dev-only handle so a profiling run can reach the scene without digging
      // into R3F internals (which are not a stable API).
      ;(window as unknown as { __scene?: unknown }).__scene = { scene, gl, camera }

      const rows = [...seen.values()].sort((a, b) => b.mb - a.mb)
      ;(window as unknown as { __textureRows?: Row[] }).__textureRows = rows

      const total = rows.reduce((s, r) => s + r.mb, 0)
      const compressedMb = rows.filter((r) => r.compressed).reduce((s, r) => s + r.mb, 0)

      // Duplicate sources are the expensive mistake this readout exists to catch:
      // the same file uploaded once per artwork costs N× the GPU memory.
      const bySrc = new Map<string, { n: number; mb: number }>()
      for (const r of rows) {
        const e = bySrc.get(r.src) ?? { n: 0, mb: 0 }
        e.n += 1
        e.mb += r.mb
        bySrc.set(r.src, e)
      }
      const dupes = [...bySrc.entries()]
        .filter(([, v]) => v.n > 1)
        .sort((a, b) => b[1].mb - a[1].mb)

      console.log(
        `%c[texture memory] ${total.toFixed(1)} MB (compressed ${compressedMb.toFixed(1)} MB / plain ${(total - compressedMb).toFixed(1)} MB) across ${rows.length} textures · ${gl.info.render.calls} draw calls`,
        'color:#0a0;font-weight:bold',
      )
      if (dupes.length) {
        const wasted = dupes.reduce((s, [, v]) => s + v.mb - v.mb / v.n, 0)
        console.warn(
          `[texture memory] ${dupes.length} duplicated source(s) wasting ${wasted.toFixed(0)} MB`,
        )
        console.table(dupes.map(([src, v]) => ({ src, copies: v.n, MB: v.mb.toFixed(1) })))
      }
    }

    // Let the scene settle before the first measurement.
    const first = setTimeout(run, 3000)
    const id = setInterval(run, 10000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [scene, gl, camera])

  return null
}
