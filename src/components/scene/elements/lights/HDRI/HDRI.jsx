import { Environment } from '@react-three/drei'
import React from 'react'

const HDRI = () => {
  return (
    <Environment
      background={false}
      files="assets/hdri/interior.hdr"
      preset="night"
      environmentIntensity={3}
      environmentRotation={[Math.PI / 1.1, Math.PI / 2, 0]}
    />
  )
}

export default HDRI
