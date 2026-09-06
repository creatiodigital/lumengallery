'use client'

/**
 * Dev-only on-screen performance readout.
 *
 * The number that decides this scene is LIVE SPOTLIGHT COUNT: three's forward
 * renderer evaluates every enabled light for every fragment, so cost scales with
 * screen pixels × lights, not with triangles. Showing it also makes room culling
 * observable — when culling silently fails it otherwise looks like nothing.
 *
 * Writes straight into a DOM node on document.body and updates it by hand.
 * Deliberately NOT React:
 *  - `createPortal` from react-dom cannot be used inside the R3F tree; its
 *    reconciler treats the returned element as a THREE object and throws
 *    "Div is not part of the THREE namespace".
 *  - A measuring tool must not perturb what it measures, and re-rendering a
 *    React subtree twice a second to display a frame rate does exactly that.
 *
 * Gated to dev + staging by NEXT_PUBLIC_APP_ENV; never renders in production.
 */

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

// Dev AND staging, never production — the same gate the admin dev-cleanup
// controls use. Staging is a production BUILD, so a NODE_ENV check would have
// hidden it exactly where the numbers are most representative of a real visitor.
// NEXT_PUBLIC_* is inlined at build time.
const SHOW_HUD = process.env.NEXT_PUBLIC_APP_ENV !== 'production'
const SAMPLE_MS = 500

