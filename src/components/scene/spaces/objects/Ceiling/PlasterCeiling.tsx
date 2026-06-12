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
  const textures = useTexture({
    map: `${texturePath}/diffuse.jpg`,
    normalMap: `${texturePath}/normal.png`,
    roughnessMap: `${texturePath}/roughness.jpg`,
    metalnessMap: `${texturePath}/metallic.jpg`,
    aoMap: `${texturePath}/ao.jpg`,
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
