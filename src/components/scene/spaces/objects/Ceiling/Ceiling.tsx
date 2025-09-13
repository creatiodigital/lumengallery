import React, { useMemo } from 'react'
import { SRGBColorSpace, MeshStandardMaterial, Mesh, BufferGeometry, Texture } from 'three'

interface CeilingProps {
  nodes: {
    ceiling: Mesh & {
      geometry: BufferGeometry
    }
  }
  materials: {
    ceilingMaterial: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Ceiling: React.FC<CeilingProps> = ({ nodes, materials }) => {
  useMemo(() => {
    if (materials.ceilingMaterial.map) {
      materials.ceilingMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  return (
    <mesh
      name="ceiling"
      castShadow
      receiveShadow
      geometry={nodes.ceiling.geometry}
      material={materials.ceilingMaterial}
    />
  )
}

export default Ceiling
