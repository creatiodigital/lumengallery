import React, { useContext, useRef, useMemo } from 'react'
import SceneContext from '@/contexts/SceneContext'
import OneSpace from '@/components/galleries/OneSpace'

const Elements = ({ onPlaceholderClick, artworks, isSpace }) => {
  const { wallRefs } = useContext(SceneContext)

  // Create an array of refs using useMemo to ensure it doesn't get recreated on each render
  const wallRefArray = useMemo(
    () => Array.from({ length: 6 }, () => React.createRef()),
    []
  )
  wallRefs.current = wallRefArray

  return (
    <>
      <ambientLight />
      <OneSpace
        wallRefs={wallRefs.current}
        onPlaceholderClick={onPlaceholderClick}
        artworks={artworks}
        isSpace={isSpace}
      />
    </>
  )
}

export default Elements
