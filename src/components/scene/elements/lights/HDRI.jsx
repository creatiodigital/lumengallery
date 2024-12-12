import React from 'react'
import { Environment } from '@react-three/drei'

export const HDRI = () => {
  return <Environment background={false} preset="night" path="/" />
}
