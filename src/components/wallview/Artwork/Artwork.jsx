import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { Handles } from '@/components/wallview/Handles'
import { useMoveArtwork } from '@/components/wallview/hooks/useMoveArtwork'
import { chooseCurrentArtworkId } from '@/lib/features/wallViewSlice'
import { useGroupArtwork } from '@/components/wallview/hooks/useGroupArtwork'
import { showWizard } from '@/lib/features/wizardSlice'
import styles from './Artwork.module.scss'

const Artwork = ({
  artwork,
  wallRef,
  boundingData,
  scaleFactor,
  preventClick,
  onHandleResize,
  setHoveredArtworkId,
}) => {
  const { id, canvas, artworkType } = artwork
  const { x, y, width, height } = canvas

  const dispatch = useDispatch()

  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const isShiftKeyDown = useSelector((state) => state.wallView.isShiftKeyDown)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)

  const { handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd } = useMoveArtwork(
    wallRef,
    boundingData,
    scaleFactor,
  )

  const { handleAddArtworkToGroup } = useGroupArtwork(
    wallRef,
    boundingData,
    scaleFactor,
    preventClick,
  )

  const handleArtworkClick = (event) => {
    event.stopPropagation()

    if (isShiftKeyDown) {
      handleAddArtworkToGroup(id)
    } else {
      dispatch(chooseCurrentArtworkId(id))

      if (artworkGroupIds.length === 0) {
        handleAddArtworkToGroup(id)
      }
    }

    dispatch(showWizard())
  }

  const handleMouseEnter = () => setHoveredArtworkId(id)
  const handleMouseLeave = () => setHoveredArtworkId(null)

  const handleMouseMove = (event) => {
    handleArtworkDragMove(event)
  }

  return (
    <div
      className={styles.artwork}
      style={{
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
        zIndex: currentArtworkId === id ? 10 : 1,
        cursor: 'grabbing',
      }}
      onMouseDown={(e) => handleArtworkDragStart(e, id)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleArtworkDragEnd}
      onClick={handleArtworkClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {currentArtworkId === id && artworkGroupIds.length === 1 && (
        <Handles artworkId={id} handleResize={onHandleResize} />
      )}
      {artworkType === 'text' && <ArtisticText artworkId={id} />}
      {artworkType === 'paint' && <ArtisticImage artwork={artwork} />}
    </div>
  )
}

export default Artwork
