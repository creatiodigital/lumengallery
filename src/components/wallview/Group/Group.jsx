import React from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'

import styles from './Group.module.scss'

const Group = ({ wallRef, boundingData, scaleFactor, preventClick }) => {
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const isDraggingGroup = useSelector((state) => state.wallView.isDraggingGroup)

  const { handleGroupDragStart, handleGroupDragMove, handleGroupDragEnd } = useGroupArtwork(
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
}

export default Group
