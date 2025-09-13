'use client'

import React, { useContext, useMemo, createRef } from 'react'
import { useSelector } from 'react-redux'
import type { Mesh } from 'three'

import SceneContext from '@/contexts/SceneContext'
import type { TArtwork } from '@/types/artwork'
import type { RootState } from '@/redux/store'

import { spaceComponents, spaceRefsConfig } from './constants'

type SpaceProps = {
  onPlaceholderClick: (wallId: string) => void
  artworks: TArtwork[]
}

export const Space: React.FC<SpaceProps> = ({ onPlaceholderClick, artworks }) => {
  const sceneContext = useContext(SceneContext)

  const selectedSpace = useSelector((state: RootState) => state.dashboard.selectedSpace)

  // Fallback for invalid usage or uninitialized state
  if (!sceneContext || !selectedSpace) return null

  const { wallRefs, windowRefs, glassRefs } = sceneContext

  const spaceKey = selectedSpace.value as keyof typeof spaceRefsConfig
  const spaceConfig = spaceRefsConfig[spaceKey] || {}

  const wallRefArray = useMemo(
    () => Array.from({ length: spaceConfig.walls || 0 }, () => createRef<Mesh>()),
    [spaceConfig.walls],
  )

  const windowRefArray = useMemo(
    () => Array.from({ length: spaceConfig.windows || 0 }, () => createRef<Mesh>()),
    [spaceConfig.windows],
  )

  const glassRefArray = useMemo(
    () => Array.from({ length: spaceConfig.glass || 0 }, () => createRef<Mesh>()),
    [spaceConfig.glass],
  )

  // Assign to context (you control the .current assignment elsewhere)
  if ('walls' in spaceConfig) wallRefs.current = wallRefArray
  if ('windows' in spaceConfig) windowRefs.current = windowRefArray
  if ('glass' in spaceConfig) glassRefs.current = glassRefArray

  const SpaceComponent = spaceComponents[selectedSpace.value as keyof typeof spaceComponents]

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
