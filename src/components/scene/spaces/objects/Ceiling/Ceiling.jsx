import React, { useMemo } from 'react'
import { SRGBColorSpace } from 'three'

const Ceiling = ({ nodes, materials }) => {
  useMemo(() => {
    if (materials.ceilingMaterial?.map) {
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
