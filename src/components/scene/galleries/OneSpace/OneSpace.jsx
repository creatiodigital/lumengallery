import { useGLTF } from '@react-three/drei'
import React from 'react'

import { Artworks } from './Artworks'
import { Ceiling } from './Ceiling'
import { Floor } from './Floor'
import { Lamp } from './Lamp'
import { Placeholder } from './Placeholder'
import { RectLight } from './RectLight'
import { Wall } from './Wall'

const OneSpace = ({ wallRefs, isSpace, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/one-space33.glb')

  const wallsArray = Array.from({ length: 1 })
  const placeholdersArray = Array.from({ length: 6 }) || []
  const rectLightsArray = Array.from({ length: 5 })
  const lampsArray = Array.from({ length: 27 })

  return (
    <group {...props} dispose={null}>
      <Floor nodes={nodes} materials={materials} />
      <Ceiling nodes={nodes} materials={materials} />
      {wallsArray.map((_, i) => (
        <Wall key={i} i={i} wallRef={wallRefs[i]} nodes={nodes} materials={materials} />
      ))}
      {!isSpace && placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
      {rectLightsArray.map((_, i) => (
        <RectLight key={i} i={i} nodes={nodes} />
      ))}
      {lampsArray.map((_, i) => (
        <Lamp key={i} i={i} nodes={nodes} />
      ))}
      <Artworks />
    </group>
  )
}

useGLTF.preload('/assets/one-space33.glb')

export default OneSpace
