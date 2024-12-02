import React, { useContext, useRef } from 'react'
import SceneContext from '@/contexts/SceneContext'
import OneSpace from '@/components/galleries/OneSpace'

const Elements = ({ onPlaceholderClick, artworks, isSpace }) => {
  const { wallRefs } = useContext(SceneContext)

  const wallRefArray = Array.from({ length: 6 }, () => useRef(null))
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
