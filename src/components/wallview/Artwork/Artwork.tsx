import React, { memo } from 'react'
import type { RefObject } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { Handles } from '@/components/wallview/Handles'
import { useMoveArtwork } from '@/components/wallview/hooks/useMoveArtwork'
import { chooseCurrentArtworkId } from '@/redux/slices/wallViewSlice'
import { showWizard } from '@/redux/slices/wizardSlice'
import type { RootState } from '@/redux/store'
import type { TArtwork } from '@/types/artwork'
import type { TDimensions } from '@/types/geometry'
import type { ResizeHandler } from '@/types/wallView'

import styles from './Artwork.module.scss'

type ArtworkProps = {
  artwork: TArtwork
  wallRef: RefObject<HTMLDivElement>
  boundingData: TDimensions | null
  scaleFactor: number
  onHandleResize: ResizeHandler
  setHoveredArtworkId: (id: string | null) => void
  groupArtworkHandlers: {
    handleAddArtworkToGroup: (id: string) => void
    handleRemoveArtworkGroup: () => void
  }
  preventClick: React.RefObject<boolean>
}

const Artwork = memo(
  ({
    artwork,
    wallRef,
    boundingData,
    scaleFactor,
    onHandleResize,
    setHoveredArtworkId,
    groupArtworkHandlers,
  }: ArtworkProps) => {
    const { id, artworkType } = artwork
    const dispatch = useDispatch()

    const currentArtworkId = useSelector((state: RootState) => state.wallView.currentArtworkId)
    const isShiftKeyDown = useSelector((state: RootState) => state.wallView.isShiftKeyDown)
    const artworkGroupIds = useSelector((state: RootState) => state.wallView.artworkGroupIds)
    const exhibitionArtworksById = useSelector(
      (state: RootState) => state.exhibition.exhibitionArtworksById,
    )

    const artworkPositions = exhibitionArtworksById[id]
    const { posX2d, posY2d, height2d, width2d } = artworkPositions

    const { handleArtworkDragStart, handleArtworkDragMove, handleArtworkDragEnd } = useMoveArtwork(
      wallRef,
      boundingData,
      scaleFactor,
    )

    const { handleAddArtworkToGroup } = groupArtworkHandlers

    const handleArtworkClick = (event: React.MouseEvent<HTMLDivElement>) => {
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

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
      handleArtworkDragMove(event.nativeEvent)
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
        onMouseDown={(event) => {
          event.stopPropagation()
          handleArtworkDragStart(event.nativeEvent, id)
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={() => handleArtworkDragEnd()}
        onClick={handleArtworkClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {currentArtworkId === id && artworkGroupIds.length <= 1 && (
          <Handles artworkId={id} handleResize={onHandleResize} />
        )}
        {artworkType === 'text' && <ArtisticText artworkId={id} />}
        {artworkType === 'image' && <ArtisticImage artwork={artwork} />}
      </div>
    )
  },
)

Artwork.displayName = 'Artwork'

export default Artwork
