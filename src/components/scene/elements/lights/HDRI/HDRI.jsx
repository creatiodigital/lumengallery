import { Environment } from '@react-three/drei'
import React from 'react'

const HDRI = () => {
  return (
    <Environment background={false} files="/assets/hdri/interior.hdr" environmentIntensity={0.5} />
  )
}

export default HDRI
