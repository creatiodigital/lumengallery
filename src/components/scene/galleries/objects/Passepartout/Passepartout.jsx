import React from 'react'

const Passepartout = ({ width, height, thickness, material }) => {
  return (
    <group>
      {/* Left side */}
      <mesh castShadow position={[-(width / 2 - thickness / 2), 0, 0]}>
        <boxGeometry args={[thickness, height, 0.02]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Right side */}
      <mesh castShadow position={[width / 2 - thickness / 2, 0, 0]}>
        <boxGeometry args={[thickness, height, 0.02]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Top side */}
      <mesh castShadow position={[0, height / 2 - thickness / 2, 0]}>
        <boxGeometry args={[width, thickness, 0.02]} />
        <primitive attach="material" object={material} />
      </mesh>

      {/* Bottom side */}
      <mesh castShadow position={[0, -(height / 2 - thickness / 2), 0]}>
        <boxGeometry args={[width, thickness, 0.02]} />
        <primitive attach="material" object={material} />
      </mesh>
    </group>
  )
}

export default Passepartout
