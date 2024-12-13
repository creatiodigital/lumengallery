import React from 'react'
import { Environment } from '@react-three/drei'

const HDRI = () => {
  return (
    <Environment
      background={false}
      preset="warehouse"
      environmentIntensity={0.5}
      path="/"
    />
  )
}

export default HDRI
