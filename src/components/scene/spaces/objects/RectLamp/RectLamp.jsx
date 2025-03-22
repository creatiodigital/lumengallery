import React from 'react'

const RectLamp = ({ i, nodes, rectLampMaterial }) => {
  return (
    <mesh
      name={`rectlamp${i}`}
      geometry={nodes[`rectlamp${i}`].geometry}
      material={rectLampMaterial}
    />
  )
}

export default RectLamp
