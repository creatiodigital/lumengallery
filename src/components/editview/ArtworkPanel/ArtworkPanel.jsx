import React, { useMemo } from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { hideArtworkPanel } from '@/lib/features/dashboardSlice'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const artworks = useSelector((state) => state.artist.artworks)
  const selectedSceneArtworkId = useSelector((state) => state.scene.currentArtworkId)

  const selectedArtwork = useMemo(
    () => artworks.find((artwork) => artwork.id === selectedSceneArtworkId),
    [artworks, selectedSceneArtworkId],
  )

  const { author, name, description } = selectedArtwork || {}

  return (
    <div className={styles.artworkPanel}>
      <div className={styles.info}>
        {selectedArtwork && (
          <div>
            {author && <h3 className={styles.author}>{author}</h3>}
            {name && <span className={styles.title}>{name}</span>}
            {description && <div className={styles.description}>{description}</div>}
          </div>
        )}
      </div>
      <div className={styles.cta}>
        <Button type="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
    </div>
  )
}

export default ArtworkPanel
