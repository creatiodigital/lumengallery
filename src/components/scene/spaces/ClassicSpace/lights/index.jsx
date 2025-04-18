import React from 'react'

import { AmbientLight } from './AmbientLight'
// import { AreaLight } from './AreaLight'
import { HDRI } from './HDRI'

export const Lights = () => {
  return (
    <>
      <AmbientLight />
      <HDRI />
      {/* <AreaLight /> */}
    </>
  )
}
