import React, { useContext, useMemo } from 'react'

import ClassicSpace from '@/components/scene/galleries/ClassicSpace/ClassicSpace'
import SceneContext from '@/contexts/SceneContext'

import { Lights } from './lights'

export const Elements = ({ onPlaceholderClick, artworks }) => {
  const { wallRefs } = useContext(SceneContext)
  const { windowRefs } = useContext(SceneContext)
  const { glassRefs } = useContext(SceneContext)

  const wallRefArray = useMemo(() => Array.from({ length: 1 }, () => React.createRef()), [])
  const windowRefArray = useMemo(() => Array.from({ length: 2 }, () => React.createRef()), [])
  const glassRefArray = useMemo(() => Array.from({ length: 2 }, () => React.createRef()), [])

  wallRefs.current = wallRefArray
  windowRefs.current = windowRefArray
  glassRefs.current = glassRefArray

  return (
    <>
      <Lights />
      <ClassicSpace
        wallRefs={wallRefs.current}
        windowRefs={windowRefs.current}
        glassRefs={glassRefs.current}
        onPlaceholderClick={onPlaceholderClick}
        artworks={artworks}
      />
    </>
  )
}

export default Elements
