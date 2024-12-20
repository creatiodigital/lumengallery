import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Button } from '@/components/ui/Button'
import { hideArtworkPanel } from '@/lib/features/dashboardSlice'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const isArtworkPanelOpen = useSelector((state) => state.dashboard.isArtworkPanelOpen)
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
          <span className={styles.title}>{selectedArtwork.name}</span>
        )}
        {artworks?.length > 0 && selectedArtwork && (
          <div className={styles.description}>{selectedArtwork.description}</div>
        )}
      </div>
      <div style={styles.cta}>
        <Button type="outline" label="Close" onClick={() => dispatch(hideArtworkPanel())} />
      </div>
    </div>
  )
}

export default ArtworkPanel
