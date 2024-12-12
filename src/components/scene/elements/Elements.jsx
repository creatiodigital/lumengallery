import React, { useContext, useRef, useMemo } from 'react'
import SceneContext from '@/contexts/SceneContext'
import { Lights } from './lights/Lights'
import OneSpace from '@/components/galleries/OneSpace'

export const Elements = ({ onPlaceholderClick, artworks, isSpace }) => {
  const { wallRefs } = useContext(SceneContext)

  const wallRefArray = useMemo(
    () => Array.from({ length: 6 }, () => React.createRef()),
    [],
  )
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