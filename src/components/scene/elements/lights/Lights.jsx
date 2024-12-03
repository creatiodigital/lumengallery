import React from 'react'
import AmbientLight from './AmbientLight'
import { ambientLight } from '@/data/lights'
const Lights = () => {
  return (
    <>
      <AmbientLight
        color={ambientLight.color}
        intensity={ambientLight.intensity}
      />
    </>
  )
}

export default Lights
