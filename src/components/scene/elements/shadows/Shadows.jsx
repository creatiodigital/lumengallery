import React from 'react'
import { AccumulativeShadows, RandomizedLight } from '@react-three/drei'

const Shadows = () => {
  return (
    <AccumulativeShadows color="black" colorBlend={0.5} opacity={0.09} scale={15} alphaTest={0.85}>
      <RandomizedLight amount={6} radius={1} ambient={0.1} position={[2, 8, 2]} bias={0.5} />
    </AccumulativeShadows>
  )
}

export default Shadows
