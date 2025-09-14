import React from 'react'
import { Mesh, BufferGeometry, Material } from 'three'

interface WindowProps {
  i: number
  windowRef: React.Ref<Mesh>
  glassRef: React.Ref<Mesh>
  nodes: Record<string, Mesh & { geometry: BufferGeometry }>
  windowMaterial: Material
  glassMaterial: Material
}

const Window: React.FC<WindowProps> = ({
  i,
  windowRef,
  glassRef,
  nodes,
  windowMaterial,
  glassMaterial,
}) => {
  return (
    <>
      <mesh
        name={`window${i}`}
        ref={windowRef}
        castShadow
        receiveShadow
        geometry={nodes[`window${i}`]?.geometry}
        material={windowMaterial}
      />
      <mesh
        ref={glassRef}
        name={`glass${i}`}
        geometry={nodes[`glass${i}`]?.geometry}
        material={glassMaterial}
      />
    </>
  )
}

export default Window
