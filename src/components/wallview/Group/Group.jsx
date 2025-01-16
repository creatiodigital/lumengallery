import React, { memo } from 'react'
import { useSelector } from 'react-redux'
import { useMoveGroupArtwork } from '@/components/wallview/hooks/useMoveGroupArtwork'

import styles from './Group.module.scss'

const Group = memo(({ wallRef, boundingData, scaleFactor, preventClick }) => {
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const isDraggingGroup = useSelector((state) => state.wallView.isDraggingGroup)

  const { handleGroupDragStart, handleGroupDragMove, handleGroupDragEnd } = useMoveGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
    preventClick,
  )

  const { groupHeight, groupWidth, groupY, groupX } = artworkGroup

  const handleMouseDown = (event) => {
    event.stopPropagation()
    handleGroupDragStart(event)
  }

  const handleMouseMove = (event) => {
    if (isDraggingGroup) {
      handleGroupDragMove(event)
    }
  }

  const handleMouseUp = (event) => {
    if (isDraggingGroup) {
      event.stopPropagation()
      handleGroupDragEnd(event)
    }
  }

  return (
    <div
      className={styles.group}
      style={{
        height: groupHeight,
        width: groupWidth,
        top: groupY,
        left: groupX,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    />
  )
})

Group.displayName = 'Group'

export default Group
