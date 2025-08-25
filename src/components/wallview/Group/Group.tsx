import React, { memo } from 'react'
import type { RefObject } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { useMoveGroupArtwork } from '@/components/wallview/hooks/useMoveGroupArtwork'
import { setGroupHovered, setGroupNotHovered } from '@/redux/slices/wallViewSlice'
import type { RootState } from '@/redux/store'
import type { TDimensions } from '@/types/geometry'

import styles from './Group.module.scss'

type GroupProps = {
  wallRef: RefObject<HTMLDivElement | null>
  boundingData: TDimensions | null
  scaleFactor: number
  preventClick: RefObject<boolean>
  groupArtworkHandlers: {
    handleAddArtworkToGroup: (id: string) => void
    handleRemoveArtworkGroup: () => void
  }
}

const Group: React.FC<GroupProps> = memo(({ wallRef, boundingData, scaleFactor, preventClick }) => {
  const artworkGroup = useSelector((state: RootState) => state.wallView.artworkGroup)
  const isDraggingGroup = useSelector((state: RootState) => state.wallView.isDraggingGroup)

  const dispatch = useDispatch()

  const { handleGroupDragStart, handleGroupDragEnd } = useMoveGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
    preventClick,
  )

  const { groupHeight, groupWidth, groupY, groupX } = artworkGroup

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    handleGroupDragStart(event) // pass React.MouseEvent (hook expects it)
  }

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingGroup) {
      event.stopPropagation()
      handleGroupDragEnd()
    }
  }

  const handleMouseEnter = () => {
    dispatch(setGroupHovered())
  }

  const handleMouseLeave = () => {
    dispatch(setGroupNotHovered())
  }

  return (
    <div
      className={styles.group}
      style={{
        height: groupHeight as number,
        width: groupWidth as number,
        top: groupY,
        left: groupX,
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  )
})

Group.displayName = 'Group'

export default Group
