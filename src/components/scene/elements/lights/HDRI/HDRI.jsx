import { Environment } from '@react-three/drei'
import React from 'react'

const HDRI = () => {
  return <Environment background={false} preset="warehouse" environmentIntensity={0.5} path="/" />
}

export default HDRI
