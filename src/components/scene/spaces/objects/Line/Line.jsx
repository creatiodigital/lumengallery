import React from 'react'

const Line = ({ i, nodes, lineMaterial }) => {
  return (
    <>
      <mesh
        name={`line${i}`}
        castShadow
        receiveShadow
        geometry={nodes[`line${i}`].geometry}
        material={lineMaterial}
      />
    </>
  )
}

export default Line
