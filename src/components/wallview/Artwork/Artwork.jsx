import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { Handles } from '../Handles'
import styles from './Artwork.module.scss'

const Artwork = ({ artwork, onDragStart, onArtworkClick, onHandleResize, setHoveredArtworkId }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { canvas, id, url } = artwork
  const { y, x, width, height } = canvas

  const handleMouseEnter = () => {
    setHoveredArtworkId(id) // Indicate this artwork is being hovered over
  }

  const handleMouseLeave = () => {
    setHoveredArtworkId(null) // Indicate no artwork is being hovered over
  }

  return (
    <div
      className={styles.artwork}
      style={{
        top: `${y}px`,
        left: `${x}px`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundImage: url ? `url(${url})` : 'none',
      }}
      onMouseDown={(event) => onDragStart(event, id)}
      onClick={(event) => onArtworkClick(event, id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {currentArtworkId === id && <Handles artworkId={id} handleResize={onHandleResize} />}
    </div>
  )
}

export default Artwork
