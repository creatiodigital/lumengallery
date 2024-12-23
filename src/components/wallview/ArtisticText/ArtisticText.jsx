import React from 'react'
import { useSelector } from 'react-redux'

import styles from './ArtisticText.module.scss'

const ArtisticText = ({ artworkId }) => {
  const artwork = useSelector((state) =>
    state.artist.artworks.find((artwork) => artwork.id === artworkId),
  )

  const text = artwork?.artisticText
  const textAlign = artwork?.artisticTextStyles?.textAlign || 'left'

  console.log('textAlign', textAlign)

  return (
    <div className={styles.text}>
      <div
        style={{
          textAlign,
          color: 'red',
          fontSize: 14,
          lineHeight: 1.5,
        }}
        className={styles.content}
      >
        {text}
      </div>
    </div>
  )
}

export default ArtisticText
