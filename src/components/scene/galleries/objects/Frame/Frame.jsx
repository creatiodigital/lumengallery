import React from 'react'

const Frame = ({ width, height, thickness, material }) => {
  return (
    <group>
      <mesh position={[-width / 2 - thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height, thickness]} />
        <primitive attach="material" object={material} />
      </mesh>

      <mesh position={[width / 2 + thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height, thickness]} />
        <primitive attach="material" object={material} />
      </mesh>

      <mesh position={[0, height / 2 + thickness / 2, 0]}>
        <boxGeometry args={[width + thickness * 2, thickness, thickness]} />
        <primitive attach="material" object={material} />
      </mesh>

      <mesh position={[0, -height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width + thickness * 2, thickness, thickness]} />
        <primitive attach="material" object={material} />
      </mesh>
    </group>
  )
}

export default Frame
