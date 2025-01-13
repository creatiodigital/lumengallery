import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { startDraggingGroup, stopDraggingGroup } from '@/lib/features/wallViewSlice'

import styles from './Group.module.scss'

const Group = ({ wallRef, boundingData, scaleFactor }) => {
  const artworkGroup = useSelector((state) => state.wallView.artworkGroup)
  const isDraggingGroup = useSelector((state) => {
    return state.wallView.isDraggingGroup
  })
  const dispatch = useDispatch()

  const { handleGroupDragStart, handleGroupDragMove, handleGroupDragEnd } = useGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
  )

  const { groupHeight, groupWidth, groupY, groupX } = artworkGroup

  const handleMouseDown = (event) => {
    event.stopPropagation()
    dispatch(startDraggingGroup())
    handleGroupDragStart(event)
  }

  const handleMouseMove = (event) => {
    if (isDraggingGroup) {
      handleGroupDragMove(event)
    }
  }

  const handleMouseUp = (event) => {
    if (isDraggingGroup) {
      event.stopPropagation() // Prevent mouseUp from propagating to the parent

      // Delay resetting `isDraggingGroup` to ensure `click` events are ignored
      setTimeout(() => {
        dispatch(stopDraggingGroup())
      }, 100)

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
