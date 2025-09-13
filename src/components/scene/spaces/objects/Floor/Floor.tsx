import React, { useMemo } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Texture } from 'three'

interface FloorProps {
  nodes: {
    floor: Mesh & {
      geometry: BufferGeometry
    }
  }
  materials: {
    floorMaterial: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Floor: React.FC<FloorProps> = ({ nodes, materials }) => {
  useMemo(() => {
    if (materials.floorMaterial.map) {
      materials.floorMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  return (
    <mesh
      name="floor"
      castShadow
      receiveShadow
      geometry={nodes.floor.geometry}
      material={materials.floorMaterial}
    />
  )
}

export default Floor
