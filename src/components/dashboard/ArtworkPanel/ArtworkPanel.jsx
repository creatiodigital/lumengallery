import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { hideArtworkPanel } from '@/lib/features/sceneSlice'

import styles from './ArtworkPanel.module.scss'
import { Button } from '@/components/ui/Button'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const isArtworkPanelOpen = useSelector((state) => state.scene.isArtworkPanelOpen)
  const artworks = useSelector((state) => state.artist.artworks)
  const selectedSceneArtworkId = useSelector((state) => state.scene.currentArtworkId)

  const selectedArtwork = artworks.find((artwork) => artwork.id === selectedSceneArtworkId)

  if (!isArtworkPanelOpen) return null

  return (
    <div className={styles.artworkPanel}>
      <div className={styles.info}>
        {artworks?.length > 0 && selectedArtwork && (
          <h3 className={styles.author}>{selectedArtwork.author}</h3>
        )}
        {artworks?.length > 0 && selectedArtwork && (
          <span className={styles.name}>{selectedArtwork.name}</span>
        )}
      </div>
      <div style={styles.cta}>
        <Button type="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
    </div>
  )
}

export default ArtworkPanel
