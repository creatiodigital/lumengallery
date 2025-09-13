import React from 'react'

import { AmbientLight } from './AmbientLight'
import { HDRI } from './HDRI'

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
    </>
  )
}
