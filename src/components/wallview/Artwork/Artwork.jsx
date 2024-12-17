import React from 'react'
import { useSelector } from 'react-redux'
import { Handles } from '../Handles'
import styles from './Artwork.module.scss'

const Artwork = ({ artwork, onDragStart, onArtworkClick, onHandleResize }) => {
  const currentArtworkId = useSelector((state) => state.wallView.currentArtworkId)

  const { canvas, id, url } = artwork
  const { y, x, width, height } = canvas
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
    >
      {currentArtworkId === id && <Handles artworkId={id} handleResize={onHandleResize} />}
    </div>
  )
}

export default Artwork
