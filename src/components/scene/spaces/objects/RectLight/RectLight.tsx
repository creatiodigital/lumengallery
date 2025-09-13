import React, { useMemo } from 'react'
import { Mesh, BufferGeometry, MeshStandardMaterial } from 'three'

interface RectLightProps {
  i: number
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
}

const RectLight: React.FC<RectLightProps> = ({ i, nodes }) => {
  const rectLightMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#ffffff',
        emissiveIntensity: 1,
      }),
    [],
  )

  return (
    <mesh
      name={`rectLight${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`rectLight${i}`].geometry}
      material={rectLightMaterial}
    />
  )
}

export default RectLight
