import React from 'react'

const Reel = ({ i, nodes, reelMaterial }) => {
  return (
    <mesh
      name={`reel${i}`}
      castShadow
      receiveShadow
      geometry={nodes[`reel${i}`].geometry}
      material={reelMaterial}
    />
  )
}

export default Reel
