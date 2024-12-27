import React from 'react'
import { useSelector } from 'react-redux'

import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import { ArtisticText } from '@/components/wallview/ArtisticText'

import { Handles } from '../Handles'
import styles from './Artwork.module.scss'

const Artwork = ({ artwork, onDragStart, onArtworkClick, onHandleResize, setHoveredArtworkId }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { canvas, id, url, artworkType } = artwork
  const { y, x, width, height } = canvas

  const handleMouseEnter = () => {
    setHoveredArtworkId(id)
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
      onMouseDown={(event) => onDragStart(event, id)}
      onClick={(event) => onArtworkClick(event, id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {currentArtworkId === id && <Handles artworkId={id} handleResize={onHandleResize} />}
      {artworkType === 'text' && <ArtisticText artworkId={id} />}
      {artworkType === 'paint' && <ArtisticImage artworkId={id} url={url} />}
    </div>
  )
}

export default Artwork
