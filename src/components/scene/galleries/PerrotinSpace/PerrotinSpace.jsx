import { useGLTF } from '@react-three/drei'
import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Artworks } from '@/components/scene/galleries/objects/Artworks'
import { Ceiling } from '@/components/scene/galleries/objects/Ceiling'
import { CeilingGlass } from '@/components/scene/galleries/objects/CeilingGlass'
import { Floor } from '@/components/scene/galleries/objects/Floor'
import { Placeholder } from '@/components/scene/galleries/objects/Placeholder'
import { RectLamp } from '@/components/scene/galleries/objects/RectLamp'
import { Reel } from '@/components/scene/galleries/objects/Reel'
import { Wall } from '@/components/scene/galleries/objects/Wall'
import { addWall } from '@/lib/features/artistSlice'

import { Lights } from './lights'
import { reelMaterial, topMaterial, rectLampMaterial } from './materials'

const PerrotinSpace = ({ wallRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/galleries/perrotin1.glb')

  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

  const wallsArray = useMemo(() => Array.from({ length: 1 }), [])
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])
  const rectLampsArray = useMemo(() => Array.from({ length: 1 }), [])
  const reelsArray = useMemo(() => Array.from({ length: 1 }), [])

  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const wallNode = nodes[`placeholder${i}`]
      if (wallNode) {
        dispatch(addWall({ id: wallNode.uuid, name: `Wall ${i + 1}` }))
      }
    })
  }, [nodes, dispatch, wallsArray, placeholdersArray])

  console.log('nodes', nodes)

  return (
    <group {...props} dispose={null}>
      <Lights />
      <Floor nodes={nodes} materials={materials} />
      <Ceiling nodes={nodes} materials={materials} />
      <CeilingGlass nodes={nodes} topMaterial={topMaterial} />
      {wallsArray.map((_, i) => (
        <Wall key={i} i={i} wallRef={wallRefs[i]} nodes={nodes} materials={materials} />
      ))}
      {isPlaceholdersShown &&
        !!placeholdersArray.length &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
      {rectLampsArray.map((_, i) => (
        <RectLamp key={i} i={i} nodes={nodes} rectLampMaterial={rectLampMaterial} />
      ))}
      {reelsArray.map((_, i) => (
        <Reel key={i} i={i} nodes={nodes} reelMaterial={reelMaterial} />
      ))}
      <Artworks />
    </group>
  )
}

useGLTF.preload('/assets/galleries/perrotin1.glb')

export default PerrotinSpace
