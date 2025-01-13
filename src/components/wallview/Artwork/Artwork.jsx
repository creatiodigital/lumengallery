import React from 'react'
import { useSelector } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { Handles } from '@/components/wallview/Handles'

import styles from './Artwork.module.scss'

const Artwork = ({ artwork, onDragStart, onArtworkClick, onHandleResize, setHoveredArtworkId }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)
  const artworkGroupIds = useSelector((state) => state.wallView.artworkGroupIds)
  const isDraggingGroup = useSelector((state) => state.wallView.isDraggingGroup)

  const isGroupVisible = artworkGroupIds.length > 1

  const { canvas, id, artworkType } = artwork
  const { y, x, width, height } = canvas

  const handleMouseEnter = () => {
    setHoveredArtworkId(id)
  }

  const handleMouseDown = (event) => {
    if (isDraggingGroup) {
      event.stopPropagation()
      return
    }
    onDragStart(event, id)
  }

  const handleMouseLeave = () => {
    setHoveredArtworkId(null)
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
      }}
      onMouseDown={handleMouseDown}
      onClick={(event) => onArtworkClick(event, id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {currentArtworkId === id && !isGroupVisible && (
        <Handles artworkId={id} handleResize={onHandleResize} />
      )}
      {artworkType === 'text' && <ArtisticText artworkId={id} />}
      {artworkType === 'paint' && <ArtisticImage artwork={artwork} />}
    </div>
  )
}

export default Artwork
