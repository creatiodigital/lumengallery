import React, { memo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { Handles } from '@/components/wallview/Handles'
import { useMoveArtwork } from '@/components/wallview/hooks/useMoveArtwork'
import { chooseCurrentArtworkId } from '@/app/redux/slices/wallViewSlice'
import { showWizard } from '@/app/redux/slices/wizardSlice'

import styles from './Artwork.module.scss'

const Artwork = memo(
  ({
    artwork,
    wallRef,
    boundingData,
    scaleFactor,
    onHandleResize,
    setHoveredArtworkId,
    groupArtworkHandlers,
  }) => {
    const { id, artworkType } = artwork
    const dispatch = useDispatch()

    const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
    const isShiftKeyDown = useSelector((state) => state.wallView.isShiftKeyDown)
    const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
    const exhibitionArtworksById = useSelector((state) => state.exhibition.exhibitionArtworksById)

    const artworkPositions = exhibitionArtworksById[id]
    const { posX2d, posY2d, height2d, width2d } = artworkPositions

    const { handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd } = useMoveArtwork(
      wallRef,
      boundingData,
      scaleFactor,
    )

    const { handleAddArtworkToGroup } = groupArtworkHandlers

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
        id={`artwork-${id}`}
        className={styles.artwork}
        style={{
          top: `${posY2d}px`,
          left: `${posX2d}px`,
          width: `${width2d}px`,
          height: `${height2d}px`,
          zIndex: currentArtworkId === id ? 10 : 1,
          cursor: 'grabbing',
        }}
        onMouseDown={(event) => handleArtworkDragStart(event, id)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleArtworkDragEnd}
        onClick={handleArtworkClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {currentArtworkId === id && <Handles artworkId={id} handleResize={onHandleResize} />}
        {artworkType === 'text' && <ArtisticText artworkId={id} />}
        {artworkType === 'paint' && <ArtisticImage artwork={artwork} />}
      </div>
    )
  },
)

Artwork.displayName = 'Artwork'

export default Artwork
