import React from 'react'

const AmbientLight = ({ color = 'white', intensity = 1 }) => {
  return <ambientLight intensity={intensity} color={color} />
}

export default AmbientLight
