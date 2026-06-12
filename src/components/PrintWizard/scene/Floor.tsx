'use client'

import { useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'

import { assetUrl } from '@/lib/assetUrl'

const BASE = assetUrl('/assets/materials/parquet')

// Preload so the texture is ready when the wizard first mounts.
useTexture.preload([
  `${BASE}/diffuse.jpg`,
  `${BASE}/normal.jpg`,
  `${BASE}/roughness.jpg`,
  `${BASE}/ao.jpg`,
])

interface FloorProps {
  /** Y position of the floor plane (artwork centered at y=0). */
  y?: number
  /** Width and depth in metres. */
  width?: number
  depth?: number
  /** How many texture tiles to repeat across the plane. */
  tilesX?: number
  tilesY?: number
}

export const Floor = ({ y = -1.5, width = 16, depth = 6, tilesX = 10, tilesY = 4 }: FloorProps) => {
  const textures = useTexture({
    map: `${BASE}/diffuse.jpg`,
    normalMap: `${BASE}/normal.jpg`,
    roughnessMap: `${BASE}/roughness.jpg`,
    aoMap: `${BASE}/ao.jpg`,
  })

  useMemo(() => {
    Object.values(textures).forEach((t) => {
      t.wrapS = RepeatWrapping
      t.wrapT = RepeatWrapping
      t.repeat.set(tilesX, tilesY)
    })
    textures.map.colorSpace = SRGBColorSpace
  }, [textures, tilesX, tilesY])

  const normalScale = useMemo(() => new Vector2(0.5, 0.5), [])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, depth / 2]} receiveShadow>
      <planeGeometry
        args={[width, depth]}
        onUpdate={(geo) => {
          // AO maps require uv2. PlaneGeometry only ships uv — duplicate it.
          if (!geo.attributes.uv2 && geo.attributes.uv) {
            geo.setAttribute('uv2', geo.attributes.uv)
          }
        }}
      />
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={normalScale}
        roughnessMap={textures.roughnessMap}
        aoMap={textures.aoMap}
        aoMapIntensity={0.9}
      />
    </mesh>
  )
}
