import React from 'react'

const CeilingGlass = ({ nodes, topMaterial }) => {
  return (
    <mesh
      name="top"
      castShadow
      receiveShadow
      geometry={nodes.top.geometry}
      material={topMaterial}
    />
  )
}

export default CeilingGlass
