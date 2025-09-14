import React, { useMemo } from 'react'
import { SRGBColorSpace, Mesh, BufferGeometry, MeshStandardMaterial, Texture } from 'three'

interface WallProps {
  i: number
  wallRef: React.Ref<Mesh>
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  materials: {
    wallMaterial?: MeshStandardMaterial & {
      map?: Texture
    }
  }
}

const Wall: React.FC<WallProps> = ({ i, wallRef, nodes, materials }) => {
  useMemo(() => {
    if (materials.wallMaterial?.map) {
      materials.wallMaterial.map.colorSpace = SRGBColorSpace
    }
  }, [materials])

  return (
    <mesh
      name={`wall${i}`}
      ref={wallRef}
      castShadow
      receiveShadow
      geometry={nodes[`wall${i}`]?.geometry}
      material={materials.wallMaterial}
    />
  )
}

export default Wall
