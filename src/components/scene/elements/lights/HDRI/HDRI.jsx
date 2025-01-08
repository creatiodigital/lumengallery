import { Environment } from '@react-three/drei'
import React from 'react'

const HDRI = () => {
  return (
    <Environment
      background={false}
      preset="night"
      environmentIntensity={15}
      environmentRotation={[Math.PI / 1.1, Math.PI / 2, 0]}
    />
  )
}

export default HDRI
