import React, { useContext, useMemo } from 'react'
import { useSelector } from 'react-redux'

import ClassicSpace from '@/components/scene/galleries/ClassicSpace/ClassicSpace'
import PerrotinSpace from '@/components/scene/galleries/PerrotinSpace/PerrotinSpace'
import SceneContext from '@/contexts/SceneContext'

export const Elements = ({ onPlaceholderClick, artworks }) => {
  const { wallRefs } = useContext(SceneContext)
  const { windowRefs } = useContext(SceneContext)
  const { glassRefs } = useContext(SceneContext)

  const selectedSpace = useSelector((state) => state.dashboard.selectedSpace)

  const wallRefArray = useMemo(() => Array.from({ length: 1 }, () => React.createRef()), [])
  const windowRefArray = useMemo(() => Array.from({ length: 2 }, () => React.createRef()), [])
  const glassRefArray = useMemo(() => Array.from({ length: 2 }, () => React.createRef()), [])

  wallRefs.current = wallRefArray
  windowRefs.current = windowRefArray
  glassRefs.current = glassRefArray

  return (
    <>
      {selectedSpace.value === 'classic1' && (
        <ClassicSpace
          wallRefs={wallRefs.current}
          windowRefs={windowRefs.current}
          glassRefs={glassRefs.current}
          onPlaceholderClick={onPlaceholderClick}
          artworks={artworks}
        />
      )}
      {selectedSpace.value === 'perrotin1' && (
        <PerrotinSpace
          wallRefs={wallRefs.current}
          onPlaceholderClick={onPlaceholderClick}
          artworks={artworks}
        />
      )}
    </>
  )
}

export default Elements
