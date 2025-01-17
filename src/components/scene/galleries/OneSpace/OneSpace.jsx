import { useGLTF } from '@react-three/drei'
import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Artworks } from '@/components/scene/galleries/objects/Artworks'
import { Ceiling } from '@/components/scene/galleries/objects/Ceiling'
import { Floor } from '@/components/scene/galleries/objects/Floor'
import { Lamp } from '@/components/scene/galleries/objects/Lamp'
import { Placeholder } from '@/components/scene/galleries/objects/Placeholder'
import { RectLight } from '@/components/scene/galleries/objects/RectLight'
import { Wall } from '@/components/scene/galleries/objects/Wall'
import { addWall } from '@/lib/features/artistSlice'

const OneSpace = ({ wallRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/galleries/one-space42.glb')

  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

  const wallsArray = useMemo(() => Array.from({ length: 1 }), [])
  const placeholdersArray = useMemo(() => Array.from({ length: 6 }), [])
  const rectLightsArray = useMemo(() => Array.from({ length: 5 }), [])
  const lampsArray = useMemo(() => Array.from({ length: 27 }), [])

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

useGLTF.preload('/assets/galleries/one-space42.glb')

export default OneSpace
