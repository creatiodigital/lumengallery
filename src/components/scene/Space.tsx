'use client'

import { useContext, useMemo, createRef } from 'react'
import { useSelector } from 'react-redux'
import type { Mesh } from 'three'
import { useGLTF } from '@react-three/drei'

import SceneContext from '@/contexts/SceneContext'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'

import { spaceComponents, getSpaceConfig, type SpaceKey } from './constants'
import { deriveSpaceRefs } from './spaces/objects/nodeIndices'

type SpaceProps = {
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

export const Space: React.FC<SpaceProps> = ({ onPlaceholderClick, artworks }) => {
  const sceneContext = useContext(SceneContext)
  const spaceId = useSelector((state: RootState) => state.exhibition.spaceId) || 'paris'

  const spaceKey = spaceId as SpaceKey
  const spaceConfig = getSpaceConfig(spaceId)

  // How many collision refs to allocate is a property of the MODEL, not a number
  // maintained by hand — a space with more windows than its registry entry
  // claimed used to end up with uncollidable glass and nothing to explain why.
  // Same GLB the space component loads; useGLTF caches by URL, so this is the
  // already-parsed instance rather than a second download.
  const { nodes } = useGLTF(spaceConfig.gltfPath) as unknown as {
    nodes: Record<string, unknown>
  }
  const refs = useMemo(() => spaceConfig.refs ?? deriveSpaceRefs(nodes), [spaceConfig.refs, nodes])

  const wallRefArray = useMemo(
    () => Array.from({ length: refs.walls || 0 }, () => createRef<Mesh>()),
    [refs.walls],
  )

  const windowRefArray = useMemo(
    () => Array.from({ length: refs.windows || 0 }, () => createRef<Mesh>()),
    [refs.windows],
  )

  const glassRefArray = useMemo(
    () => Array.from({ length: refs.glass || 0 }, () => createRef<Mesh>()),
    [refs.glass],
  )

  if (!sceneContext || !spaceId) return null

  const { wallRefs, windowRefs, glassRefs } = sceneContext

  if (refs.walls) wallRefs.current = wallRefArray
  if (refs.windows) windowRefs.current = windowRefArray
  if (refs.glass) glassRefs.current = glassRefArray

  const SpaceComponent = spaceComponents[spaceKey] || spaceComponents['paris']
  if (!SpaceComponent) return null

  return (
    <SpaceComponent
      onPlaceholderClick={onPlaceholderClick}
      artworks={artworks}
      wallRefs={wallRefs.current}
      windowRefs={windowRefs.current}
      glassRefs={glassRefs.current}
    />
  )
}
