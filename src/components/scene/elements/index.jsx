import React, { useContext, useMemo } from 'react'

import OneSpace from '@/components/scene/galleries/OneSpace/OneSpace'
import SceneContext from '@/contexts/SceneContext'

import { Lights } from './lights'

export const Elements = ({ onPlaceholderClick, artworks, isSpace }) => {
  const { wallRefs } = useContext(SceneContext)

  const wallRefArray = useMemo(() => Array.from({ length: 6 }, () => React.createRef()), [])
  wallRefs.current = wallRefArray

  return (
    <>
      <Lights />
      <OneSpace
        wallRefs={wallRefs.current}
        onPlaceholderClick={onPlaceholderClick}
        artworks={artworks}
        isSpace={isSpace}
      />
    </>
  )
}
