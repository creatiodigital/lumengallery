import { AccumulativeShadows, RandomizedLight } from '@react-three/drei'
import React from 'react'

const Shadows = () => {
  return (
    <AccumulativeShadows color="black" colorBlend={0.5} opacity={0.09} scale={15} alphaTest={0.85}>
      <RandomizedLight amount={6} radius={1} ambient={0.1} position={[0, 8, 0]} bias={0.5} />
    </AccumulativeShadows>
  )
}

export default Shadows
