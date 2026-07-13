import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, CanvasTexture, Texture } from 'three'
import { useMemo } from 'react'

import { assetUrl } from '@/lib/assetUrl'

/**
 * Paper material presets.
 * Each preset defines PBR texture paths and material parameters.
 * The textures live under /assets/materials/paper/ (user-provided PBR set).
 */

const PAPER_TEXTURE_BASE = assetUrl('/assets/materials/paper')

export interface PaperMaterialConfig {
  roughness: number
  normalScale: number
  aoIntensity: number
  /** How many times the texture repeats across the card surface */
  textureRepeat: number
}

/**
 * Lighten a texture by blending it towards white.
 * @param opacity 0 = fully white, 1 = original. Default 0.35 keeps subtle paper grain.
 */
function lightenTexture(texture: Texture, opacity = 0.35): Texture {
  const image = (texture as { image?: HTMLImageElement }).image
  if (!image) return texture

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')!

  // Draw white base
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Draw original texture on top with reduced opacity
  ctx.globalAlpha = opacity
  ctx.drawImage(image, 0, 0)

  const lightened = new CanvasTexture(canvas)
  lightened.colorSpace = SRGBColorSpace
  lightened.wrapS = texture.wrapS
  lightened.wrapT = texture.wrapT
  lightened.repeat.copy(texture.repeat)
  return lightened
}

/**
 * Hook to load PBR paper textures and return them with material config.
 * Uses drei's useTexture (Suspense-based) following the PlasterWall pattern.
 */
export function usePaperTexture(textureRepeat = 2) {
  const textures = useTexture({
    map: `${PAPER_TEXTURE_BASE}/diffuse.jpg?v=2`,
    normalMap: `${PAPER_TEXTURE_BASE}/normal.jpg?v=2`,
    roughnessMap: `${PAPER_TEXTURE_BASE}/roughness.jpg?v=2`,
    aoMap: `${PAPER_TEXTURE_BASE}/ao.jpg?v=2`,
  })

  // Configure tiling and lighten diffuse — memo to avoid re-applying every render
  const processedMap = useMemo(() => {
    Object.values(textures).forEach((texture) => {
      texture.wrapS = RepeatWrapping
      texture.wrapT = RepeatWrapping
      texture.repeat.set(textureRepeat, textureRepeat)
    })
    textures.map.colorSpace = SRGBColorSpace

    // Lighten diffuse to reduce beige tint while keeping paper grain
    return lightenTexture(textures.map, 0.35)
  }, [textures, textureRepeat])

  return { ...textures, map: processedMap }
}

// Preload paper textures at module scope to avoid Suspense flicker
useTexture.preload([
  `${PAPER_TEXTURE_BASE}/diffuse.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/normal.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/roughness.jpg?v=2`,
  `${PAPER_TEXTURE_BASE}/ao.jpg?v=2`,
])
