import { useTexture } from '@react-three/drei'
import { Mesh, BufferGeometry, RepeatWrapping, SRGBColorSpace, DoubleSide } from 'three'

import { assetUrl } from '@/lib/assetUrl'

interface PlasterWallProps {
  i: number
  wallRef: React.Ref<Mesh>
  geometry: BufferGeometry
  texturePath?: string
  textureRepeat?: number
}

/**
 * Wall with plaster texture — uses MeshLambertMaterial for cheaper lighting.
 * Lambert still reacts to spotlights (visible light cones) but uses per-vertex
 * diffuse lighting instead of per-pixel PBR, saving significant GPU cost.
 */
const PlasterWall: React.FC<PlasterWallProps> = ({
  i,
  wallRef,
  geometry,
  texturePath = assetUrl('/assets/materials/plaster'),
  textureRepeat = 2,
}) => {
  // Load textures (diffuse + AO for visual depth)
  const textures = useTexture({
    map: `${texturePath}/diffuse.jpg`,
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
    <mesh ref={wallRef} name={`wall${i}`} geometry={geometry}>
      <meshLambertMaterial
        map={textures.map}
        aoMap={textures.aoMap}
        aoMapIntensity={0.8}
        side={DoubleSide}
      />
    </mesh>
  )
}

export { PlasterWall }
export default PlasterWall
