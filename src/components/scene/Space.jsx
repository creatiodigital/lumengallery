import React, { useContext, useMemo } from 'react'
import { useSelector } from 'react-redux'

import SceneContext from '@/contexts/SceneContext'

import { spaceComponents, spaceRefsConfig } from './constants'

export const Space = ({ onPlaceholderClick, artworks }) => {
  const { wallRefs, windowRefs, glassRefs } = useContext(SceneContext)
  const selectedSpace = useSelector((state) => state.dashboard.selectedSpace)

  const spaceConfig = spaceRefsConfig[selectedSpace.value] || {}

  const wallRefArray = useMemo(
    () => Array.from({ length: spaceConfig.walls || 0 }, () => React.createRef()),
    [spaceConfig.walls],
  )
  const windowRefArray = useMemo(
    () => Array.from({ length: spaceConfig.windows || 0 }, () => React.createRef()),
    [spaceConfig.windows],
  )
  const glassRefArray = useMemo(
    () => Array.from({ length: spaceConfig.glass || 0 }, () => React.createRef()),
    [spaceConfig.glass],
  )

  if ('walls' in spaceConfig) wallRefs.current = wallRefArray
  if ('windows' in spaceConfig) windowRefs.current = windowRefArray
  if ('glass' in spaceConfig) glassRefs.current = glassRefArray

  const SpaceComponent = spaceComponents[selectedSpace.value]

  if (!SpaceComponent) return null

  const spaceProps = {
    onPlaceholderClick,
    artworks,
  }
  if ('walls' in spaceConfig) spaceProps.wallRefs = wallRefs.current
  if ('windows' in spaceConfig) spaceProps.windowRefs = windowRefs.current
  if ('glass' in spaceConfig) spaceProps.glassRefs = glassRefs.current

  return <SpaceComponent {...spaceProps} />
}
