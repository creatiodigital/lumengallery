import { useGLTF } from '@react-three/drei'
import React, { useEffect, useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Mesh, MeshStandardMaterial, BufferGeometry, Texture } from 'three'
import type { GLTF } from 'three-stdlib'

import { ArtObjects } from '@/components/scene/spaces/objects/ArtObjects'
import { Ceiling } from '@/components/scene/spaces/objects/Ceiling'
import { CeilingGlass } from '@/components/scene/spaces/objects/CeilingGlass'
import { Floor } from '@/components/scene/spaces/objects/Floor'
import { Placeholder } from '@/components/scene/spaces/objects/Placeholder'
import { RectLamp } from '@/components/scene/spaces/objects/RectLamp'
import { Reel } from '@/components/scene/spaces/objects/Reel'
import { Wall } from '@/components/scene/spaces/objects/Wall'
import { addWall } from '@/redux/slices/sceneSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { Lights } from './lights'
import { reelMaterial, topMaterial, rectLampMaterial } from './materials'

type GLTFResult = GLTF & {
  nodes: {
    floor: Mesh & { geometry: BufferGeometry }
    ceiling: Mesh & { geometry: BufferGeometry }
    top: Mesh & { geometry: BufferGeometry }
    [key: string]: Mesh
  }
  materials: {
    floorMaterial: MeshStandardMaterial & { map?: Texture }
    ceilingMaterial: MeshStandardMaterial & { map?: Texture }
    wallMaterial?: MeshStandardMaterial & { map?: Texture }
    [key: string]: MeshStandardMaterial | undefined
  }
}
type ModernSpaceProps = React.ComponentProps<'group'> & {
  wallRefs: React.RefObject<Mesh | null>[]
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

const ModernSpace: React.FC<ModernSpaceProps> = ({ wallRefs, ...props }) => {
  const { nodes, materials } = useGLTF('/assets/spaces/modern.glb') as GLTFResult

  const dispatch = useDispatch()
  const isPlaceholdersShown = useSelector((state: RootState) => state.scene.isPlaceholdersShown)

  const wallsArray = useMemo(() => Array.from({ length: 1 }), [])
  const placeholdersArray = useMemo(() => Array.from({ length: 4 }), [])
  const rectLampsArray = useMemo(() => Array.from({ length: 1 }), [])
  const reelsArray = useMemo(() => Array.from({ length: 1 }), [])

  useEffect(() => {
    placeholdersArray.forEach((_, i) => {
      const wallNode = nodes[`placeholder${i}`]
      if (wallNode) {
        dispatch(addWall({ id: wallNode.uuid }))
      }
    })
  }, [nodes, dispatch, placeholdersArray])

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
        placeholdersArray.map((_, i) => <Placeholder key={i} i={i} nodes={nodes} />)}
      {rectLampsArray.map((_, i) => (
        <RectLamp key={i} i={i} nodes={nodes} rectLampMaterial={rectLampMaterial} />
      ))}
      {reelsArray.map((_, i) => (
        <Reel key={i} i={i} nodes={nodes} reelMaterial={reelMaterial} />
      ))}
      <ArtObjects />
    </group>
  )
}

useGLTF.preload('/assets/spaces/modern.glb')

export default ModernSpace
