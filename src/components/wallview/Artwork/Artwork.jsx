import React from 'react'
import { useSelector } from 'react-redux'
import { Handles } from '../Handles'
import { ArtisticText } from '@/components/wallview/ArtisticText'
import { ArtisticImage } from '@/components/wallview/ArtisticImage'
import styles from './Artwork.module.scss'

const Artwork = ({ artwork, onDragStart, onArtworkClick, onHandleResize, setHoveredArtworkId }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { canvas, id, url, artworkType, artisticText } = artwork
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
