import React from 'react'

const Window = ({ i, nodes, windowMaterial }) => {
  return (
    <mesh
      name={`window${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`window${i}`].geometry}
      material={windowMaterial}
    />
  )
}

export default Window
