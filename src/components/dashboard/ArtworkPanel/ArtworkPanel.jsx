import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { hideArtworkPanel } from '@/lib/features/sceneSlice'

import styles from './ArtworkPanel.module.scss'

const ArtworkPanel = () => {
  const dispatch = useDispatch()
  const isArtworkPanelOpen = useSelector((state) => state.scene.isArtworkPanelOpen)
  const artworks = useSelector((state) => state.artist.artworks)
  const selectedSceneArtworkId = useSelector((state) => state.scene.currentArtworkId)

  const selectedArtwork = artworks.find((artwork) => artwork.id === selectedSceneArtworkId)

  if (!isArtworkPanelOpen) return null

  return (
    <div className={styles.artworkPanel}>
      <button className={styles.closeButton} onClick={() => dispatch(hideArtworkPanel())}>
        Close
      </button>
      {artworks?.length > 0 && selectedArtwork && <h2>{selectedArtwork.name}</h2>}
      {artworks?.length > 0 && selectedArtwork && <h2>{selectedArtwork.author}</h2>}
    </div>
  )
}

export default ArtworkPanel
