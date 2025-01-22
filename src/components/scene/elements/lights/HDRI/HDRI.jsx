import { Environment } from '@react-three/drei'
import React from 'react'

const HDRI = () => {
  return (
    <Environment
      background={false}
      files="/assets/hdri/city.hdr"
      environmentIntensity={0.4}
      backgroundRotation={[0, Math.PI / 1.5, 0]}
    />
  )
}

export default HDRI
