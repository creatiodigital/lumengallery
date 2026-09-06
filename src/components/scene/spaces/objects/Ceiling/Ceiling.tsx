import { useEffect, useMemo } from 'react'
import { SRGBColorSpace, MeshLambertMaterial, BufferGeometry, Color } from 'three'

import { useAmbientLight } from '@/hooks/useAmbientLight'
import { useDisposable } from '@/components/scene/spaces/objects/useDisposable'

interface CeilingProps {
  geometry: BufferGeometry
  material?: MeshLambertMaterial
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
}

// Default ceiling material fallback
const DEFAULT_CEILING_COLOR = '#f5f5f5'

const Ceiling: React.FC<CeilingProps> = ({ geometry, material, position, rotation, scale }) => {
  const { ambientColor, scale: ambientScale } = useAmbientLight()

  // Ensure ceiling material is double-sided
  const ceilingMaterial = useMemo(() => {
    if (material) {
      material.side = 2 // DoubleSide
      if (material.map) {
        material.map.colorSpace = SRGBColorSpace
      }
      return material
    }
    // Fallback: create a default ceiling material (Lambert for cheaper lighting)
    return new MeshLambertMaterial({
      color: new Color(DEFAULT_CEILING_COLOR),
      side: 2, // DoubleSide
    })
  }, [material])
  useDisposable(ceilingMaterial)

  // Apply ambient light as color multiplier
  useEffect(() => {
    if (ceilingMaterial) {
      const color = new Color(ambientColor)
      color.multiplyScalar(ambientScale)
      ceilingMaterial.color = color
    }
  }, [ceilingMaterial, ambientColor, ambientScale])

  return (
    <mesh
      name="ceiling"
      geometry={geometry}
      material={ceilingMaterial}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  )
}

export default Ceiling
