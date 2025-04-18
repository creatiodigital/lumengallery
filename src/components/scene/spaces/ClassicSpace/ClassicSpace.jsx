import { useGLTF } from '@react-three/drei'
import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Artworks } from '@/components/scene/spaces/objects/Artworks'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { Floor } from '@/components/scene/spaces/objects/Floor'
import { Lamp } from '@/components/scene/spaces/objects/Lamp'
import { Line } from '@/components/scene/spaces/objects/Line'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { Reel } from '@/components/scene/spaces/objects/Reel'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { Window } from '@/components/scene/spaces/objects/Window'
import { addWall } from '@/lib/features/sceneSlice'

import { Lights } from './lights'
import {
  windowMaterial,
  glassMaterial,
  lineMaterial,
  reelMaterial,
  lampMaterial,
  bulbMaterial,
} from './materials'

const ClassicSpace = ({ wallRefs, windowRefs, glassRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/spaces/classic.glb')

  const dispatch = useDispatch()

  const isPlaceholdersShown = useSelector((state) => state.scene.isPlaceholdersShown)

  const wallsArray = useMemo(() => Array.from({ length: 1 }), [])
  const windowsArray = useMemo(() => Array.from({ length: 2 }), [])
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])
  const lampsArray = useMemo(() => Array.from({ length: 16 }), [])
  const reelsArray = useMemo(() => Array.from({ length: 5 }), [])
  const linesArray = useMemo(() => Array.from({ length: 20 }), [])

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
      <Lights />
      <Floor nodes={nodes} materials={materials} />
      <Ceiling nodes={nodes} materials={materials} />
      {wallsArray.map((_, i) => (
        <Wall key={i} i={i} wallRef={wallRefs[i]} nodes={nodes} materials={materials} />
      ))}
      {windowsArray.map((_, i) => (
        <Window
          key={i}
          windowRef={windowRefs[i]}
          glassRef={glassRefs[i]}
          i={i}
          nodes={nodes}
          windowMaterial={windowMaterial}
          glassMaterial={glassMaterial}
        />
      ))}
      {isPlaceholdersShown &&
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
      {lampsArray.map((_, i) => (
        <Lamp key={i} i={i} nodes={nodes} lampMaterial={lampMaterial} bulbMaterial={bulbMaterial} />
      ))}
      {reelsArray.map((_, i) => (
        <Reel key={i} i={i} nodes={nodes} reelMaterial={reelMaterial} />
      ))}
      {linesArray.map((_, i) => (
        <Line key={i} i={i} nodes={nodes} lineMaterial={lineMaterial} />
      ))}
      <Artworks />
    </group>
  )
}

useGLTF.preload('/assets/spaces/classic.glb')

export default ClassicSpace
