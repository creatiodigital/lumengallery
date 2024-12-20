import { useGLTF } from '@react-three/drei'
import React from 'react'
import { useSelector } from 'react-redux'

import { Artworks } from '../objects/Artworks'
import { Ceiling } from '../objects/Ceiling'
import { Floor } from '../objects/Floor'
import { Lamp } from '../objects/Lamp'
import { Placeholder } from '../objects/Placeholder'
import { RectLight } from '../objects/RectLight'
import { Wall } from '../objects/Wall'

const OneSpace = ({ wallRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/one-space36.glb')

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

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
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
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

useGLTF.preload('/assets/one-space36.glb')

export default OneSpace
