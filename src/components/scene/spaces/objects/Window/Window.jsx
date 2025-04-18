import React from 'react'

const Window = ({ i, windowRef, glassRef, nodes, windowMaterial, glassMaterial }) => {
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
