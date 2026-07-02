'use client'

import { useLoader } from '@react-three/fiber'
import { DataTexture, RGBAFormat, Texture, TextureLoader } from 'three'

// How many times to re-try a failed/aborted texture request before giving up.
const MAX_RETRIES = 2
// Backoff between attempts (ms), multiplied by the attempt number.
const RETRY_DELAY_MS = 250

// A single shared 1×1 opaque-white texture used when a map fails permanently.
// A missing map then degrades to the material's base color instead of an
// error — the floor still renders, just without that PBR channel.
let fallbackTexture: Texture | null = null
function getFallbackTexture(): Texture {
  if (!fallbackTexture) {
    const tex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat)
    tex.needsUpdate = true
    fallbackTexture = tex
  }
  return fallbackTexture
}

/**
 * A `TextureLoader` that survives transient or aborted requests.
 *
 * Why this exists: `@react-three/fiber`'s `useLoader` rejects when a loader
 * errors, and that rejection is thrown through Suspense **inside the R3F
 * `<Canvas>` reconciler**. The DOM-side `SceneErrorBoundary` sits outside the
 * Canvas, so it can't catch it — a single dropped texture request during a
 * heavy scene load escapes as an unhandled `window.onerror` AND crashes the
 * scene subtree (a thrown Error isn't caught by Suspense).
 *
 * This loader instead retries a few times and, on final failure, resolves
 * with a fallback texture — it never calls `onError`, so the promise never
 * rejects and nothing is thrown.
 */
export class RetryTextureLoader extends TextureLoader {
  load(
    url: string,
    onLoad?: (data: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _onError?: (err: unknown) => void,
  ): Texture {
    let attempts = 0
    const attempt = (): Texture =>
      super.load(url, onLoad, onProgress, () => {
        attempts += 1
        if (attempts <= MAX_RETRIES) {
          setTimeout(attempt, RETRY_DELAY_MS * attempts)
        } else {
          // Give up gracefully — resolve, never reject.
          onLoad?.(getFallbackTexture())
        }
      })
    return attempt()
  }
}

/**
 * Resilient drop-in for drei's `useTexture` object form: maps a record of
 * `{ key: url }` to `{ key: Texture }`, loaded through {@link RetryTextureLoader}.
 * Same Suspense + cache semantics as `useLoader`.
 */
export function useResilientTexture<T extends Record<string, string>>(
  record: T,
): { [K in keyof T]: Texture } {
  const keys = Object.keys(record) as (keyof T)[]
  const urls = keys.map((k) => record[k])
  const loaded = useLoader(RetryTextureLoader, urls)
  const textures = Array.isArray(loaded) ? loaded : [loaded]
  const out = {} as { [K in keyof T]: Texture }
  keys.forEach((k, i) => {
    out[k] = textures[i]
  })
  return out
}

/** Preload textures through the resilient loader (module-scope warm-up). */
useResilientTexture.preload = (urls: string[]) => useLoader.preload(RetryTextureLoader, urls)
