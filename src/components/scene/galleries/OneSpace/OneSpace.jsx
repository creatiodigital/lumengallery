import { useGLTF } from '@react-three/drei'
import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { addWall } from '@/lib/features/artistSlice'

import { Artworks } from '../objects/Artworks'
import { Ceiling } from '../objects/Ceiling'
import { Floor } from '../objects/Floor'
import { Lamp } from '../objects/Lamp'
import { Placeholder } from '../objects/Placeholder'
import { RectLight } from '../objects/RectLight'
import { Wall } from '../objects/Wall'

const OneSpace = ({ wallRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/one-space42.glb')
  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

  const wallsArray = Array.from({ length: 1 })
  const placeholdersArray = Array.from({ length: 6 }) || []
  const rectLightsArray = Array.from({ length: 5 })
  const lampsArray = Array.from({ length: 27 })

  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const wallNode = nodes[`placeholder${i}`]
      if (wallNode) {
        dispatch(addWall({ id: wallNode.uuid, name: `Wall ${i + 1}` }))
      }
    })
  }, [nodes, dispatch, wallsArray, placeholdersArray])

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

useGLTF.preload('/assets/one-space42.glb')

export default OneSpace