export function ScenePerfHud() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const elRef = useRef<HTMLDivElement | null>(null)
  const frames = useRef(0)
  const last = useRef(performance.now())
  const peakRef = useRef({ programs: 0, geometries: 0, textures: 0 })
  // An instantaneous frame rate is useless for comparing two builds: it swings
  // 45–60 purely with where you are looking, because cost is pixels × lights.
  // Keep a rolling window so avg and worst-case are stable enough to compare.
  const historyRef = useRef<number[]>([])

  useEffect(() => {
    if (!SHOW_HUD) return
    const el = document.createElement('div')
    el.setAttribute('data-scene-perf-hud', '')
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'z-index:99999',
      'pointer-events:none',
      'background:rgba(0,0,0,0.78)',
      'color:#fff',
      'font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',
      'padding:8px 10px',
      'border-radius:4px',
      'min-width:190px',
      'white-space:pre',
      'tab-size:2',
    ].join(';')
    document.body.appendChild(el)
    elRef.current = el
    // three resets `info.render` at the START of every render(), and useFrame
    // runs before that — so reading the counters here gives whatever happened to
    // be accumulated, which is nearly nothing. Take ownership of the reset
    // instead: let the counts pile up over the sample window and divide.
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = true
      el.remove()
      elRef.current = null
    }
  }, [gl])

  useFrame(() => {
    if (!SHOW_HUD) return
    frames.current += 1
    const now = performance.now()
    const elapsed = now - last.current
    if (elapsed < SAMPLE_MS) return

    let spots = 0
    let spotsTotal = 0
    // Texture COUNT says nothing about cost — a 512² and a 4096² both count one,
    // yet differ 64×. Size each by its real upload format instead: compressed
    // (KTX2) textures carry their own byte length per mip level, everything else
    // is RGBA8 plus the ~33% the GPU adds for the mip chain.
    // Keyed on `source`, NOT on the Texture object. Frame maps are handed to
    // each artwork as a `.clone()` sharing one Source — deliberately, so a 2048²
    // wood map uploads once however many artworks use it. Counting Texture
    // objects instead reports that shared map once per artwork and invents
    // gigabytes that do not exist.
    const seen = new Set<object>()
    let clones = 0
    let textureMb = 0
    let biggest = { mb: 0, w: 0, h: 0 }
    scene.traverse((o) => {
      if ((o as unknown as { isLight?: boolean }).isLight && o.type === 'SpotLight') {
        spotsTotal += 1
        if (o.visible && o.parent?.visible !== false) spots += 1
      }
      const mat = (o as unknown as { material?: unknown }).material
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        for (const val of Object.values(m as Record<string, unknown>)) {
          const tex = val as {
            isTexture?: boolean
            image?: { width?: number; height?: number }
            mipmaps?: { data?: { byteLength: number } }[]
            isCompressedTexture?: boolean
            generateMipmaps?: boolean
          }
          if (!tex?.isTexture) continue
          const key = (tex as unknown as { source?: object }).source ?? tex.image
          if (!key) continue
          if (seen.has(key)) {
            clones += 1
            continue
          }
          seen.add(key)
          let bytes: number
          if (tex.isCompressedTexture && tex.mipmaps?.length) {
            bytes = tex.mipmaps.reduce((sum, mip) => sum + (mip?.data?.byteLength ?? 0), 0)
          } else {
            const w = tex.image?.width ?? 0
            const h = tex.image?.height ?? 0
            bytes = w * h * 4 * (tex.generateMipmaps === false ? 1 : 4 / 3)
          }
          const mb = bytes / 1048576
          textureMb += mb
          if (mb > biggest.mb) {
            biggest = { mb, w: tex.image?.width ?? 0, h: tex.image?.height ?? 0 }
          }
        }
      }
    })

    const fps = Math.round((frames.current * 1000) / elapsed)
    const history = historyRef.current
    history.push(fps)
    if (history.length > 20) history.shift() // ~10s at 500ms samples
    const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length)
    const worst = Math.min(...history)
    // Averaged over the window, because the counters now accumulate across it.
    const calls = Math.round(gl.info.render.calls / Math.max(frames.current, 1))
    const tris = Math.round(gl.info.render.triangles / Math.max(frames.current, 1))

    // Leak watch. These only ever grow if something is not disposed on unmount:
    // switching Ceiling Light Type swaps whole lamp families, and each one builds
    // its own materials. If these climb with every switch, that is the bug — not
    // the cost of the lights currently on screen.
    const programs = gl.info.programs?.length ?? 0
    const geometries = gl.info.memory.geometries
    const textures = gl.info.memory.textures
    const peak = peakRef.current
    peak.programs = Math.max(peak.programs, programs)
    peak.geometries = Math.max(peak.geometries, geometries)
    peak.textures = Math.max(peak.textures, textures)

    const el = elRef.current
    if (el) {
      const colour = fps >= 50 ? '#6ee7a8' : fps >= 30 ? '#fbbf24' : '#f87171'
      const leak = (now: number, max: number) => (now < max ? `${now} (peak ${max})` : `${now}`)
      el.innerHTML =
        `<b style="color:${colour};font-size:13px">${fps} fps</b>` +
        `<span style="opacity:.7">   avg ${avg}  ·  low ${worst}</span>\n` +
        `spotlights live   ${spots} / ${spotsTotal}\n` +
        `draw calls        ${calls}\n` +
        `triangles         ${Math.round(tris / 1000)}k\n` +
        `dpr               ${gl.getPixelRatio().toFixed(2)}\n` +
        `<span style="opacity:.55">— never shrinks if leaking —</span>\n` +
        `programs          ${leak(programs, peak.programs)}\n` +
        `geometries        ${leak(geometries, peak.geometries)}\n` +
        `textures gpu      ${leak(textures, peak.textures)}\n` +
        // Two different populations, and conflating them made the readout lie:
        // `gl.info.memory.textures` counts what is UPLOADED, this walk counts
        // everything a material REFERENCES. If the second is much larger, copies
        // are being held that the GPU has not even taken yet.
        `unique sources    ${seen.size}  (+${clones} shared clones)\n` +
        `texture MB        ${textureMb.toFixed(0)}\n` +
        `biggest tex       ${biggest.w}×${biggest.h}  ${biggest.mb.toFixed(0)} MB`
    }

    gl.info.reset()
    frames.current = 0
    last.current = now
  })

  return null
}

export default ScenePerfHud
