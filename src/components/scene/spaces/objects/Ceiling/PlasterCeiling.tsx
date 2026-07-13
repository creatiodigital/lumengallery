import { useTexture } from '@react-three/drei'
import { BufferGeometry, RepeatWrapping, SRGBColorSpace, Vector2, DoubleSide } from 'three'

import { assetUrl } from '@/lib/assetUrl'

interface PlasterCeilingProps {
  geometry: BufferGeometry
  texturePath?: string
  textureRepeat?: number
  color?: string
}

/**
 * Ceiling with PBR plaster material.
 */
const PlasterCeiling: React.FC<PlasterCeilingProps> = ({
  geometry,
  texturePath = assetUrl('/assets/materials/plaster'),
  textureRepeat = 2,
  color = '#ffffff',
}) => {
  // Load PBR textures
  // ?v=2: 2026-07-12 recompression (visually lossless; originals in R2 under
  // app/assets/_originals-20260712/). normal.png is deliberately untouched:
  // it has always 404'd (only normal.jpg exists in the bucket) so the ceiling
  // never had a normal map — wiring it now would change the look.
  const textures = useTexture({
    map: `${texturePath}/diffuse.jpg?v=2`,
    normalMap: `${texturePath}/normal.png`,
    roughnessMap: `${texturePath}/roughness.jpg?v=2`,
    metalnessMap: `${texturePath}/metallic.jpg?v=2`,
    aoMap: `${texturePath}/ao.jpg?v=2`,
  })

  // Configure texture tiling
  Object.values(textures).forEach((texture) => {
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.repeat.set(textureRepeat, textureRepeat)
  })
  textures.map.colorSpace = SRGBColorSpace

  return (
    <mesh name="ceiling" geometry={geometry} receiveShadow>
      <meshStandardMaterial
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={new Vector2(0.1, 0.1)}
        roughnessMap={textures.roughnessMap}
        roughness={1.0}
        metalnessMap={textures.metalnessMap}
        metalness={0}
        aoMap={textures.aoMap}
        aoMapIntensity={0.5}
        envMapIntensity={0}
        color={color}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { PlasterCeiling }
export default PlasterCeiling
